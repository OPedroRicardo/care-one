import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'

// Mock do LLM e do RAG — evita conexão com Ollama
vi.mock('../services/LLMChatService.ts', () => ({
  LLMChatService: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      reply: 'Resposta de teste do assistente.',
      sources: ['careplus.md'],
    }),
  })),
}))

vi.mock('../services/RagService.ts', () => ({
  RagService: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([]),
  })),
}))

import request from 'supertest'

import { createApp } from '../app.ts'
import { initTestDb } from './db-helpers.ts'
import { db } from '../../shared/db/index.ts'
import { chats, messages } from '../../shared/db/schema.ts'

type App = Awaited<ReturnType<typeof createApp>>
let app: App

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_ZERO = '00000000-0000-0000-0000-000000000000'

beforeAll(async () => {
  await initTestDb()
  app = await createApp()
})

afterEach(async () => {
  // Cascade apaga messages também (FK ON DELETE CASCADE)
  await db.delete(messages)
  await db.delete(chats)
})

// Helper: cria um chat e retorna o chatId
async function criarChat(context?: string): Promise<string> {
  const res = await request(app)
    .post('/app/chat/new')
    .send(context !== undefined ? { context } : {})
  expect(res.status).toBe(201)
  return res.body.chatId
}

// Helper: envia uma mensagem e retorna a resposta
async function enviarMensagem(chatId: string, message: string) {
  return request(app).post('/app/chat/message').send({ chatId, message })
}

// ─────────────────────────────────────────────
// GET /app/chat/list
// ─────────────────────────────────────────────
describe('GET /app/chat/list', () => {
  it('retorna lista vazia quando não há sessões', async () => {
    const res = await request(app).get('/app/chat/list')
    expect(res.status).toBe(200)
    expect(res.body.chats).toEqual([])
  })

  it('retorna as sessões criadas', async () => {
    await criarChat()
    await criarChat()
    const res = await request(app).get('/app/chat/list')
    expect(res.status).toBe(200)
    expect(res.body.chats).toHaveLength(2)
  })

  it('cada item contém id, createdAt e preview', async () => {
    await criarChat()
    const res = await request(app).get('/app/chat/list')
    const item = res.body.chats[0]
    expect(item).toHaveProperty('id')
    expect(item).toHaveProperty('createdAt')
    expect(item).toHaveProperty('preview')
  })

  it('preview é a primeira mensagem do usuário (ou null)', async () => {
    const chatId = await criarChat()
    await enviarMensagem(chatId, 'Qual meu diagnóstico?')

    const res = await request(app).get('/app/chat/list')
    const item = res.body.chats.find((c: { id: string }) => c.id === chatId)
    expect(item.preview).toBe('Qual meu diagnóstico?')
  })
})

