import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc, asc } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { patientMessages, historyRecords } from '../../shared/db/schema.ts'

const NameParams = z.object({ patientName: z.string().min(1) })

const SendSchema = z.object({
  content:    z.string().min(1),
  senderRole: z.enum(['medico', 'paciente']).default('medico'),
})

export class PatientConversationController {
  constructor(_app: Express) {}

  /**
   * GET /app/medico/conversa/:patientName
   * Returns all chat messages + all history records for this patient,
   * merged so the frontend can render a unified timeline.
   */
  getConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName } = NameParams.parse(req.params)

      const [messages, records] = await Promise.all([
        db.select()
          .from(patientMessages)
          .where(eq(patientMessages.patientName, patientName))
          .orderBy(asc(patientMessages.createdAt)),

        db.select()
          .from(historyRecords)
          .where(eq(historyRecords.patientName, patientName))
          .orderBy(desc(historyRecords.date)),
      ])

      const parsedRecords = records.map(r => {
        let details: unknown = null
        try { details = JSON.parse(r.details) } catch { /* noop */ }
        return { ...r, details }
      })

      res.json({ messages, records: parsedRecords })
    } catch (err) { next(err) }
  }

  /**
   * POST /app/medico/conversa/:patientName
   * Send a message in the conversation.
   */
  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName } = NameParams.parse(req.params)
      const { content, senderRole } = SendSchema.parse(req.body)

      await db.insert(patientMessages).values({
        patientName,
        senderRole,
        content,
        createdAt: Date.now(),
      })

      res.status(201).json({ ok: true })
    } catch (err) { next(err) }
  }
}
