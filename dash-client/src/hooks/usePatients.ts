import { useState, useEffect, useCallback } from 'react'
import type { Patient } from '../components/OperadoraDashboard/types'

interface UsePatientsResult {
  patients: Patient[]
  loading: boolean
  error: string | null
  refresh: () => void
  lastUpdated: Date | null
}

const API = '/api/app/operadora'

export function usePatients(): UsePatientsResult {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${API}/patients`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(({ patients: pts }) => {
        if (cancelled) return
        setPatients(pts as Patient[])
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [rev])

  const refresh = useCallback(() => setRev(v => v + 1), [])

  return { patients, loading, error, refresh, lastUpdated }
}
