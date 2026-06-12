/**
 * Notifications / recommendations center.
 *
 * Two kinds of notifications:
 *  - **Emitted**: inserted at write time from existing flows (appointment
 *    create/confirm/cancel, exam share). One-off, unique UUID.
 *  - **Derived**: recomputed idempotently when a recipient lists their feed —
 *    high-risk triagens (médico) and overdue exam recommendations (paciente).
 *    These come from the totem/MQTT side or client-side logic, so we
 *    materialize them here with deterministic ids + onConflictDoNothing.
 */
import { randomUUID } from 'node:crypto'
import { eq, and, or, isNull, desc } from 'drizzle-orm'
import { db } from '../../shared/db/index.ts'
import { notifications, historyRecords, exams } from '../../shared/db/schema.ts'

type Role = 'medico' | 'paciente' | 'operadora'

interface EmitInput {
  recipientRole: Role
  recipientName?: string | null
  type: string
  title: string
  body: string
  relatedEntityId?: string | null
}

export async function emit(n: EmitInput) {
  await db.insert(notifications).values({
    id: randomUUID(),
    recipientRole: n.recipientRole,
    recipientName: n.recipientName ?? null,
    type: n.type,
    title: n.title,
    body: n.body,
    relatedEntityId: n.relatedEntityId ?? null,
    read: false,
    createdAt: Date.now(),
  })
}

async function emitOnce(id: string, n: EmitInput) {
  await db.insert(notifications).values({
    id,
    recipientRole: n.recipientRole,
    recipientName: n.recipientName ?? null,
    type: n.type,
    title: n.title,
    body: n.body,
    relatedEntityId: n.relatedEntityId ?? null,
    read: false,
    createdAt: Date.now(),
  }).onConflictDoNothing()
}

// Exam-recommendation intervals (mirrors PacienteDashboard.checkExamRecommendations).
const EXAM_RECS = [
  { key: 'hemograma',  label: 'Hemograma completo',       intervalDays: 365 },
  { key: 'glicemia',   label: 'Glicemia em jejum',        intervalDays: 365 },
  { key: 'colesterol', label: 'Perfil lipídico',          intervalDays: 730 },
  { key: 'creatinina', label: 'Função renal (creatinina)',intervalDays: 365 },
  { key: 'ecg',        label: 'Eletrocardiograma',        intervalDays: 730 },
]

/** Idempotently materializes derived notifications relevant to this recipient. */
async function syncDerived(role: Role, name: string | null) {
  const now = Date.now()

  if (role === 'medico') {
    // High-risk: latest triagem per patient === 'alto'
    const recs = await db.select().from(historyRecords).orderBy(desc(historyRecords.date))
    const seen = new Set<string>()
    for (const r of recs) {
      if (r.type !== 'triagem' || seen.has(r.patientName)) continue
      seen.add(r.patientName)
      let risk: string | undefined
      try { risk = JSON.parse(r.details)?.riskLevel } catch { /* noop */ }
      if (risk === 'alto') {
        await emitOnce(`risk-${r.id}`, {
          recipientRole: 'medico',
          type: 'risk',
          title: 'Paciente com risco alto',
          body: `${r.patientName}: ${r.summary}`,
          relatedEntityId: r.patientName,
        })
      }
    }
  }

  if (role === 'paciente' && name) {
    const [recs, examRows] = await Promise.all([
      db.select().from(historyRecords).where(eq(historyRecords.patientName, name)),
      db.select().from(exams).where(eq(exams.patientName, name)),
    ])
    const haystack = [
      ...recs.map(r => ({ key: `${r.summary} ${safeExamName(r.details)}`.toLowerCase(), date: r.date })),
      ...examRows.map(e => ({ key: e.examType.toLowerCase(), date: e.createdAt })),
    ]
    for (const rec of EXAM_RECS) {
      const last = haystack.filter(h => h.key.includes(rec.key)).sort((a, b) => b.date - a.date)[0]
      const overdue = !last || (now - last.date) > rec.intervalDays * 86400000
      if (overdue) {
        await emitOnce(`rec-${name}-${rec.key}`, {
          recipientRole: 'paciente',
          recipientName: name,
          type: 'recommendation',
          title: 'Exame preventivo recomendado',
          body: `${rec.label} — recomendado pelas diretrizes de atenção preventiva.`,
          relatedEntityId: rec.key,
        })
      }
    }
  }
}

function safeExamName(details: string): string {
  try { return JSON.parse(details)?.examName ?? '' } catch { return '' }
}

export async function list(role: Role, name: string | null) {
  await syncDerived(role, name)
  const rows = await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.recipientRole, role),
      // recipient match: broadcast (null) OR addressed to this name
      name
        ? or(isNull(notifications.recipientName), eq(notifications.recipientName, name))
        : isNull(notifications.recipientName),
    ))
    .orderBy(desc(notifications.createdAt))
  return rows
}

export async function markRead(id: string) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id))
}

export async function markAllRead(role: Role, name: string | null) {
  const cond = name
    ? and(eq(notifications.recipientRole, role), or(isNull(notifications.recipientName), eq(notifications.recipientName, name)))
    : and(eq(notifications.recipientRole, role), isNull(notifications.recipientName))
  await db.update(notifications).set({ read: true }).where(cond)
}
