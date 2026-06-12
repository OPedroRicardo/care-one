import { Express, Request, Response, NextFunction } from 'express'
import z from 'zod'
import * as Notifications from '@api-service/services/NotificationService.ts'

const ListQuery = z.object({
  role: z.enum(['medico', 'paciente', 'operadora']),
  name: z.string().optional(),
})
const IdParams = z.object({ id: z.string().min(1) })

export class NotificationController {
  constructor(_app: Express) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, name } = ListQuery.parse(req.query)
      const rows = await Notifications.list(role, name ?? null)
      res.json({ notifications: rows, unread: rows.filter(n => !n.read).length })
    } catch (err) { next(err) }
  }

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = IdParams.parse(req.params)
      await Notifications.markRead(id)
      res.json({ ok: true })
    } catch (err) { next(err) }
  }

  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, name } = ListQuery.parse(req.query)
      await Notifications.markAllRead(role, name ?? null)
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}
