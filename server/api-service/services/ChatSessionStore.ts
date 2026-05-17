import { eq, asc, desc } from 'drizzle-orm'
import { db } from '../../shared/db/index.ts'
import { chats, messages } from '../../shared/db/schema.ts'

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  role:      MessageRole
  content:   string
  timestamp: number
}

export interface ChatSession {
  id:        string
  history:   ChatMessage[]
  createdAt: number
  abort?:    AbortController
}

export interface ChatListItem {
  id:           string
  createdAt:    number
  preview:      string | null
  messageCount: number
}

/**
 * Armazena sessões de chat no SQLite via Drizzle.
 * AbortControllers permanecem em memória (runtime-only).
 */
export class ChatSessionStore {
  readonly #aborts = new Map<string, AbortController>()

  async create(): Promise<string> {
    const id        = crypto.randomUUID()
    const createdAt = Date.now()
    await db.insert(chats).values({ id, createdAt })
    return id
  }

  async list(): Promise<ChatListItem[]> {
    const rows = await db.query.chats.findMany({
      with: { messages: { orderBy: asc(messages.createdAt) } },
      orderBy: desc(chats.createdAt),
    })

    return rows.map(row => ({
      id:           row.id,
      createdAt:    row.createdAt,
      preview:      row.messages.find(m => m.role === 'user')?.content ?? null,
      messageCount: row.messages.length,
    }))
  }

  async get(id: string): Promise<ChatSession | undefined> {
    const row = await db.query.chats.findFirst({
      where: eq(chats.id, id),
      with: { messages: { orderBy: asc(messages.createdAt) } },
    })

    if (!row) return undefined

    return {
      id,
      createdAt: row.createdAt,
      abort:     this.#aborts.get(id),
      history:   row.messages.map(m => ({
        role:      m.role as MessageRole,
        content:   m.content,
        timestamp: m.createdAt,
      })),
    }
  }

  async delete(id: string): Promise<boolean> {
    this.#aborts.get(id)?.abort()
    this.#aborts.delete(id)
    const result = await db.delete(chats).where(eq(chats.id, id))
    return (result.rowsAffected ?? 0) > 0
  }

  async addMessage(id: string, role: MessageRole, content: string): Promise<void> {
    await db.insert(messages).values({ chatId: id, role, content, createdAt: Date.now() })
  }

  async deleteMessage(id: string, index: number): Promise<boolean> {
    const rows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, id))
      .orderBy(asc(messages.createdAt), asc(messages.id))

    if (index < 0 || index >= rows.length) return false

    await db.delete(messages).where(eq(messages.id, rows[index].id))
    return true
  }

  setAbort(id: string, controller: AbortController) {
    this.#aborts.set(id, controller)
  }

  clearAbort(id: string) {
    this.#aborts.delete(id)
  }

  cancel(id: string): boolean {
    const controller = this.#aborts.get(id)
    if (!controller) return false
    controller.abort()
    this.#aborts.delete(id)
    return true
  }
}
