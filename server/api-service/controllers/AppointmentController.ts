import { Express, Request, Response, NextFunction } from 'express'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'

import { db } from '../../shared/db/index.ts'
import { appointments } from '../../shared/db/schema.ts'
import { emit } from '@api-service/services/NotificationService.ts'

function fmtWhen(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

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
      await emit({
        recipientRole: 'medico',
        type: 'appointment',
        title: 'Nova solicitação de consulta',
        body: `${data.patientName} solicitou uma consulta ${data.type} para ${fmtWhen(data.scheduledAt)}.`,
        relatedEntityId: id,
      })
      res.status(201).json({ id })
    } catch (err) { next(err) }
  }

  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      await db.update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, id))
      const [appt] = await db.select().from(appointments).where(eq(appointments.id, id))
      if (appt) {
        await emit({
          recipientRole: 'paciente',
          recipientName: appt.patientName,
          type: 'appointment',
          title: 'Consulta confirmada',
          body: `Sua consulta ${appt.type} de ${fmtWhen(appt.scheduledAt)} foi confirmada.`,
          relatedEntityId: id,
        })
      }
      res.json({ ok: true })
    } catch (err) { next(err) }
  }

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      const [appt] = await db.select().from(appointments).where(eq(appointments.id, id))
      await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, id))
      if (appt) {
        await emit({
          recipientRole: 'paciente',
          recipientName: appt.patientName,
          type: 'appointment',
          title: 'Consulta cancelada',
          body: `Sua consulta ${appt.type} de ${fmtWhen(appt.scheduledAt)} foi cancelada.`,
          relatedEntityId: id,
        })
      }
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}
