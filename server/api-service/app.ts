import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'

import { APIRouter } from '@api-service/routes/api-router.ts'

dotenv.config()

export async function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS }))
  app.use(express.json())

  const router = new APIRouter(app)
  await router.mount()

  return app
}
