import { Request, Response, NextFunction } from 'express'
import { getPatients, invalidateCache } from '@api-service/services/AnalysisService.ts'

export class OperadoraController {
  patients = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getPatients()
      res.json({ patients: data, total: (data as unknown[]).length, updatedAt: new Date().toISOString() })
    } catch (err) {
      next(err)
    }
  }

  patient = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id)
      const data = await getPatients() as Array<{ id: number }>
      const patient = data.find(p => p.id === id)
      if (!patient) { res.status(404).json({ error: 'Paciente não encontrado' }); return }
      res.json(patient)
    } catch (err) {
      next(err)
    }
  }

  refresh = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      invalidateCache()
      const data = await getPatients()
      res.json({ patients: data, total: (data as unknown[]).length, updatedAt: new Date().toISOString() })
    } catch (err) {
      next(err)
    }
  }
}
