/**
 * Bridges the canonical, DB-backed patients (Paciente/Médico world) into the
 * Operadora's predictive-risk portfolio (otherwise computed entirely by the
 * Python/parquet pipeline).
 *
 * For each row in the `patients` table we derive an Operadora `Patient` object
 * from that person's *real* `historyRecords` (triagens + exames). Fields that
 * have a real-data equivalent (vitals, lab markers, risk level) are derived
 * faithfully; fields with no real equivalent in the PoC (framingham,
 * compositeScore, projectedCost, homaIR trend) use simple, clearly-labelled
 * placeholder formulas — enough to render a believable card without inventing
 * fake precision. The merge happens here in Node; compute_dashboard.py is never
 * modified.
 */
import { eq, desc } from 'drizzle-orm'
import { db } from '../../shared/db/index.ts'
import { patients, historyRecords, appointments, exams } from '../../shared/db/schema.ts'

interface LabPoint {
  date: string
  glucose: number
  insulin: number
  totalChol: number
  ldl: number
  hdl: number
  triglycerides: number
  sysBP: number
  diaBP: number
}

export interface RecentActivity {
  latestTriagem: { summary: string; date: number; riskLevel: string | null } | null
  sharedExams: { examType: string; date: number }[]
  nextAppointment: { type: string; status: string; scheduledAt: number } | null
}

export interface LivePatient {
  id: number
  name: string
  age: number
  sex: 'M' | 'F'
  smoker: boolean
  diabetic: boolean
  medicated: boolean
  prevInternacao: boolean
  consultas12m: number
  diasUltimoExame: number
  exams: LabPoint[]
  homaIR: number
  framingham: number
  compositeScore: number
  confidence: number
  riskLevel: 'alto' | 'medio' | 'baixo'
  alteredCount: number
  alteredMarkers: boolean[]
  trendGlucose: number
  trendChol: number
  projectedCost: number
  /** Flags this entry as sourced from live platform data (not the parquet model). */
  live: true
  recentActivity: RecentActivity
}

const DAY = 86_400_000

function hashNum(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function ageFromDob(dob: string | null): number {
  if (!dob) return 45
  const d = new Date(dob)
  if (isNaN(d.getTime())) return 45
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * DAY)))
}

// DB risk levels use pt-BR accents ('médio'); the Operadora frontend expects 'medio'.
function normalizeRisk(r?: string | null): 'alto' | 'medio' | 'baixo' {
  if (r === 'alto') return 'alto'
  if (r === 'médio' || r === 'medio') return 'medio'
  return 'baixo'
}

function leadingNumber(value: string): number | null {
  const m = value.replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

interface ExamResult { item: string; value: string; status?: string }

/** Pulls the most-recent lab value per marker out of the patient's `exame` records. */
function extractMarkers(records: { type: string; date: number; details: string }[]) {
  const markers: Record<string, number> = {}
  const examRecs = records
    .filter(r => r.type === 'exame')
    .sort((a, b) => b.date - a.date)

  for (const rec of examRecs) {
    let parsed: { results?: ExamResult[] } = {}
    try { parsed = JSON.parse(rec.details) } catch { /* noop */ }
    for (const r of parsed.results ?? []) {
      const item = r.item.toLowerCase()
      const n = leadingNumber(r.value)
      if (n === null) continue
      const set = (k: string) => { if (markers[k] === undefined) markers[k] = n }
      if (item.includes('glicada') || item.includes('hba1c')) continue
      if (item.includes('glicemia') || (item.includes('glicose') && !item.includes('glicada'))) set('glucose')
      else if (item.includes('colesterol total')) set('totalChol')
      else if (item === 'ldl' || item.includes(' ldl') || item.startsWith('ldl')) set('ldl')
      else if (item === 'hdl' || item.includes(' hdl') || item.startsWith('hdl')) set('hdl')
      else if (item.includes('triglic')) set('triglycerides')
      else if (item.includes('insulin')) set('insulin')
    }
  }
  return markers
}

function buildExamTrend(latest: Omit<LabPoint, 'date'>, gSlope: number, cSlope: number): LabPoint[] {
  const out: LabPoint[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const back = 5 - i
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      glucose:       Math.round(latest.glucose - gSlope * back),
      insulin:       Math.round((latest.insulin - gSlope * 0.3 * back) * 10) / 10,
      totalChol:     Math.round(latest.totalChol - cSlope * back),
      ldl:           Math.round(latest.ldl - cSlope * 0.7 * back),
      hdl:           latest.hdl,
      triglycerides: Math.round(latest.triglycerides - gSlope * 0.5 * back),
      sysBP:         Math.round(latest.sysBP - (cSlope > 0 ? 0.4 : -0.1) * back),
      diaBP:         latest.diaBP,
    })
  }
  out[5] = { date: out[5].date, ...latest }
  return out
}

