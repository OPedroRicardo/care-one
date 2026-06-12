import { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { wearableConnections } from '../../shared/db/schema.ts'

/**
 * Simulated wearable / health-app integrations.
 *
 * Real OAuth (Fitbit/Withings/Oura) is out of scope for a sales-pitch PoC — see
 * the research table in prompt.md. "Connecting" is an instant, in-page state
 * change: we flip the connection flag and generate a synthetic activity batch
 * locally (no external redirect/popup), so this works fully offline during a
 * live demo. Production would replace this with a real OAuth2 + token store.
 */

// Canonical provider list surfaced in the UI (even when not yet connected).
const PROVIDERS = [
  'Apple Health', 'Health Connect', 'Fitbit', 'Garmin', 'Samsung Health', 'Withings', 'Oura',
]

const ConnectSchema = z.object({
  patientName: z.string().min(1),
  provider:    z.string().min(1),
})
const ListQuery = z.object({ name: z.string().min(1) })

function rand(lo: number, hi: number) { return Math.round(lo + Math.random() * (hi - lo)) }

function genActivity() {
  return {
    steps:      rand(4200, 12500),
    restingHr:  rand(54, 74),
    sleepHours: Math.round((6 + Math.random() * 2.6) * 10) / 10,
    spo2:       rand(96, 99),
    updatedAt:  Date.now(),
  }
}

export class WearableController {
  constructor(_app: Express) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = ListQuery.parse(req.query)
      const rows = await db.select().from(wearableConnections).where(eq(wearableConnections.patientName, name))
      const byProvider = new Map(rows.map(r => [r.provider, r]))

      const providers = PROVIDERS.map(provider => {
        const r = byProvider.get(provider)
        return {
          provider,
          connected:   r?.connected ?? false,
          connectedAt: r?.connectedAt ?? null,
          data: r?.connected && r.data ? safeParse(r.data) : null,
        }
      })
      res.json({ providers })
    } catch (err) { next(err) }
  }

  connect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName, provider } = ConnectSchema.parse(req.body)
      const data = JSON.stringify(genActivity())
      const [existing] = await db.select().from(wearableConnections)
        .where(and(eq(wearableConnections.patientName, patientName), eq(wearableConnections.provider, provider)))

      if (existing) {
        await db.update(wearableConnections)
          .set({ connected: true, connectedAt: Date.now(), data })
          .where(eq(wearableConnections.id, existing.id))
      } else {
        await db.insert(wearableConnections).values({
          id: randomUUID(), patientName, provider, connected: true, connectedAt: Date.now(), data,
        })
      }
      res.status(201).json({ ok: true, data: JSON.parse(data) })
    } catch (err) { next(err) }
  }

  disconnect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName, provider } = ConnectSchema.parse(req.body)
      await db.update(wearableConnections)
        .set({ connected: false })
        .where(and(eq(wearableConnections.patientName, patientName), eq(wearableConnections.provider, provider)))
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
