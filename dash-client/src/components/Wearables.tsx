import { useState, useEffect, useCallback } from 'react'
import { Watch, Footprints, HeartPulse, Moon, Activity, Loader2, Plug, Check } from 'lucide-react'
import { apiFetch } from '../lib/api'

export interface WearableData {
  steps: number
  restingHr: number
  sleepHours: number
  spo2: number
  updatedAt: number
}
export interface ProviderState {
  provider: string
  connected: boolean
  connectedAt: number | null
  data: WearableData | null
}

const META: Record<string, { color: string; bg: string; emoji: string }> = {
  'Apple Health':   { color: '#111827', bg: '#F3F4F6', emoji: '🍎' },
  'Health Connect': { color: '#0F9D58', bg: '#E7F5EC', emoji: '🤖' },
  'Fitbit':         { color: '#00B0B9', bg: '#E0F7F8', emoji: '⌚' },
  'Garmin':         { color: '#007CC3', bg: '#E3F2FB', emoji: '🛰️' },
  'Samsung Health': { color: '#1428A0', bg: '#E8EAFB', emoji: '📱' },
  'Withings':       { color: '#00C1B1', bg: '#E0F7F5', emoji: '⚖️' },
  'Oura':           { color: '#6D28D9', bg: '#F1ECFC', emoji: '💍' },
}

export function useWearables(name: string) {
  const [providers, setProviders] = useState<ProviderState[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { providers } = await apiFetch<{ providers: ProviderState[] }>(`/app/paciente/wearables?name=${encodeURIComponent(name)}`)
      setProviders(providers)
    } catch { /* noop */ }
  }, [name])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const connect = useCallback(async (provider: string) => {
    await apiFetch('/app/paciente/wearables', { method: 'POST', body: JSON.stringify({ patientName: name, provider }) })
    await load()
  }, [name, load])

  const disconnect = useCallback(async (provider: string) => {
    await apiFetch('/app/paciente/wearables', { method: 'DELETE', body: JSON.stringify({ patientName: name, provider }) })
    await load()
  }, [name, load])

  return { providers, loading, connect, disconnect, reload: load }
}

// ── Integrações tab ─────────────────────────────────────────────────────────────

export function WearablesTab({ providers, loading, connect, disconnect }: {
  providers: ProviderState[]
  loading: boolean
  connect: (provider: string) => Promise<void>
  disconnect: (provider: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(p: ProviderState) {
    setBusy(p.provider)
    try { p.connected ? await disconnect(p.provider) : await connect(p.provider) }
    finally { setBusy(null) }
  }

  if (loading) {
    return <div className="flex justify-center py-16 text-slate-400"><Loader2 size={26} className="animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 flex items-start gap-3">
        <Watch size={18} className="text-[#0079C8] shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Conecte seus apps e dispositivos de saúde para enriquecer seu painel com dados de atividade.
          As conexões são instantâneas e simuladas para esta demonstração.
        </p>
      </div>

      {providers.map(p => {
        const m = META[p.provider] ?? { color: '#0079C8', bg: '#EBF5FF', emoji: '⌚' }
        return (
          <div key={p.provider} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: m.bg }}>
              {m.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{p.provider}</p>
              <p className="text-xs text-slate-400">
                {p.connected
                  ? `Conectado${p.data ? ` · ${p.data.steps.toLocaleString('pt-BR')} passos hoje` : ''}`
                  : 'Não conectado'}
              </p>
            </div>
            <button
              onClick={() => toggle(p)}
              disabled={busy === p.provider}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                p.connected
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 hover:bg-red-50 hover:text-red-600'
                  : 'bg-[#0079C8] text-white hover:bg-[#0060a0]'
              }`}
            >
              {busy === p.provider
                ? <Loader2 size={13} className="animate-spin" />
                : p.connected ? <Check size={13} /> : <Plug size={13} />}
              {p.connected ? 'Conectado' : 'Conectar'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Atividade widget (Saúde tab) ────────────────────────────────────────────────

export function ActivityWidget({ providers }: { providers: ProviderState[] }) {
  const withData = providers.filter(p => p.connected && p.data)
  if (withData.length === 0) return null

  const latest = withData.map(p => p.data!).sort((a, b) => b.updatedAt - a.updatedAt)
  const steps   = Math.max(...latest.map(d => d.steps))
  const sleep   = latest[0].sleepHours
  const restHr  = Math.round(latest.reduce((s, d) => s + d.restingHr, 0) / latest.length)
  const spo2    = Math.min(...latest.map(d => d.spo2))

  const stats = [
    { Icon: Footprints, label: 'Passos hoje',   value: steps.toLocaleString('pt-BR'), color: '#0079C8', bg: '#EBF5FF' },
    { Icon: Moon,       label: 'Sono',          value: `${sleep}h`,                    color: '#7C3AED', bg: '#F5F3FF' },
    { Icon: HeartPulse, label: 'FC repouso',    value: `${restHr} bpm`,                color: '#DC2626', bg: '#FEF2F2' },
    { Icon: Activity,   label: 'SpO₂',          value: `${spo2}%`,                     color: '#16A34A', bg: '#F0FDF4' },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Watch size={15} className="text-[#0079C8]" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Atividade</p>
        <span className="text-[10px] text-slate-400">· {withData.length} fonte{withData.length > 1 ? 's' : ''} conectada{withData.length > 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(({ Icon, label, value, color, bg }) => (
          <div key={label} className="rounded-xl p-3" style={{ background: bg }}>
            <Icon size={15} style={{ color }} />
            <p className="text-lg font-bold mt-1 leading-tight" style={{ color }}>{value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