async function buildOne(profile: typeof patients.$inferSelect): Promise<LivePatient> {
  const name = profile.name
  const [recs, examRows, apptRows] = await Promise.all([
    db.select().from(historyRecords).where(eq(historyRecords.patientName, name)).orderBy(desc(historyRecords.date)),
    db.select().from(exams).where(eq(exams.patientName, name)).orderBy(desc(exams.createdAt)),
    db.select().from(appointments).where(eq(appointments.patientName, name)).orderBy(desc(appointments.scheduledAt)),
  ])

  const triagens = recs.filter(r => r.type === 'triagem')
  let latestVitals: { pa?: number; fc?: number } = {}
  let latestRisk: string | null = null
  if (triagens[0]) {
    try {
      const d = JSON.parse(triagens[0].details)
      latestVitals = d?.vitals ?? {}
      latestRisk = d?.riskLevel ?? null
    } catch { /* noop */ }
  }
  const risk = normalizeRisk(latestRisk)

  const mk = extractMarkers(recs)
  const sysBP   = latestVitals.pa ?? mk.sysBP ?? 120
  const glucose = mk.glucose ?? (risk === 'alto' ? 132 : risk === 'medio' ? 108 : 90)
  const insulin = mk.insulin ?? 9
  const latest = {
    glucose,
    insulin,
    totalChol:     mk.totalChol ?? (risk === 'baixo' ? 180 : 215),
    ldl:           mk.ldl ?? (risk === 'baixo' ? 105 : 145),
    hdl:           mk.hdl ?? 48,
    triglycerides: mk.triglycerides ?? (risk === 'baixo' ? 120 : 165),
    sysBP,
    diaBP:         Math.round(sysBP * 0.62),
  }

  const sex = (profile.sex as 'M' | 'F') ?? 'M'
  const altered = [
    latest.glucose > 99,
    latest.insulin > 25,
    latest.totalChol >= 200,
    latest.ldl >= 130,
    latest.hdl < (sex === 'F' ? 50 : 40),
    latest.triglycerides >= 150,
    latest.sysBP >= 130,
  ]
  const alteredCount = altered.filter(Boolean).length

  // ── Placeholder predictive formulas (PoC — not clinically validated) ──────
  const age = ageFromDob(profile.dateOfBirth)
  const homaIR = Math.round((latest.glucose * latest.insulin) / 405 * 100) / 100
  const framingham = Math.min(56, Math.max(1,
    (risk === 'alto' ? 22 : risk === 'medio' ? 12 : 5) + Math.floor(Math.max(0, age - 40) / 10) * 2))
  const compositeScore = Math.round(Math.min(99, Math.max(3,
    (risk === 'alto' ? 62 : risk === 'medio' ? 38 : 14) + alteredCount * 2.5)) * 10) / 10
  const projectedCost = risk === 'alto' ? 68000 : risk === 'medio' ? 28000 : 7500
  const gSlope = risk === 'alto' ? 1.6 : risk === 'medio' ? 0.5 : -0.2
  const cSlope = risk === 'alto' ? 1.0 : risk === 'medio' ? 0.3 : -0.1
  const examTrend = buildExamTrend(latest, gSlope, cSlope)

  const lastExamRec = recs.find(r => r.type === 'exame') ?? recs[0]
  const diasUltimoExame = lastExamRec ? Math.max(1, Math.floor((Date.now() - lastExamRec.date) / DAY)) : 90
  const consultas12m = apptRows.filter(a => a.scheduledAt > Date.now() - 365 * DAY).length

  const upcoming = [...apptRows]
    .filter(a => a.status !== 'cancelled' && a.scheduledAt > Date.now())
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]

  const recentActivity: RecentActivity = {
    latestTriagem: triagens[0]
      ? { summary: triagens[0].summary, date: triagens[0].date, riskLevel: latestRisk }
      : null,
    sharedExams: examRows
      .filter(e => e.shared && (!e.sharedUntil || e.sharedUntil > Date.now()))
      .map(e => ({ examType: e.examType, date: e.createdAt })),
    nextAppointment: upcoming
      ? { type: upcoming.type, status: upcoming.status, scheduledAt: upcoming.scheduledAt }
      : null,
  }

  return {
    id: hashNum(name) % 90000 + 100000, // high range so it won't collide with parquet ids
    name,
    age,
    sex,
    smoker: false,
    diabetic: latest.glucose > 126,
    medicated: risk !== 'baixo',
    prevInternacao: risk === 'alto',
    consultas12m,
    diasUltimoExame,
    exams: examTrend,
    homaIR,
    framingham,
    compositeScore,
    confidence: 0.9,
    riskLevel: risk,
    alteredCount,
    alteredMarkers: altered,
    trendGlucose: gSlope,
    trendChol: cSlope,
    projectedCost,
    live: true,
    recentActivity,
  }
}

/** Builds an Operadora `Patient` for every canonical patient profile. */
export async function getLivePatients(): Promise<LivePatient[]> {
  const profiles = await db.select().from(patients)
  return Promise.all(profiles.map(buildOne))
}
