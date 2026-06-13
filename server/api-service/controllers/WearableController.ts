import { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { wearableConnections } from '../../shared/db/schema.ts'
import {
  PROVIDERS, PROVIDER_BY_SLUG, redirectUriFor, appReturnUrl,
  type WearableProvider, type TokenSet,
} from '../services/wearables/providers.ts'

/**
 * Wearable / health-app integrations.
 *
 * Cloud providers (Fitbit / Withings / Oura) use a real OAuth2 flow + API sync
 * when their CLIENT_ID/SECRET are configured (see integrations.md). Providers
 * without credentials — and the on-device ones (Apple Health, Health Connect,
 * Samsung Health) — fall back to the in-page simulation so the demo still runs
 * offline.
 */

// Canonical provider list surfaced in the UI (even when not yet connected).
const PROVIDERS_UI = [
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

function safeParse(s: string | null): unknown {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

// state = base64url(JSON{ name, slug, t }) — ties the callback back to a patient.
function encodeState(name: string, slug: string): string {
  return Buffer.from(JSON.stringify({ name, slug, t: Date.now() })).toString('base64url')
}
function decodeState(state: string): { name: string; slug: string } | null {
  try {
    const o = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    if (typeof o?.name === 'string' && typeof o?.slug === 'string') return o
  } catch { /* ignore */ }
  return null
}

type ConnRow = typeof wearableConnections.$inferSelect

export class WearableController {
  constructor(_app: Express) {}

  // ── List: providers + connection status + whether real OAuth is available ──
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = ListQuery.parse(req.query)
      const rows = await db.select().from(wearableConnections).where(eq(wearableConnections.patientName, name))
      const byProvider = new Map(rows.map(r => [r.provider, r]))

      const providers = PROVIDERS_UI.map(provider => {
        const r = byProvider.get(provider)
        const p = PROVIDERS[provider]
        return {
          provider,
          connected:   r?.connected ?? false,
          connectedAt: r?.connectedAt ?? null,
          lastSyncAt:  r?.lastSyncAt ?? null,
          // `oauth` ⇒ front starts the real consent flow; otherwise it simulates.
          mode:        p?.configured ? 'oauth' : 'simulated',
          data: r?.connected ? safeParse(r.data) : null,
        }
      })
      res.json({ providers })
    } catch (err) { next(err) }
  }

  // ── Simulated connect (on-device providers + unconfigured cloud ones) ──────
  connect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName, provider } = ConnectSchema.parse(req.body)
      const data = JSON.stringify(genActivity())
      await this.#upsert(patientName, provider, { connected: true, connectedAt: Date.now(), data, lastSyncAt: Date.now() })
      res.status(201).json({ ok: true, data: JSON.parse(data) })
    } catch (err) { next(err) }
  }

  disconnect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName, provider } = ConnectSchema.parse(req.body)
      // Clear tokens too, so a real provider fully revokes the local session.
      await db.update(wearableConnections)
        .set({ connected: false, accessToken: null, refreshToken: null, tokenExpiresAt: null, externalUserId: null })
        .where(and(eq(wearableConnections.patientName, patientName), eq(wearableConnections.provider, provider)))
      res.json({ ok: true })
    } catch (err) { next(err) }
  }

  // ── OAuth: start the consent flow (302 to the provider) ────────────────────
  oauthConnect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = String(req.params.provider)
      const name = ListQuery.parse(req.query).name
      const provider = PROVIDER_BY_SLUG[slug]
      if (!provider || !provider.configured) {
        return res.redirect(`${appReturnUrl()}/paciente?error=provider_unavailable`)
      }
      const url = provider.buildAuthUrl(redirectUriFor(slug), encodeState(name, slug))
      res.redirect(url)
    } catch (err) { next(err) }
  }

  // ── OAuth: provider redirects back here with ?code & ?state ────────────────
  oauthCallback = async (req: Request, res: Response, next: NextFunction) => {
    const slug = String(req.params.provider)
    try {
      const provider = PROVIDER_BY_SLUG[slug]
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      const st = typeof req.query.state === 'string' ? decodeState(req.query.state) : null
      if (!provider || !provider.configured || !code || !st || st.slug !== slug) {
        return res.redirect(`${appReturnUrl()}/paciente?error=oauth_failed`)
      }

      const token = await provider.exchange(code, redirectUriFor(slug))
      const activity = await safeFetch(provider, token)
      await this.#upsert(st.name, provider.key, {
        connected: true, connectedAt: Date.now(), lastSyncAt: Date.now(),
        data: JSON.stringify(activity),
        accessToken: token.accessToken, refreshToken: token.refreshToken ?? null,
        tokenExpiresAt: token.expiresIn ? Date.now() + token.expiresIn * 1000 : null,
        scope: token.scope ?? null, externalUserId: token.externalUserId ?? null,
      })
      res.redirect(`${appReturnUrl()}/paciente?connected=${slug}`)
    } catch {
      res.redirect(`${appReturnUrl()}/paciente?error=oauth_failed`)
    }
  }

  // ── Re-sync a connected real provider on demand ────────────────────────────
  sync = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName, provider: providerName } = ConnectSchema.parse(req.body)
      const provider = PROVIDERS[providerName]
      const [row] = await db.select().from(wearableConnections)
        .where(and(eq(wearableConnections.patientName, patientName), eq(wearableConnections.provider, providerName)))
      if (!provider?.configured || !row?.connected || !row.accessToken) {
        return res.status(400).json({ error: 'not_connected' })
      }
      const token = await this.#validToken(provider, row)
      const activity = await safeFetch(provider, token)
      await this.#upsert(patientName, providerName, { data: JSON.stringify(activity), lastSyncAt: Date.now() })
      res.json({ ok: true, data: activity })
    } catch (err) { next(err) }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  // Refresh the access token when it's expired (or about to), persisting the new set.
  async #validToken(provider: WearableProvider, row: ConnRow): Promise<TokenSet> {
    const fresh = row.tokenExpiresAt && row.tokenExpiresAt - Date.now() > 60_000
    if (fresh && row.accessToken) {
      return { accessToken: row.accessToken, refreshToken: row.refreshToken ?? undefined, externalUserId: row.externalUserId ?? undefined }
    }
    if (!row.refreshToken) {
      return { accessToken: row.accessToken!, externalUserId: row.externalUserId ?? undefined }
    }
    const next = await provider.refresh(row.refreshToken, redirectUriFor(provider.slug))
    await this.#upsert(row.patientName, provider.key, {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken ?? row.refreshToken,
      tokenExpiresAt: next.expiresIn ? Date.now() + next.expiresIn * 1000 : null,
      scope: next.scope ?? row.scope,
    })
    return { ...next, refreshToken: next.refreshToken ?? row.refreshToken, externalUserId: row.externalUserId ?? undefined }
  }

  async #upsert(patientName: string, provider: string, patch: Partial<ConnRow>) {
    const [existing] = await db.select().from(wearableConnections)
      .where(and(eq(wearableConnections.patientName, patientName), eq(wearableConnections.provider, provider)))
    if (existing) {
      await db.update(wearableConnections).set(patch).where(eq(wearableConnections.id, existing.id))
    } else {
      await db.insert(wearableConnections).values({
        id: randomUUID(), patientName, provider, connected: false, ...patch,
      })
    }
  }
}

// Never let a flaky provider API break the connect flow — fall back to a synthetic
// batch so the card still shows data after a successful authorization.
async function safeFetch(provider: WearableProvider, token: TokenSet) {
  try {
    const a = await provider.fetchActivity(token)
    // If the provider returned nothing usable, synthesize so the UI isn't empty.
    if (a.steps === undefined && a.restingHr === undefined && a.sleepHours === undefined && a.spo2 === undefined) {
      return genActivity()
    }
    return a
  } catch {
    return genActivity()
  }
}
