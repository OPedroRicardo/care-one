import { Express, Request, Response, NextFunction } from 'express'
import z from 'zod'

import { RagService }        from '../services/RagService.ts'
import { LLMChatService }    from '../services/LLMChatService.ts'
import { ChatSessionStore }  from '../services/ChatSessionStore.ts'

// ── Schemas de validação
const NewChatBody = z.object({
  // Contexto opcional (ex: dados da triagem para personalizar o chat)
  context: z.string().optional(),
})

const DeleteChatBody = z.object({
  chatId: z.uuid(),
})

const MessageBody = z.object({
  chatId:  z.uuid(),
  message: z.string().check(z.minLength(1), z.maxLength(2000)),
})

const DeleteMessageBody = z.object({
  chatId: z.uuid(),
  index:  z.number().int().min(0),
})

const CancelMessageBody = z.object({
  chatId: z.uuid(),
})

const GetChatParams = z.object({
  id: z.uuid(),
})

// ── Controller

export class ChatController {
  readonly #sessions: ChatSessionStore
  readonly #llm:      LLMChatService

  constructor(_app: Express) {
    const rag       = new RagService()
    this.#sessions  = new ChatSessionStore()
    this.#llm       = new LLMChatService(rag)
  }

  /**
   * GET /chat/list
   * Retorna todos os chats com preview da primeira mensagem do usuário.
   */
  listChats = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const chats = await this.#sessions.list()
      res.status(200).json({ chats })
    } catch (err) {
      next(err)
    }
  }

  /**
   * GET /chat/:id
   * Retorna um chat com histórico completo.
   */
  getChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = GetChatParams.parse(req.params)

      const session = await this.#sessions.get(id)
      if (!session) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      res.status(200).json({ id: session.id, createdAt: session.createdAt, history: session.history })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /chat/new
   * Cria uma nova sessão de chat e retorna o chatId.
   * Body opcional: { context?: string } — pré-texto injetado como primeira mensagem do sistema.
   */
  newChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { context } = NewChatBody.parse(req.body)

      const chatId = await this.#sessions.create()

      // Se um contexto for fornecido (ex: sinais vitais / score NEWS2), injeta no histórico
      // como mensagem do assistente para guiar a conversa inicial
      if (context) {
        await this.#sessions.addMessage(chatId, 'assistant', `Contexto da triagem:\n${context}`)
      }

      res.status(201).json({ chatId })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /chat/delete
   * Remove uma sessão de chat existente.
   * Body: { chatId: string }
   */
  deleteChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId } = DeleteChatBody.parse(req.body)

      const deleted = await this.#sessions.delete(chatId)

      if (!deleted) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /chat/message
   * Recebe uma mensagem do usuário, executa o pipeline RAG + LLM e retorna a resposta.
   * Body: { chatId: string, message: string }
   */
  onMessage = async (req: Request, res: Response, next: NextFunction) => {
    let chatId: string | undefined

    try {
      const body = MessageBody.parse(req.body)
      chatId = body.chatId

      const session = await this.#sessions.get(chatId)
      if (!session) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      // Registra mensagem do usuário no histórico
      await this.#sessions.addMessage(chatId, 'user', body.message)

      // Cria AbortController para permitir cancelamento via POST /message/cancel
      const abort = new AbortController()
      this.#sessions.setAbort(chatId, abort)

      // Re-busca para obter histórico atualizado com a mensagem recém inserida,
      // depois remove a última (mensagem atual) para não enviá-la duplicada ao LLM
      const fresh = await this.#sessions.get(chatId)
      const historyBeforeCurrent = fresh!.history.slice(0, -1)

      const { reply, sources } = await this.#llm.chat(
        body.message,
        historyBeforeCurrent,
        abort.signal,
      )

      // Registra resposta do assistente no histórico
      await this.#sessions.addMessage(chatId, 'assistant', reply)
      this.#sessions.clearAbort(chatId)

      res.status(200).json({ reply, sources })
    } catch (err: unknown) {
      // Cancela a chamada ativa se houve erro
      if (chatId) this.#sessions.clearAbort(chatId)

      // AbortError é erro esperado ao cancelar — não precisa propagar
      if (err instanceof Error && err.name === 'AbortError') {
        res.status(499).json({ error: 'Requisição cancelada pelo cliente.' })
        return
      }

      next(err)
    }
  }

  /**
   * POST /chat/message/delete
   * Remove uma mensagem específica do histórico pelo índice.
   * Body: { chatId: string, index: number }
   */
  deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId, index } = DeleteMessageBody.parse(req.body)

      const session = await this.#sessions.get(chatId)
      if (!session) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      const deleted = await this.#sessions.deleteMessage(chatId, index)

      if (!deleted) {
        res.status(400).json({ error: `Índice ${index} inválido. A sessão possui ${session.history.length} mensagem(ns).` })
        return
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /chat/message/cancel
   * Cancela a chamada LLM em andamento para a sessão.
   * Body: { chatId: string }
   */
  cancelMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chatId } = CancelMessageBody.parse(req.body)

      const session = await this.#sessions.get(chatId)
      if (!session) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      const cancelled = this.#sessions.cancel(chatId)

      res.status(200).json({ cancelled })
    } catch (err) {
      next(err)
    }
  }
}
