import { Express, Request, Response, NextFunction } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { exams, historyRecords } from '../../shared/db/schema.ts'
import { emit } from '@api-service/services/NotificationService.ts'
import { generateExamPdf, type ExamPdfInput } from '@api-service/services/ExamPdfService.ts'

function safeJson(s: string | null): Record<string, any> | null {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

const UploadSchema = z.object({
  patientName: z.string().min(1),
  examType:    z.string().min(1),
  fileName:    z.string().min(1),
  fileData:    z.string().optional(), // base64
})

const ShareSchema = z.object({
  sharedUntil: z.number().int().positive().optional(),
})

const IdParams = z.object({ id: z.string().min(1) })

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export class ExamController {
  constructor(_app: Express) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await db.select().from(exams).orderBy(desc(exams.createdAt))
      res.json({ exams: rows.map(r => ({ ...r, fileData: undefined })) })
    } catch (err) { next(err) }
  }

  listShared = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now  = Date.now()
      const rows = await db.select().from(exams).orderBy(desc(exams.createdAt))
      const shared = rows
        .filter(r => r.shared && (!r.sharedUntil || r.sharedUntil > now))
        .map(r => ({ ...r, fileData: undefined }))
      res.json({ exams: shared })
    } catch (err) { next(err) }
  }

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UploadSchema.parse(req.body)
      const id   = uuidv4()
      await db.insert(exams).values({
        id,
        patientName: data.patientName,
        examType:    data.examType,
        fileName:    data.fileName,
        fileData:    data.fileData ?? null,
        shared:      false,
        sharedUntil: null,
        createdAt:   Date.now(),
      })
      res.status(201).json({ id })
    } catch (err) { next(err) }
  }

  share = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id }        = IdParams.parse(req.params)
      const { sharedUntil } = ShareSchema.parse(req.body)
      const until           = sharedUntil ?? Date.now() + SEVEN_DAYS_MS
      await db.update(exams).set({ shared: true, sharedUntil: until }).where(eq(exams.id, id))
      const [exam] = await db.select().from(exams).where(eq(exams.id, id))
      if (exam) {
        await emit({
          recipientRole: 'medico',
          type: 'exam',
          title: 'Novo exame compartilhado',
          body: `${exam.patientName} compartilhou o exame "${exam.examType}".`,
          relatedEntityId: exam.id,
        })
      }
      res.json({ ok: true, sharedUntil: until })
    } catch (err) { next(err) }
  }

  unshare = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      await db.update(exams).set({ shared: false, sharedUntil: null }).where(eq(exams.id, id))
      res.json({ ok: true })
    } catch (err) { next(err) }
  }

  // Real, semantically-faithful laudo PDF. Accepts either a history_records id
  // (structured results / triagem vitals) or an exams id (cross-referenced to the
  // patient's matching history exam for the marker table). See pdf_integration.md.
  pdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      let input: ExamPdfInput | null = null

      const [h] = await db.select().from(historyRecords).where(eq(historyRecords.id, id))
      if (h) {
        const d = safeJson(h.details)
        input = h.type === 'triagem'
          ? { patientName: h.patientName, examType: 'Triagem Clinica', dateMs: h.date,
              triagem: { riskLevel: d?.riskLevel, vitals: d?.vitals, news2: d?.news2?.total }, notes: d?.notes }
          : { patientName: h.patientName, examType: d?.examName ?? h.summary, dateMs: h.date,
              results: d?.results, notes: d?.notes }
      } else {
        const [e] = await db.select().from(exams).where(eq(exams.id, id))
        if (!e) return res.status(404).json({ error: 'exam_not_found' })
        // Cross-reference structured results from the patient's history exam.
        const hist = await db.select().from(historyRecords)
          .where(and(eq(historyRecords.patientName, e.patientName), eq(historyRecords.type, 'exame')))
        const exLower = e.examType.toLowerCase()
        const match = hist.map(r => safeJson(r.details))
          .find(d => {
            const name = String(d?.examName ?? '').toLowerCase()
            return name && (name.includes(exLower) || exLower.includes(name))
          })
        input = { patientName: e.patientName, examType: e.examType, dateMs: e.createdAt,
          results: match?.results, notes: match?.notes }
      }

      const bytes = await generateExamPdf(input)
      const fname = `laudo_${input.examType.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
      res.send(Buffer.from(bytes))
    } catch (err) { next(err) }
  }
}
