import { Express, Request, Response, NextFunction } from 'express'
import z from 'zod'

import { RagService }          from '../services/RagService.ts'
import { LLMChatService }      from '../services/LLMChatService.ts'
import { ChatSessionStore }    from '../services/ChatSessionStore.ts'
import { PatientDataService }  from '../services/PatientDataService.ts'

// ── Validation schemas

const NewChatBody = z.object({
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
  readonly #sessions:       ChatSessionStore
  readonly #llm:            LLMChatService
  readonly #patientData:    PatientDataService

  constructor(_app: Express) {
    const rag           = new RagService()
    this.#sessions      = new ChatSessionStore()
    this.#llm           = new LLMChatService(rag)
    this.#patientData   = new PatientDataService()
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
   * Body opcional: { context?: string } — pré-texto injetado como primeira mensagem do assistente.
   */
  newChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { context } = NewChatBody.parse(req.body)

      const chatId = await this.#sessions.create()

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
   * Executa o pipeline RAG + dados do paciente + LLM e retorna a resposta completa.
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

      await this.#sessions.addMessage(chatId, 'user', body.message)

      const abort = new AbortController()
      this.#sessions.setAbort(chatId, abort)

      const fresh                = await this.#sessions.get(chatId)
      const historyBeforeCurrent = fresh!.history.slice(0, -1)

      const patientContext = await this.#patientData.buildContext()

      const { reply, sources } = await this.#llm.chat(
        body.message,
        historyBeforeCurrent,
        patientContext,
        abort.signal,
      )

      await this.#sessions.addMessage(chatId, 'assistant', reply)
      this.#sessions.clearAbort(chatId)

      res.status(200).json({ reply, sources })
    } catch (err: unknown) {
      if (chatId) this.#sessions.clearAbort(chatId)

      if (err instanceof Error && err.name === 'AbortError') {
        res.status(499).json({ error: 'Requisição cancelada pelo cliente.' })
        return
      }

      next(err)
    }
  }

  /**
   * POST /chat/message/stream
   * Igual ao onMessage, mas transmite a resposta via SSE token a token.
   */
  onMessageStream = async (req: Request, res: Response, next: NextFunction) => {
    let chatId: string | undefined

    try {
      const body = MessageBody.parse(req.body)
      chatId = body.chatId

      const session = await this.#sessions.get(chatId)
      if (!session) {
        res.status(404).json({ error: 'Sessão não encontrada.' })
        return
      }

      await this.#sessions.addMessage(chatId, 'user', body.message)

      const abort = new AbortController()
      this.#sessions.setAbort(chatId, abort)

      const fresh                = await this.#sessions.get(chatId)
      const historyBeforeCurrent = fresh!.history.slice(0, -1)

      const patientContext = await this.#patientData.buildContext()

      // Open the SSE channel only after all pre-flight DB work is done
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection',    'keep-alive')
      res.flushHeaders()

      const gen = this.#llm.chatStream(
        body.message,
        historyBeforeCurrent,
        patientContext,
        abort.signal,
      )

      let reply   = ''
      let sources: string[] = []

      for await (const chunk of gen) {
        if (chunk.type === 'token') {
          res.write(`data: ${JSON.stringify({ type: 'token', value: chunk.value })}\n\n`)
        } else {
          reply   = chunk.reply
          sources = chunk.sources
        }
      }

      await this.#sessions.addMessage(chatId, 'assistant', reply)
      this.#sessions.clearAbort(chatId)

      res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`)
      res.end()
    } catch (err: unknown) {
      if (chatId) this.#sessions.clearAbort(chatId)

      const isAbort = err instanceof Error && err.name === 'AbortError'

      // If SSE headers are already flushed we can no longer change the HTTP status —
      // send an error event over the stream instead.
      if (res.headersSent) {
        const msg = isAbort
          ? 'Requisição cancelada pelo cliente.'
          : 'Erro interno ao processar a mensagem.'
        res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`)
        res.end()
        return
      }

      if (isAbort) {
        res.status(499).json({ error: 'Requisição cancelada pelo cliente.' })
        return
      }

      next(err)
    }
  }

  /**
   * POST /chat/message/delete
   * Remove uma mensagem específica do histórico pelo índice.
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
