/**
 * Real cloud-API wearable providers (Fitbit, Withings, Oura) — the web-feasible
 * integrations from integrations.md.
 *
 * Each provider is an OAuth2 client: build consent URL → exchange code for tokens
 * → fetch + normalize activity data. Everything is driven by env credentials; a
 * provider whose CLIENT_ID/SECRET aren't set reports `configured: false` and the
 * controller falls back to the existing in-page simulation (so the demo still
 * works offline).
 */

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresIn?: number          // seconds
  scope?: string
  externalUserId?: string
}

/** Normalized activity batch — superset of what the dashboard already renders. */
export interface NormalizedActivity {
  steps?: number
  restingHr?: number
  sleepHours?: number
  spo2?: number
  hrv?: number
  bloodPressure?: string      // "120/80"
  updatedAt: number
}

export interface WearableProvider {
  /** UI-facing name (matches the canonical PROVIDERS list). */
  key: string
  /** URL-safe slug used in routes (/wearables/:slug/connect). */
  slug: string
  get configured(): boolean
  buildAuthUrl(redirectUri: string, state: string): string
  exchange(code: string, redirectUri: string): Promise<TokenSet>
  refresh(refreshToken: string, redirectUri: string): Promise<TokenSet>
  fetchActivity(token: TokenSet): Promise<NormalizedActivity>
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function form(data: Record<string, string>): string {
  return new URLSearchParams(data).toString()
}

async function postForm(url: string, body: Record<string, string>, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: form(body),
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

// ── Fitbit ───────────────────────────────────────────────────────────────────

const fitbit: WearableProvider = {
  key: 'Fitbit',
  slug: 'fitbit',
  get configured() { return !!(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET) },

  buildAuthUrl(redirectUri, state) {
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.FITBIT_CLIENT_ID!,
      scope: 'activity heartrate sleep oxygen_saturation profile',
      redirect_uri: redirectUri,
      state,
    })
    return `https://www.fitbit.com/oauth2/authorize?${p}`
  },

  async exchange(code, redirectUri) {
    const basic = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64')
    const j = await postForm('https://api.fitbit.com/oauth2/token',
      { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
      { Authorization: `Basic ${basic}` })
    return {
      accessToken: String(j.access_token), refreshToken: j.refresh_token as string,
      expiresIn: num(j.expires_in), scope: j.scope as string, externalUserId: j.user_id as string,
    }
  },

  async refresh(refreshToken) {
    const basic = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64')
    const j = await postForm('https://api.fitbit.com/oauth2/token',
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      { Authorization: `Basic ${basic}` })
    return {
      accessToken: String(j.access_token), refreshToken: j.refresh_token as string,
      expiresIn: num(j.expires_in), scope: j.scope as string, externalUserId: j.user_id as string,
    }
  },

  async fetchActivity(token) {
    const out: NormalizedActivity = { updatedAt: Date.now() }
    const t = token.accessToken
    try {
      const a = await getJson('https://api.fitbit.com/1/user/-/activities/date/today.json', t)
      out.steps = num((a.summary as Record<string, unknown>)?.steps)
    } catch { /* ignore */ }
    try {
      const h = await getJson('https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json', t)
      const arr = h['activities-heart'] as Array<Record<string, unknown>> | undefined
      out.restingHr = num((arr?.[0]?.value as Record<string, unknown>)?.restingHeartRate)
    } catch { /* ignore */ }
    try {
      const s = await getJson('https://api.fitbit.com/1.2/user/-/sleep/date/today.json', t)
      const mins = num((s.summary as Record<string, unknown>)?.totalMinutesAsleep)
      if (mins !== undefined) out.sleepHours = Math.round((mins / 60) * 10) / 10
    } catch { /* ignore */ }
    try {
      const o = await getJson('https://api.fitbit.com/1/user/-/spo2/date/today.json', t)
      out.spo2 = num((o.value as Record<string, unknown>)?.avg)
    } catch { /* ignore */ }
    return out
  },
}

// ── Withings ─────────────────────────────────────────────────────────────────

const WITHINGS_TOKEN = 'https://wbsapi.withings.net/v2/oauth2'

const withings: WearableProvider = {
  key: 'Withings',
  slug: 'withings',
  get configured() { return !!(process.env.WITHINGS_CLIENT_ID && process.env.WITHINGS_CLIENT_SECRET) },

  buildAuthUrl(redirectUri, state) {
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.WITHINGS_CLIENT_ID!,
      scope: 'user.metrics,user.activity',
      redirect_uri: redirectUri,
      state,
    })
    return `https://account.withings.com/oauth2_user/authorize2?${p}`
  },

  async exchange(code, redirectUri) {
    const j = await postForm(WITHINGS_TOKEN, {
      action: 'requesttoken', grant_type: 'authorization_code',
      client_id: process.env.WITHINGS_CLIENT_ID!, client_secret: process.env.WITHINGS_CLIENT_SECRET!,
      code, redirect_uri: redirectUri,
    })
    const body = (j.body ?? {}) as Record<string, unknown>
    return {
      accessToken: String(body.access_token), refreshToken: body.refresh_token as string,
      expiresIn: num(body.expires_in), scope: body.scope as string, externalUserId: String(body.userid ?? ''),
    }
  },

  async refresh(refreshToken) {
    const j = await postForm(WITHINGS_TOKEN, {
      action: 'requesttoken', grant_type: 'refresh_token',
      client_id: process.env.WITHINGS_CLIENT_ID!, client_secret: process.env.WITHINGS_CLIENT_SECRET!,
      refresh_token: refreshToken,
    })
    const body = (j.body ?? {}) as Record<string, unknown>
    return {
      accessToken: String(body.access_token), refreshToken: body.refresh_token as string,
      expiresIn: num(body.expires_in), scope: body.scope as string, externalUserId: String(body.userid ?? ''),
    }
  },

  async fetchActivity(token) {
    const out: NormalizedActivity = { updatedAt: Date.now() }
    const t = token.accessToken
    // Activity (steps) — last 7 days, take most recent.
    try {
      const r = await fetch('https://wbsapi.withings.net/v2/measure', {
        method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ action: 'getactivity', startdateymd: daysAgo(7), enddateymd: today() }),
      }).then(r => r.json() as Promise<Record<string, unknown>>)
      const acts = ((r.body as Record<string, unknown>)?.activities as Array<Record<string, unknown>>) ?? []
      const last = acts[acts.length - 1]
      out.steps = num(last?.steps)
    } catch { /* ignore */ }
    // Measures (BP, SpO2, HR) — meastypes: 9=diastolic,10=systolic,11=HR,54=SpO2.
    try {
      const r = await fetch('https://wbsapi.withings.net/measure', {
        method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ action: 'getmeas', meastypes: '9,10,11,54', category: '1', lastupdate: String(Math.floor((Date.now() - 30 * 86_400_000) / 1000)) }),
      }).then(r => r.json() as Promise<Record<string, unknown>>)
      const groups = ((r.body as Record<string, unknown>)?.measuregrps as Array<Record<string, unknown>>) ?? []
      let sys: number | undefined, dia: number | undefined
      for (const g of groups) {
        for (const m of (g.measures as Array<Record<string, unknown>>) ?? []) {
          const val = num(m.value)
          const unit = num(m.unit) ?? 0
          if (val === undefined) continue
          const real = val * Math.pow(10, unit)
          if (m.type === 10 && sys === undefined) sys = Math.round(real)
          if (m.type === 9 && dia === undefined) dia = Math.round(real)
          if (m.type === 11 && out.restingHr === undefined) out.restingHr = Math.round(real)
          if (m.type === 54 && out.spo2 === undefined) out.spo2 = Math.round(real)
        }
      }
      if (sys && dia) out.bloodPressure = `${sys}/${dia}`
    } catch { /* ignore */ }
    return out
  },
}

