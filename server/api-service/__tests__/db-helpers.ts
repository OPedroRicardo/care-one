import { db } from '../../shared/db/index.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = () => (db as any).$client as { execute(sql: string): Promise<unknown> }

/**
 * Cria todas as tabelas no banco :memory: (que inicia vazio).
 * Deve ser chamado em beforeAll em cada suite que usa o DB.
 */
export async function initTestDb() {
  const c = client()
  await c.execute(`
    CREATE TABLE IF NOT EXISTS chats (
      id         TEXT    PRIMARY KEY,
      created_at INTEGER NOT NULL
    )
  `)
  await c.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id    TEXT    NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
  await c.execute(`
    CREATE TABLE IF NOT EXISTS history_records (
      id           TEXT    PRIMARY KEY,
      type         TEXT    NOT NULL,
      patient_name TEXT    NOT NULL,
      date         INTEGER NOT NULL,
      summary      TEXT    NOT NULL,
      details      TEXT    NOT NULL,
      created_at   INTEGER NOT NULL
    )
  `)
}
