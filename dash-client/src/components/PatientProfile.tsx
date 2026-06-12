import { useState, useEffect } from 'react'
import { UserRound, Phone, Mail, MapPin, ShieldCheck, CalendarDays, AlertTriangle } from 'lucide-react'
import { apiFetch } from '../lib/api'

export interface PatientProfile {
  id: string | null
  name: string
  dateOfBirth: string | null
  sex: 'M' | 'F' | null
  planTier: string | null
  phone: string | null
  email: string | null
  address: string | null
  allergies: string[]
  createdAt: number | null
}

export interface PatientSummary {
  riskLevel: string | null
  vitals: Record<string, number> | null
  news2?: number
  totalRecords: number
  triagens: number
  exames: number
  sharedExams: number
  upcomingAppointments: number
  lastRecord: number | null
}

export function usePatientProfile(name: string) {
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [summary, setSummary] = useState<PatientSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiFetch<{ patient: PatientProfile; summary: PatientSummary }>(`/app/patients/${encodeURIComponent(name)}`)
      .then(d => { if (active) { setProfile(d.patient); setSummary(d.summary) } })
      .catch(() => { /* keep nulls — caller renders gracefully */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [name])

  return { profile, summary, loading }
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000))
}

const sexLabel = (s: string | null) => s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : '—'

// ── Full "Meus dados" card (Paciente) ───────────────────────────────────────────

export function MeusDadosCard({ profile }: { profile: PatientProfile | null }) {
  if (!profile) return null
  const age = ageFromDob(profile.dateOfBirth)

  const rows: { Icon: typeof Phone; label: string; value: string | null }[] = [
    { Icon: CalendarDays, label: 'Idade',    value: age !== null ? `${age} anos · ${sexLabel(profile.sex)}` : sexLabel(profile.sex) },
    { Icon: ShieldCheck,  label: 'Plano',    value: profile.planTier },
    { Icon: Phone,        label: 'Telefone', value: profile.phone },
    { Icon: Mail,         label: 'E-mail',   value: profile.email },
    { Icon: MapPin,       label: 'Endereço', value: profile.address },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-50 dark:border-slate-800">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 text-green-700 flex items-center justify-center shrink-0">
          <UserRound size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{profile.name}</p>
          <p className="text-xs text-slate-400">Meus dados cadastrais</p>
        </div>
        {profile.planTier && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700">
            {profile.planTier}
          </span>
        )}
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {rows.filter(r => r.value).map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <Icon size={15} className="text-slate-400 shrink-0" />
            <span className="text-slate-400 w-20 shrink-0">{label}</span>
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{value}</span>
          </div>
        ))}
        {profile.allergies.length > 0 && (
          <div className="flex items-start gap-3 text-sm pt-1">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <span className="text-slate-400 w-20 shrink-0">Alergias</span>
            <span className="flex flex-wrap gap-1.5">
              {profile.allergies.map(a => (
                <span key={a} className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 px-2 py-0.5 rounded-full font-medium">{a}</span>
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Compact snippet (Médico sidebar) ────────────────────────────────────────────

export function PatientProfileSnippet({ profile }: { profile: PatientProfile | null }) {
  if (!profile) return null
  const age = ageFromDob(profile.dateOfBirth)

  return (
    <div className="px-3 py-3 border-b border-slate-50 dark:border-slate-800 space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1">Perfil do paciente</p>
      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 px-1">
        {age !== null && <p>{age} anos · {sexLabel(profile.sex)}</p>}
        {profile.planTier && <p className="text-slate-500">Plano {profile.planTier}</p>}
        {profile.phone && <p className="text-slate-500 truncate">{profile.phone}</p>}
        {profile.allergies.length > 0 && (
          <p className="flex items-center gap-1 text-amber-600">
            <AlertTriangle size={11} className="shrink-0" />
            <span className="truncate">{profile.allergies.join(', ')}</span>
          </p>
        )}
      </div>
    </div>
  )
}