// ─────────────────────────────────────────────
// POST /app/chat/new
// ─────────────────────────────────────────────
describe('POST /app/chat/new', () => {
  it('retorna 201 com chatId no formato UUID', async () => {
    const res = await request(app).post('/app/chat/new').send({})
    expect(res.status).toBe(201)
    expect(res.body.chatId).toMatch(UUID_RE)
  })

  it('cada chamada gera um chatId único', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/app/chat/new').send({}),
      request(app).post('/app/chat/new').send({}),
    ])
    expect(r1.body.chatId).not.toBe(r2.body.chatId)
  })

  it('com context injeta mensagem do assistente no histórico', async () => {
    const chatId = await criarChat('Sinais vitais: fr=16, fc=70')

    const res = await request(app).get(`/app/chat/${chatId}`)
    expect(res.body.history).toHaveLength(1)
    expect(res.body.history[0].role).toBe('assistant')
    expect(res.body.history[0].content).toContain('Sinais vitais: fr=16, fc=70')
  })

  it('sem context o histórico começa vazio', async () => {
    const chatId = await criarChat()
    const res = await request(app).get(`/app/chat/${chatId}`)
    expect(res.body.history).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// GET /app/chat/:id
// ─────────────────────────────────────────────
describe('GET /app/chat/:id', () => {
  it('retorna o chat com id, createdAt e history', async () => {
    const chatId = await criarChat()

    const res = await request(app).get(`/app/chat/${chatId}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(chatId)
    expect(res.body).toHaveProperty('createdAt')
    expect(res.body.history).toEqual([])
  })

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app).get(`/app/chat/${UUID_ZERO}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('retorna >= 400 para id que não é UUID', async () => {
    const res = await request(app).get('/app/chat/nao-e-uuid')
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// ─────────────────────────────────────────────
// POST /app/chat/message
// ─────────────────────────────────────────────
describe('POST /app/chat/message', () => {
  it('retorna 200 com reply e sources', async () => {
    const chatId = await criarChat()
    const res = await enviarMensagem(chatId, 'Quais são os meus sinais vitais?')

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Resposta de teste do assistente.')
    expect(res.body.sources).toContain('careplus.md')
  })

  it('persiste mensagem do usuário e resposta do assistente no histórico', async () => {
    const chatId = await criarChat()
    await enviarMensagem(chatId, 'Primeira pergunta?')

    const chat = await request(app).get(`/app/chat/${chatId}`)
    expect(chat.body.history).toHaveLength(2)
    expect(chat.body.history[0].role).toBe('user')
    expect(chat.body.history[0].content).toBe('Primeira pergunta?')
    expect(chat.body.history[1].role).toBe('assistant')
  })

  it('acumula múltiplas rodadas no histórico', async () => {
    const chatId = await criarChat()
    await enviarMensagem(chatId, 'Pergunta 1')
    await enviarMensagem(chatId, 'Pergunta 2')

    const chat = await request(app).get(`/app/chat/${chatId}`)
    expect(chat.body.history).toHaveLength(4) // 2 user + 2 assistant
  })

  it('retorna 404 para chatId inexistente', async () => {
    const res = await enviarMensagem(UUID_ZERO, 'Olá')
    expect(res.status).toBe(404)
  })

  it('retorna >= 400 para mensagem vazia', async () => {
    const chatId = await criarChat()
    const res = await enviarMensagem(chatId, '')
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('retorna >= 400 para mensagem acima de 2000 caracteres', async () => {
    const chatId = await criarChat()
    const res = await enviarMensagem(chatId, 'x'.repeat(2001))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('retorna >= 400 para chatId inválido (não UUID)', async () => {
    const res = await request(app)
      .post('/app/chat/message')
      .send({ chatId: 'nao-e-uuid', message: 'Oi' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// ─────────────────────────────────────────────
// POST /app/chat/delete
// ─────────────────────────────────────────────
describe('POST /app/chat/delete', () => {
  it('remove o chat e retorna { ok: true }', async () => {
    const chatId = await criarChat()

    const res = await request(app).post('/app/chat/delete').send({ chatId })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('após deletar, GET /chat/:id retorna 404', async () => {
    const chatId = await criarChat()
    await request(app).post('/app/chat/delete').send({ chatId })

    const res = await request(app).get(`/app/chat/${chatId}`)
    expect(res.status).toBe(404)
  })

  it('retorna 404 ao tentar deletar chat inexistente', async () => {
    const res = await request(app).post('/app/chat/delete').send({ chatId: UUID_ZERO })
    expect(res.status).toBe(404)
  })

  it('retorna >= 400 para chatId inválido', async () => {
    const res = await request(app).post('/app/chat/delete').send({ chatId: 'invalido' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// ─────────────────────────────────────────────
// POST /app/chat/message/delete
// ─────────────────────────────────────────────
describe('POST /app/chat/message/delete', () => {
  it('remove a mensagem pelo índice e retorna { ok: true }', async () => {
    const chatId = await criarChat()
    await enviarMensagem(chatId, 'Mensagem a ser deletada')

    const antes = await request(app).get(`/app/chat/${chatId}`)
    expect(antes.body.history).toHaveLength(2)

    const res = await request(app)
      .post('/app/chat/message/delete')
      .send({ chatId, index: 0 })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const depois = await request(app).get(`/app/chat/${chatId}`)
    expect(depois.body.history).toHaveLength(1)
  })

  it('retorna 400 para índice fora do range', async () => {
    const chatId = await criarChat()

    const res = await request(app)
      .post('/app/chat/message/delete')
      .send({ chatId, index: 999 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('retorna 404 para chatId inexistente', async () => {
    const res = await request(app)
      .post('/app/chat/message/delete')
      .send({ chatId: UUID_ZERO, index: 0 })
    expect(res.status).toBe(404)
  })

  it('retorna >= 400 para índice não inteiro', async () => {
    const chatId = await criarChat()
    const res = await request(app)
      .post('/app/chat/message/delete')
      .send({ chatId, index: 1.5 })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// ─────────────────────────────────────────────
// POST /app/chat/message/cancel
// ─────────────────────────────────────────────
describe('POST /app/chat/message/cancel', () => {
  it('retorna { cancelled: false } quando não há chamada LLM em andamento', async () => {
    const chatId = await criarChat()

    const res = await request(app)
      .post('/app/chat/message/cancel')
      .send({ chatId })

    expect(res.status).toBe(200)
    expect(res.body.cancelled).toBe(false)
  })

  it('retorna 404 para chatId inexistente', async () => {
    const res = await request(app)
      .post('/app/chat/message/cancel')
      .send({ chatId: UUID_ZERO })
    expect(res.status).toBe(404)
  })

  it('retorna >= 400 para chatId inválido', async () => {
    const res = await request(app)
      .post('/app/chat/message/cancel')
      .send({ chatId: 'nao-uuid' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