// ── Oura ─────────────────────────────────────────────────────────────────────

const oura: WearableProvider = {
  key: 'Oura',
  slug: 'oura',
  get configured() { return !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET) },

  buildAuthUrl(redirectUri, state) {
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.OURA_CLIENT_ID!,
      scope: 'daily personal',
      redirect_uri: redirectUri,
      state,
    })
    return `https://cloud.ouraring.com/oauth/authorize?${p}`
  },

  async exchange(code, redirectUri) {
    const j = await postForm('https://api.ouraring.com/oauth/token', {
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID!, client_secret: process.env.OURA_CLIENT_SECRET!,
    })
    return {
      accessToken: String(j.access_token), refreshToken: j.refresh_token as string,
      expiresIn: num(j.expires_in), scope: j.scope as string,
    }
  },

  async refresh(refreshToken) {
    const j = await postForm('https://api.ouraring.com/oauth/token', {
      grant_type: 'refresh_token', refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID!, client_secret: process.env.OURA_CLIENT_SECRET!,
    })
    return {
      accessToken: String(j.access_token), refreshToken: j.refresh_token as string,
      expiresIn: num(j.expires_in), scope: j.scope as string,
    }
  },

  async fetchActivity(token) {
    const out: NormalizedActivity = { updatedAt: Date.now() }
    const t = token.accessToken
    const range = `start_date=${daysAgo(2)}&end_date=${today()}`
    try {
      const a = await getJson(`https://api.ouraring.com/v2/usercollection/daily_activity?${range}`, t)
      const rows = (a.data as Array<Record<string, unknown>>) ?? []
      out.steps = num(rows[rows.length - 1]?.steps)
    } catch { /* ignore */ }
    try {
      const s = await getJson(`https://api.ouraring.com/v2/usercollection/sleep?${range}`, t)
      const rows = (s.data as Array<Record<string, unknown>>) ?? []
      const last = rows[rows.length - 1]
      const secs = num(last?.total_sleep_duration)
      if (secs !== undefined) out.sleepHours = Math.round((secs / 3600) * 10) / 10
      out.restingHr = num(last?.average_heart_rate)
      out.hrv = num(last?.average_hrv)
    } catch { /* ignore */ }
    try {
      const o = await getJson(`https://api.ouraring.com/v2/usercollection/daily_spo2?${range}`, t)
      const rows = (o.data as Array<Record<string, unknown>>) ?? []
      const pct = (rows[rows.length - 1]?.spo2_percentage as Record<string, unknown>)?.average
      out.spo2 = num(pct)
    } catch { /* ignore */ }
    return out
  },
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const PROVIDERS: Record<string, WearableProvider> = {
  [fitbit.key]: fitbit,
  [withings.key]: withings,
  [oura.key]: oura,
}

export const PROVIDER_BY_SLUG: Record<string, WearableProvider> = {
  [fitbit.slug]: fitbit,
  [withings.slug]: withings,
  [oura.slug]: oura,
}

/** Redirect URI registered with each provider (must match exactly). */
export function redirectUriFor(slug: string): string {
  const base = process.env.WEARABLES_REDIRECT_BASE ?? 'http://localhost:3333/app/paciente/wearables'
  return `${base.replace(/\/$/, '')}/${slug}/callback`
}

/** Where to bounce the browser back to after the OAuth round-trip. */
export function appReturnUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:5174'
}
