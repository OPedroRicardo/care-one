import { defineConfig } from 'drizzle-kit'
import dotenv from 'dotenv'
dotenv.config()

export default defineConfig({
  schema:  './shared/db/schema.ts',
  out:     './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DB_PATH ?? 'file:./careplus.db',
  },
})
