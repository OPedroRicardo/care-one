import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import type { Patient } from '../components/OperadoraDashboard/types'

interface UsePatientsResult {
  patients: Patient[]
  loading: boolean
  error: string | null
  refresh: () => void
  lastUpdated: Date | null
}

const API = '/app/operadora'

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

    apiFetch<{ patients: Patient[] }>(`${API}/patients`)
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
