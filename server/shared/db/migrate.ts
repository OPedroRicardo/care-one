/**
 * Idempotent, PoC-friendly schema provisioning run at API startup.
 *
 * Mirrors the column definitions in schema.ts using `CREATE TABLE IF NOT EXISTS`
 * (and guarded `ALTER TABLE ADD COLUMN`) so the demo always boots with every
 * table present — no manual `drizzle-kit push` step required before a
 * presentation. For a production system you'd replace this with real, versioned
 * migrations.
 */
import { db } from './index.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = () => (db as any).$client as { execute(sql: string): Promise<unknown> }

async function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    await client().execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch {
    // Column already exists (SQLite throws "duplicate column name") — ignore.
  }
}

export async function ensureSchema() {
  const c = client()

  // Stage 3 — canonical patient profiles
  await c.execute(`
    CREATE TABLE IF NOT EXISTS patients (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL UNIQUE,
      date_of_birth TEXT,
      sex           TEXT,
      plan_tier     TEXT,
      phone         TEXT,
      email         TEXT,
      address       TEXT,
      allergies     TEXT,
      created_at    INTEGER NOT NULL
    )
  `)

  // Stage 6 — exam attachments on the patient↔doctor conversation
  await addColumnIfMissing('patient_messages', 'attachment_exam_id', 'TEXT')

  // Stage 7 — notifications / recommendations center
  await c.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id                TEXT    PRIMARY KEY,
      recipient_role    TEXT    NOT NULL,
      recipient_name    TEXT,
      type              TEXT    NOT NULL,
      title             TEXT    NOT NULL,
      body              TEXT    NOT NULL,
      related_entity_id TEXT,
      read              INTEGER NOT NULL DEFAULT 0,
      created_at        INTEGER NOT NULL
    )
  `)

  // Stage 8 — wearable / health-app connections
  await c.execute(`
    CREATE TABLE IF NOT EXISTS wearable_connections (
      id           TEXT    PRIMARY KEY,
      patient_name TEXT    NOT NULL,
      provider     TEXT    NOT NULL,
      connected    INTEGER NOT NULL DEFAULT 0,
      connected_at INTEGER,
      data         TEXT
    )
  `)
  await addColumnIfMissing('wearable_connections', 'data', 'TEXT')
}
