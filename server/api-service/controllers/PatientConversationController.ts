import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc, asc, inArray } from 'drizzle-orm'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { patientMessages, historyRecords, exams } from '../../shared/db/schema.ts'
import { emit } from '@api-service/services/NotificationService.ts'

const NameParams = z.object({ patientName: z.string().min(1) })

const SendSchema = z.object({
  content:    z.string().min(1),
  senderRole: z.enum(['medico', 'paciente']).default('medico'),
  attachmentExamId: z.string().optional(),
})

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export class PatientConversationController {
  constructor(_app: Express) {}

  /**
   * GET /app/medico/conversa/:patientName
   * Returns all chat messages + all history records for this patient,
   * merged so the frontend can render a unified timeline. Messages that carry
   * an exam attachment are enriched with that exam's type + file name.
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

      // Resolve exam attachments referenced by messages.
      const examIds = [...new Set(messages.map(m => m.attachmentExamId).filter(Boolean) as string[])]
      const examRows = examIds.length
        ? await db.select().from(exams).where(inArray(exams.id, examIds))
        : []
      const examById = new Map(examRows.map(e => [e.id, e]))

      const enriched = messages.map(m => ({
        ...m,
        attachment: m.attachmentExamId && examById.has(m.attachmentExamId)
          ? {
              id:       m.attachmentExamId,
              examType: examById.get(m.attachmentExamId)!.examType,
              fileName: examById.get(m.attachmentExamId)!.fileName,
            }
          : null,
      }))

      const parsedRecords = records.map(r => {
        let details: unknown = null
        try { details = JSON.parse(r.details) } catch { /* noop */ }
        return { ...r, details }
      })

      res.json({ messages: enriched, records: parsedRecords })
    } catch (err) { next(err) }
  }

  /**
   * POST /app/medico/conversa/:patientName
   * Send a message in the conversation. If an exam is attached, the exam is
   * auto-shared with the doctor (sending it in the conversation implies sharing).
   */
  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientName } = NameParams.parse(req.params)
      const { content, senderRole, attachmentExamId } = SendSchema.parse(req.body)

      await db.insert(patientMessages).values({
        patientName,
        senderRole,
        content,
        attachmentExamId: attachmentExamId ?? null,
        createdAt: Date.now(),
      })

      // Attaching an exam in the doctor conversation implies sharing it.
      if (attachmentExamId) {
        await db.update(exams)
          .set({ shared: true, sharedUntil: Date.now() + SEVEN_DAYS_MS })
          .where(eq(exams.id, attachmentExamId))
        if (senderRole === 'paciente') {
          const [exam] = await db.select().from(exams).where(eq(exams.id, attachmentExamId))
          await emit({
            recipientRole: 'medico',
            type: 'exam',
            title: 'Novo exame compartilhado',
            body: `${patientName} compartilhou "${exam?.examType ?? 'um exame'}" na conversa.`,
            relatedEntityId: attachmentExamId,
          })
        }
      }

      res.status(201).json({ ok: true })
    } catch (err) { next(err) }
  }
}
