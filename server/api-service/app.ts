import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import dotenv from 'dotenv'

import { APIRouter } from '@api-service/routes/api-router.ts'

dotenv.config()

export async function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({
    origin: (origin, callback) => {
      const { ALLOWED_ORIGINS } = process.env
      if (!origin || !ALLOWED_ORIGINS) return callback(null, true);

      const isAllowedOrigin = ALLOWED_ORIGINS?.split(',').map(o => o.trim()).includes(origin)

      if (!isAllowedOrigin) {
        const msg = `This site ${origin} does not have an access. Only specific domains are allowed to access it.`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }))
  app.use(express.json())

  const router = new APIRouter(app)
  await router.mount()

  return app
}
