import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.ts'

const client = createClient({
  url: process.env.DB_PATH ?? 'file:./careplus.db',
})

export const db = drizzle(client, { schema })
