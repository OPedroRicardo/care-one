import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { appointments } from '../../shared/db/schema.ts'

const CreateSchema = z.object({
  patientName: z.string().min(1),
  type:        z.enum(['presencial', 'telechamada']),
  scheduledAt: z.number().int().positive(),
  notes:       z.string().optional(),
})

const IdParams = z.object({ id: z.string().min(1) })

export class AppointmentController {
  constructor(_app: Express) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await db
        .select()
        .from(appointments)
        .orderBy(desc(appointments.scheduledAt))
      res.json({ appointments: rows })
    } catch (err) { next(err) }
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateSchema.parse(req.body)
      const id   = uuidv4()
      await db.insert(appointments).values({
        id,
        patientName: data.patientName,
        doctorName:  'Dr. Silva',
        type:        data.type,
        status:      'pending',
        scheduledAt: data.scheduledAt,
        notes:       data.notes ?? null,
        createdAt:   Date.now(),
      })
      res.status(201).json({ id })
    } catch (err) { next(err) }
  }

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      await db.update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, id))
      res.json({ ok: true })
    } catch (err) { next(err) }
  }

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, id))
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}
