import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { historyRecords } from '../../shared/db/schema.ts'

const GetByIdParams = z.object({
  id: z.string().min(1),
})

const ListQuery = z.object({
  type: z.enum(['triagem', 'exame']).optional(),
})

export class HistoryController {
  constructor(_app: Express) {}

  /**
   * GET /app/history
   * Retorna lista de registros de histórico, mais recentes primeiro.
   * Query opcional: ?type=triagem|exame
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = ListQuery.parse(req.query)

      const rows = await db
        .select({
          id:          historyRecords.id,
          type:        historyRecords.type,
          patientName: historyRecords.patientName,
          date:        historyRecords.date,
          summary:     historyRecords.summary,
          createdAt:   historyRecords.createdAt,
        })
        .from(historyRecords)
        .where(type ? eq(historyRecords.type, type) : undefined)
        .orderBy(desc(historyRecords.date))

      res.status(200).json({ records: rows })
    } catch (err) {
      next(err)
    }
  }

  /**
   * GET /app/history/:id
   * Retorna um registro completo incluindo details (JSON parseado).
   */
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = GetByIdParams.parse(req.params)

      const row = await db
        .select()
        .from(historyRecords)
        .where(eq(historyRecords.id, id))
        .limit(1)

      if (!row[0]) {
        res.status(404).json({ error: 'Registro não encontrado.' })
        return
      }

      const record = row[0]
      let details: unknown
      try {
        details = JSON.parse(record.details)
      } catch {
        details = null
      }
      res.status(200).json({ ...record, details })
    } catch (err) {
      next(err)
    }
  }
}
