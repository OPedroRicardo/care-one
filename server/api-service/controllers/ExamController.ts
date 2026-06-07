import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { exams } from '../../shared/db/schema.ts'

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
}
