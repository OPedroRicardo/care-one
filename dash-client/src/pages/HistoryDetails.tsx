import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Activity, FlaskConical, Heart, Wind, Thermometer, Droplets, Gauge } from 'lucide-react'
import { apiFetch } from '../lib/api'

// ── Tipos

interface TriagemDetails {
  riskLevel: 'baixo' | 'moderado' | 'alto'
  vitals: {
    heartRate: number
    bloodPressure: string
    temperature: number
    oxygenSaturation: number
    respiratoryRate: number
  }
  news2Score: number
  notes: string
}

interface ExameResult {
  item: string
  value: string
  reference: string
  status: 'normal' | 'alterado'
}

interface ExameDetails {
  examName: string
  results: ExameResult[]
  notes: string
}

interface HistoryRecord {
  id: string
  type: 'triagem' | 'exame'
  patientName: string
  date: number
  summary: string
  details: TriagemDetails | ExameDetails
  createdAt: number
}

// ── Helpers

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const RISK_CONFIG = {
  baixo:    { label: 'Baixo',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  moderado: { label: 'Moderado', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  alto:     { label: 'Alto',     bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
}

// ── Sub-componentes

function VitalCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
      <div className="text-[#0079C8]">{icon}</div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  )
}

function TriagemView({ details }: { details: TriagemDetails }) {
  const risk = RISK_CONFIG[details.riskLevel]

  return (
    <div className="space-y-5">
      {/* Risco + NEWS2 */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${risk.bg} ${risk.text} font-semibold text-sm`}>
          <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
          Risco {risk.label}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">Score NEWS2</span>
          <span className="text-lg font-bold text-slate-700">{details.news2Score}</span>
        </div>
      </div>

      {/* Vitais */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Sinais Vitais</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <VitalCard icon={<Heart size={18} />}      label="Freq. Cardíaca"    value={`${details.vitals.heartRate} bpm`} />
          <VitalCard icon={<Gauge size={18} />}       label="Pressão Arterial"  value={details.vitals.bloodPressure} />
          <VitalCard icon={<Thermometer size={18} />} label="Temperatura"       value={`${details.vitals.temperature} °C`} />
          <VitalCard icon={<Droplets size={18} />}    label="SpO₂"              value={`${details.vitals.oxygenSaturation}%`} />
          <VitalCard icon={<Wind size={18} />}        label="Freq. Respiratória" value={`${details.vitals.respiratoryRate} irpm`} />
        </div>
      </div>

      {/* Observações */}
      {details.notes && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Observações</h3>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3">
            {details.notes}
          </p>
        </div>
      )}
    </div>
  )
}

function ExameView({ details }: { details: ExameDetails }) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-700">{details.examName}</h2>

      {/* Tabela de resultados */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Resultados</h3>
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Item</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Resultado</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Referência</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {details.results.map((r, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-4 py-3 text-slate-700 font-medium">{r.item}</td>
                  <td className="px-4 py-3 text-slate-600">{r.value}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{r.reference}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === 'normal'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status === 'normal' ? 'Normal' : 'Alterado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observações */}
      {details.notes && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Observações</h3>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3">
            {details.notes}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Página principal

export default function HistoryDetails() {
  const { id }                  = useParams<{ id: string }>()
  const [record, setRecord]     = useState<HistoryRecord | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiFetch<HistoryRecord>(`/app/history/${id}`)
      .then(r => { setRecord(r); setError(null) })
      .catch(() => setError('Não foi possível carregar o registro.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-[#0079C8]" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-6 py-4 text-center">
          {error ?? 'Registro não encontrado.'}
        </div>
      </div>
    )
  }

  const isTriagem = record.type === 'triagem'

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 max-w-2xl mx-auto">
      {/* Cabeçalho do registro */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isTriagem ? 'bg-blue-100 text-[#0079C8]' : 'bg-purple-100 text-purple-600'
          }`}
        >
          {isTriagem ? <Activity size={24} /> : <FlaskConical size={24} />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isTriagem ? 'bg-blue-100 text-[#0079C8]' : 'bg-purple-100 text-purple-600'
              }`}
            >
              {record.type}
            </span>
            <span className="text-xs text-slate-400">{formatDate(record.date)}</span>
          </div>
          <p className="text-base font-semibold text-slate-700 mt-0.5">{record.summary}</p>
          <p className="text-xs text-slate-400">{record.patientName}</p>
        </div>
      </div>

      {/* Conteúdo dinâmico conforme tipo */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        {isTriagem
          ? <TriagemView details={record.details as TriagemDetails} />
          : <ExameView   details={record.details as ExameDetails} />
        }
      </div>
    </div>
  )
}
