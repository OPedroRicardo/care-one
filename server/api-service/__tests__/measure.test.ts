import { vi, describe, it, expect, beforeAll } from 'vitest'

// Mock do ValkeyPublisher — evita conexão real com o Valkey/Redis
vi.mock('../services/ValkeyPublisher.ts', () => ({
  VALKEY_MEASURE_CHANNEL: 'measure:start',
  getValkeyPublisher: vi.fn().mockResolvedValue({
    publish: vi.fn().mockResolvedValue(1),
  }),
}))

import request from 'supertest'
import { createApp } from '../app.ts'

type App = Awaited<ReturnType<typeof createApp>>
let app: App

beforeAll(async () => {
  app = await createApp()
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('POST /totem/measure', () => {
  describe('requisição válida', () => {
    it('retorna 202 Accepted', async () => {
      const res = await request(app).post('/totem/measure').send({ patientName: 'João Silva' })
      expect(res.status).toBe(202)
    })

    it('retorna sessionId no formato UUID', async () => {
      const res = await request(app).post('/totem/measure').send({ patientName: 'Maria Santos' })
      expect(res.body.sessionId).toMatch(UUID_RE)
    })

    it('retorna mensagem de confirmação', async () => {
      const res = await request(app).post('/totem/measure').send({ patientName: 'Carlos Lima' })
      expect(res.body.message).toBeDefined()
      expect(typeof res.body.message).toBe('string')
    })

    it('cada chamada gera um sessionId único', async () => {
      const [r1, r2] = await Promise.all([
        request(app).post('/totem/measure').send({ patientName: 'Paciente A' }),
        request(app).post('/totem/measure').send({ patientName: 'Paciente B' }),
      ])
      expect(r1.body.sessionId).not.toBe(r2.body.sessionId)
    })
  })

  describe('validação do body', () => {
    it('retorna >= 400 quando patientName está ausente', async () => {
      const res = await request(app).post('/totem/measure').send({})
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('retorna >= 400 quando patientName é string vazia', async () => {
      const res = await request(app).post('/totem/measure').send({ patientName: '' })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('retorna >= 400 para body vazio', async () => {
      const res = await request(app).post('/totem/measure').send()
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})
