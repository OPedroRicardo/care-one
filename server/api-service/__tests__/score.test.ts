import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.ts'

type App = Awaited<ReturnType<typeof createApp>>
let app: App

beforeAll(async () => {
  app = await createApp()
})

// Sinais vitais com todos os parâmetros dentro da faixa normal (score total = 0)
const VITAIS_NORMAIS = {
  fr: 16,       // 12-20 → score 0
  fc: 70,       // 51-90 → score 0
  spo2: 97,     // >=96  → score 0
  temp: 37.0,   // 36.1-38.0 → score 0
  pa: 120,      // 111-219 → score 0
  oxygen: false,
  hipercapnia: false,
}

describe('POST /totem/score/news2', () => {
  describe('sinais vitais normais', () => {
    it('retorna status 200', async () => {
      const res = await request(app).post('/totem/score/news2').send(VITAIS_NORMAIS)
      expect(res.status).toBe(200)
    })

    it('retorna score total 0 para todos os parâmetros normais', async () => {
      const res = await request(app).post('/totem/score/news2').send(VITAIS_NORMAIS)
      expect(res.body.score.total).toBe(0)
      expect(res.body.score.fr).toBe(0)
      expect(res.body.score.fc).toBe(0)
      expect(res.body.score.spo2).toBe(0)
      expect(res.body.score.temp).toBe(0)
      expect(res.body.score.pa).toBe(0)
      expect(res.body.score.airOxygen).toBe(0)
    })
  })

  describe('oxigênio suplementar', () => {
    it('adiciona 2 pontos quando oxygen=true', async () => {
      const res = await request(app)
        .post('/totem/score/news2')
        .send({ ...VITAIS_NORMAIS, oxygen: true })
      expect(res.body.score.airOxygen).toBe(2)
      expect(res.body.score.total).toBe(2)
    })

    it('não adiciona pontos quando oxygen=false', async () => {
      const res = await request(app)
        .post('/totem/score/news2')
        .send({ ...VITAIS_NORMAIS, oxygen: false })
      expect(res.body.score.airOxygen).toBe(0)
    })
  })

  describe('frequência respiratória (fr)', () => {
    it('fr 9-11 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fr: 10 })
      expect(res.body.score.fr).toBe(1)
    })

    it('fr 21-24 → score 2', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fr: 22 })
      expect(res.body.score.fr).toBe(2)
    })

    it('fr <=8 ou >=25 → score 3', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fr: 7 })
      expect(res.body.score.fr).toBe(3)
    })
  })

  describe('frequência cardíaca (fc)', () => {
    it('fc 41-50 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fc: 45 })
      expect(res.body.score.fc).toBe(1)
    })

    it('fc 111-130 → score 2', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fc: 120 })
      expect(res.body.score.fc).toBe(2)
    })

    it('fc <=40 → score 3', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, fc: 30 })
      expect(res.body.score.fc).toBe(3)
    })
  })

  describe('temperatura (temp)', () => {
    it('temp 35.1-36.0 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, temp: 35.5 })
      expect(res.body.score.temp).toBe(1)
    })

    it('temp 38.1-39.0 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, temp: 38.5 })
      expect(res.body.score.temp).toBe(1)
    })

    it('temp >=39.1 → score 2', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, temp: 40 })
      expect(res.body.score.temp).toBe(2)
    })

    it('temp <=35.0 → score 3', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, temp: 34.9 })
      expect(res.body.score.temp).toBe(3)
    })
  })

  describe('saturação de oxigênio (spo2)', () => {
    it('spo2 94-95 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, spo2: 94 })
      expect(res.body.score.spo2).toBe(1)
    })

    it('spo2 92-93 → score 2', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, spo2: 92 })
      expect(res.body.score.spo2).toBe(2)
    })

    it('spo2 <=91 → score 3', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, spo2: 90 })
      expect(res.body.score.spo2).toBe(3)
    })
  })

  describe('pressão arterial sistólica (pa)', () => {
    it('pa 101-110 → score 1', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, pa: 105 })
      expect(res.body.score.pa).toBe(1)
    })

    it('pa 91-100 → score 2', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, pa: 95 })
      expect(res.body.score.pa).toBe(2)
    })

    it('pa <=90 ou >=220 → score 3', async () => {
      const res = await request(app).post('/totem/score/news2').send({ ...VITAIS_NORMAIS, pa: 80 })
      expect(res.body.score.pa).toBe(3)
    })
  })

  describe('validação do body', () => {
    it('retorna >= 400 quando campo obrigatório está faltando', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fr, ...semFr } = VITAIS_NORMAIS
      const res = await request(app).post('/totem/score/news2').send(semFr)
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('retorna >= 400 quando campo tem tipo errado', async () => {
      const res = await request(app)
        .post('/totem/score/news2')
        .send({ ...VITAIS_NORMAIS, fr: 'rápido' })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('retorna >= 400 para body vazio', async () => {
      const res = await request(app).post('/totem/score/news2').send({})
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})
