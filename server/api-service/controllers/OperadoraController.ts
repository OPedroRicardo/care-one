import { Request, Response, NextFunction } from 'express'
import { getPatients, invalidateCache } from '@api-service/services/AnalysisService.ts'
import { getLivePatients } from '@api-service/services/LivePatientService.ts'

interface ScoredPatient { id: number; name: string; compositeScore: number }

/**
 * Merges the canonical, DB-backed patients ("live" entries) into the
 * Python/parquet-computed portfolio. Live patients take precedence over any
 * synthetic row with the same name, and the whole list is re-sorted by
 * compositeScore so the dashboard's "top risk" ordering still holds.
 *
 * Resilient by design: if the Python analysis pipeline is unavailable (e.g.
 * pandas not installed on the demo machine) we still return the live patients
 * so the Operadora view is never empty during a presentation.
 */
async function getMergedPortfolio(): Promise<ScoredPatient[]> {
  let pythonData: ScoredPatient[] = []
  try {
    pythonData = (await getPatients()) as ScoredPatient[]
  } catch (err) {
    console.warn('[Operadora] analysis pipeline unavailable, showing live patients only:',
      err instanceof Error ? err.message : err)
  }

  const live = await getLivePatients()
  const liveNames = new Set(live.map(p => p.name))
  const merged = [...live, ...pythonData.filter(p => !liveNames.has(p.name))]
  merged.sort((a, b) => b.compositeScore - a.compositeScore)
  return merged
}

export class OperadoraController {
  patients = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getMergedPortfolio()
      res.json({ patients: data, total: data.length, updatedAt: new Date().toISOString() })
    } catch (err) {
      next(err)
    }
  }

  patient = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id)
      const data = await getMergedPortfolio()
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
      const data = await getMergedPortfolio()
      res.json({ patients: data, total: data.length, updatedAt: new Date().toISOString() })
    } catch (err) {
      next(err)
    }
  }
}
