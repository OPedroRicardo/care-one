import { Express, Request, Response, NextFunction } from 'express'
import { desc } from 'drizzle-orm'

import { db } from '../../shared/db/index.ts'
import { historyRecords, appointments, exams } from '../../shared/db/schema.ts'

export class MedicoController {
  constructor(_app: Express) {}

  /**
   * GET /app/medico/patients
   * Agrupa os registros históricos por paciente e retorna um resumo por pessoa.
   */
  patients = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await db
        .select()
        .from(historyRecords)
        .orderBy(desc(historyRecords.date))

      // Group by patient name
      const byName = new Map<string, typeof records>()
      for (const r of records) {
        if (!byName.has(r.patientName)) byName.set(r.patientName, [])
        byName.get(r.patientName)!.push(r)
      }

      const patients = Array.from(byName.entries()).map(([name, recs]) => {
        const latest   = recs[0]
        let riskLevel: string | null = null
        try {
          const details = JSON.parse(latest.details)
          riskLevel = details?.riskLevel ?? null
        } catch { /* noop */ }

        return {
          name,
          lastRecord:  latest.date,
          lastSummary: latest.summary,
          riskLevel,
          totalRecords: recs.length,
          triagens:     recs.filter(r => r.type === 'triagem').length,
          exames:       recs.filter(r => r.type === 'exame').length,
        }
      })

      res.json({ patients })
    } catch (err) { next(err) }
  }

  /**
   * GET /app/medico/agenda
   * Retorna todos os agendamentos (por padrão os pendentes e confirmados).
   */
  agenda = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await db
        .select()
        .from(appointments)
        .orderBy(desc(appointments.scheduledAt))
      res.json({ appointments: rows })
    } catch (err) { next(err) }
  }

  /**
   * GET /app/medico/exames
   * Retorna exames compartilhados (shared=true e não expirados).
   */
  examesCompartilhados = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now  = Date.now()
      const rows = await db.select().from(exams).orderBy(desc(exams.createdAt))
      const shared = rows
        .filter(r => r.shared && (!r.sharedUntil || r.sharedUntil > now))
        .map(r => ({ ...r, fileData: undefined }))
      res.json({ exams: shared })
    } catch (err) { next(err) }
  }
}
