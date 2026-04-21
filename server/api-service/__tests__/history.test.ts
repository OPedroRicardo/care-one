import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { createApp } from '../app.ts'
import { initTestDb } from './db-helpers.ts'
import { db } from '../../shared/db/index.ts'
import { historyRecords } from '../../shared/db/schema.ts'

type App = Awaited<ReturnType<typeof createApp>>
let app: App

beforeAll(async () => {
  await initTestDb()
  app = await createApp()
})

afterEach(async () => {
  // Limpa registros entre testes para garantir isolamento
  await db.delete(historyRecords)
})

// Insere um registro de histórico com valores padrão (sobreponíveis via overrides)
async function criarRegistro(overrides: Partial<typeof historyRecords.$inferInsert> = {}) {
  const record = {
    id:          randomUUID(),
    type:        'triagem' as const,
    patientName: 'Paciente Teste',
    date:        Date.now(),
    summary:     'Resumo de teste',
    details:     JSON.stringify({ fr: 16, fc: 70, spo2: 97 }),
    createdAt:   Date.now(),
    ...overrides,
  }
  await db.insert(historyRecords).values(record)
  return record
}

describe('GET /app/history', () => {
  it('retorna lista vazia quando não há registros', async () => {
    const res = await request(app).get('/app/history')
    expect(res.status).toBe(200)
    expect(res.body.records).toEqual([])
  })

  it('retorna todos os registros existentes', async () => {
    await criarRegistro()
    await criarRegistro()
    const res = await request(app).get('/app/history')
    expect(res.status).toBe(200)
    expect(res.body.records).toHaveLength(2)
  })

  it('ordena por data decrescente (mais recente primeiro)', async () => {
    const antigo  = await criarRegistro({ date: 1_000_000 })
    const recente = await criarRegistro({ date: 9_000_000 })

    const res = await request(app).get('/app/history')
    expect(res.body.records[0].id).toBe(recente.id)
    expect(res.body.records[1].id).toBe(antigo.id)
  })

  it('cada registro retorna os campos esperados', async () => {
    const r = await criarRegistro()
    const res = await request(app).get('/app/history')
    const rec = res.body.records[0]

    expect(rec).toHaveProperty('id', r.id)
    expect(rec).toHaveProperty('type', 'triagem')
    expect(rec).toHaveProperty('patientName')
    expect(rec).toHaveProperty('date')
    expect(rec).toHaveProperty('summary')
    expect(rec).toHaveProperty('createdAt')
    // details NÃO é retornado no listing
    expect(rec).not.toHaveProperty('details')
  })

  describe('filtro por tipo', () => {
    beforeAll(async () => {
      await criarRegistro({ type: 'triagem' })
      await criarRegistro({ type: 'triagem' })
      await criarRegistro({ type: 'exame' })
    })

    it('?type=triagem retorna apenas triagens', async () => {
      const res = await request(app).get('/app/history?type=triagem')
      expect(res.status).toBe(200)
      expect(res.body.records.every((r: { type: string }) => r.type === 'triagem')).toBe(true)
    })

    it('?type=exame retorna apenas exames', async () => {
      const res = await request(app).get('/app/history?type=exame')
      expect(res.status).toBe(200)
      expect(res.body.records.every((r: { type: string }) => r.type === 'exame')).toBe(true)
    })

    it('?type=invalido retorna >= 400', async () => {
      const res = await request(app).get('/app/history?type=invalido')
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('GET /app/history/:id', () => {
  it('retorna o registro completo com details parseado como objeto', async () => {
    const record = await criarRegistro()

    const res = await request(app).get(`/app/history/${record.id}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(record.id)
    expect(res.body.type).toBe('triagem')
    expect(res.body.details).toEqual({ fr: 16, fc: 70, spo2: 97 })
  })

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app).get(`/app/history/${randomUUID()}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBeDefined()
  })

  it('retorna o registro certo quando há múltiplos registros', async () => {
    const r1 = await criarRegistro({ summary: 'Primeiro' })
    const r2 = await criarRegistro({ summary: 'Segundo' })

    const res = await request(app).get(`/app/history/${r2.id}`)
    expect(res.body.id).toBe(r2.id)
    expect(res.body.summary).toBe('Segundo')
    expect(res.body.id).not.toBe(r1.id)
  })
})
