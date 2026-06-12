import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { patients, historyRecords, appointments, exams } from '../../shared/db/schema.ts'

const NameParams = z.object({ name: z.string().min(1) })

export class PatientController {
  constructor(_app: Express) {}

  /**
   * GET /app/patients/:name
   * Canonical patient profile (demographics/contact/plan) plus a derived
   * clinical summary (latest risk/vitals + record counts). Reuses the same
   * grouping idea as MedicoController.patients.
   */
  getByName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = NameParams.parse(req.params)

      const [profileRows, recs, apptRows, examRows] = await Promise.all([
        db.select().from(patients).where(eq(patients.name, name)),
        db.select().from(historyRecords).where(eq(historyRecords.patientName, name)).orderBy(desc(historyRecords.date)),
        db.select().from(appointments).where(eq(appointments.patientName, name)),
        db.select().from(exams).where(eq(exams.patientName, name)),
      ])

      const triagens = recs.filter(r => r.type === 'triagem')
      let riskLevel: string | null = null
      let vitals: Record<string, number> | null = null
      let news2: number | undefined
      if (triagens[0]) {
        try {
          const d = JSON.parse(triagens[0].details)
          riskLevel = d?.riskLevel ?? null
          vitals = d?.vitals ?? null
          news2 = d?.news2?.total
        } catch { /* noop */ }
      }

      const profileRow = profileRows[0]
      // Fall back to a minimal synthesized profile so the demo never 404s.
      const profile = profileRow
        ? {
            ...profileRow,
            allergies: (() => { try { return JSON.parse(profileRow.allergies ?? '[]') } catch { return [] } })(),
          }
        : {
            id: null, name, dateOfBirth: null, sex: null, planTier: null,
            phone: null, email: null, address: null, allergies: [], createdAt: null,
          }

      const now = Date.now()
      const summary = {
        riskLevel,
        vitals,
        news2,
        totalRecords: recs.length,
        triagens: triagens.length,
        exames: recs.filter(r => r.type === 'exame').length,
        sharedExams: examRows.filter(e => e.shared && (!e.sharedUntil || e.sharedUntil > now)).length,
        upcomingAppointments: apptRows.filter(a => a.status !== 'cancelled' && a.scheduledAt > now).length,
        lastRecord: recs[0]?.date ?? null,
      }

      res.json({ patient: profile, summary })
    } catch (err) { next(err) }
  }
}
