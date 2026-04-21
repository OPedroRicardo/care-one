import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.ts'

type App = Awaited<ReturnType<typeof createApp>>
let app: App

beforeAll(async () => {
  app = await createApp()
})

describe('Health checks', () => {
  it('GET / retorna 200 OK', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'OK' })
  })

  it('GET /app retorna 200 OK', async () => {
    const res = await request(app).get('/app')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'OK' })
  })

  it('GET /totem retorna 200 OK', async () => {
    const res = await request(app).get('/totem')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'OK' })
  })

  it('GET /totem/score retorna 200 OK', async () => {
    const res = await request(app).get('/totem/score')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'OK' })
  })

  it('GET /app/auth retorna 200 OK', async () => {
    const res = await request(app).get('/app/auth')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'OK' })
  })

  it('rota inexistente retorna 404', async () => {
    const res = await request(app).get('/rota-que-nao-existe')
    expect(res.status).toBe(404)
  })
})
