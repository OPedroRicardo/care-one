import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, FlaskConical, Clock, Video, MapPin, Loader2,
  Share2, ShieldCheck, HeartPulse, Activity, X,
  FileText, Bell, MessageCircle, ChevronRight,
  Download, Plus, List, Calendar, XCircle, Watch,
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import DigitalTwin from '../components/DigitalTwin'
import { FilterChips, SortSelect, ListControlsBar, SearchBar } from '../components/ListControls'
import { useRegisterHeaderTabs } from '../contexts/HeaderTabsContext'
import { usePatientProfile, MeusDadosCard } from '../components/PatientProfile'
import CalendarView from '../components/CalendarView'
import { useWearables, WearablesTab, ActivityWidget } from '../components/Wearables'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string
  patientName: string
  type: 'presencial' | 'telechamada'
  status: 'pending' | 'confirmed' | 'cancelled'
  scheduledAt: number
  notes: string | null
}

interface Exam {
  id: string
  patientName: string
  examType: string
  fileName: string
  shared: boolean
  sharedUntil: number | null
  createdAt: number
}

interface HistoryRecord {
  id: string
  type: 'triagem' | 'exame'
  patientName: string
  date: number
  summary: string
  details: {
    riskLevel?: string
    vitals?: { fc?: number; fr?: number; spo2?: number; temp?: number; pa?: number }
    news2?: { total: number }
    notes?: string
    examName?: string
    fileName?: string
  } | null
}

type Tab = 'saude' | 'consultas' | 'registros' | 'integracoes'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_PATIENT = 'João da Silva'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

// Dados demonstrativos — usados quando não há triagem real registrada
const DEMO_TRIAGEM: HistoryRecord = {
  id: 'demo',
  type: 'triagem',
  patientName: DEMO_PATIENT,
  date: Date.now() - 86400000,
  summary: 'Triagem de demonstração — estado de saúde estável',
  details: {
    riskLevel: 'baixo',
    vitals: { fc: 72, fr: 15, spo2: 98, temp: 36.7, pa: 118 },
    news2: { total: 1 },
    notes: 'Dados demonstrativos para fins de apresentação do sistema.',
  },
}

// Intervalos baseados em:
// MS — Caderno de Atenção Básica nº 29: Rastreamento (2010)
// SBMFC — Recomendações de prevenção primária (2023)
// CFM/AMB — Diretrizes de rastreamento preventivo (2021)
// WHO — Package of Essential NCD Interventions for PHC (2020)
const EXAM_RECOMMENDATIONS: { key: string; label: string; intervalDays: number; icon: string }[] = [
  { key: 'hemograma',  label: 'Hemograma completo',      intervalDays: 365,  icon: '🩸' },
  { key: 'glicemia',   label: 'Glicemia em jejum',       intervalDays: 365,  icon: '🍬' },
  { key: 'colesterol', label: 'Perfil lipídico',          intervalDays: 730,  icon: '🫀' },
  { key: 'creatinina', label: 'Função renal (creatinina)',intervalDays: 365,  icon: '🫘' },
  { key: 'ecg',        label: 'Eletrocardiograma',        intervalDays: 730,  icon: '📈' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function daysAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `${d} dias atrás`
}

function statusLabel(s: Appointment['status']) {
  if (s === 'confirmed') return { text: 'Confirmado',          color: '#16A34A', bg: '#F0FDF4' }
  if (s === 'cancelled') return { text: 'Cancelado',           color: '#DC2626', bg: '#FEF2F2' }
  return                        { text: 'Aguard. confirmação', color: '#D97706', bg: '#FFFBEB' }
}

function riskStyle(level?: string) {
  if (level === 'alto')  return { color: '#DC2626', bg: '#FEF2F2', label: 'Risco Alto',  dot: 'bg-red-500'   }
  if (level === 'médio') return { color: '#D97706', bg: '#FFFBEB', label: 'Risco Médio', dot: 'bg-amber-500' }
  return                        { color: '#16A34A', bg: '#F0FDF4', label: 'Risco Baixo', dot: 'bg-green-500' }
}

const VC = {
  normal:   { border: '#10B981', bg: '#F0FDF4', label: '#065F46', darkBg: 'rgba(16,185,129,0.08)' },
  warning:  { border: '#F59E0B', bg: '#FFFBEB', label: '#92400E', darkBg: 'rgba(245,158,11,0.08)'  },
  critical: { border: '#EF4444', bg: '#FEF2F2', label: '#7F1D1D', darkBg: 'rgba(239,68,68,0.08)'   },
}

function vitalColor(key: string, val?: number) {
  if (val === undefined) return VC.normal
  type K = keyof typeof VC
  const s: K =
    key === 'fc'   ? (val <= 40 || val >= 131 ? 'critical' : val <= 50 || val >= 111 ? 'warning' : 'normal') :
    key === 'fr'   ? (val <= 8  || val >= 25  ? 'critical' : val <= 11              ? 'warning' : 'normal') :
    key === 'spo2' ? (val <= 91 ? 'critical' : val <= 95 ? 'warning' : 'normal') :
    key === 'temp' ? (val <= 35 || val >= 40  ? 'critical' : val <= 36 || val >= 38  ? 'warning' : 'normal') :
    key === 'pa'   ? (val <= 90 || val >= 220  ? 'critical' : val <= 100 || val >= 140 ? 'warning' : 'normal') :
    'normal'
  return VC[s]
}

function checkExamRecommendations(records: HistoryRecord[]): typeof EXAM_RECOMMENDATIONS {
  const now = Date.now()
  return EXAM_RECOMMENDATIONS.filter(rec => {
    const lastMatch = records
      .filter(r => r.summary?.toLowerCase().includes(rec.key) || r.details?.examName?.toLowerCase().includes(rec.key))
      .sort((a, b) => b.date - a.date)[0]
    return !lastMatch || (now - lastMatch.date) > rec.intervalDays * 86400000
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Modal contents ────────────────────────────────────────────────────────────

function TriagemModalContent({ record }: { record: HistoryRecord }) {
  const risk    = riskStyle(record.details?.riskLevel)
  const vitals  = record.details?.vitals
  const news2   = record.details?.news2?.total

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: risk.bg, color: risk.color }}>{risk.label}</span>
        <span className="text-xs text-slate-400">{fmtDate(record.date)}</span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 italic">{record.summary}</p>

      {news2 !== undefined && (
        <div className="flex items-center gap-4 p-4 rounded-2xl border-2" style={{ borderColor: risk.color, background: risk.bg }}>
          <div className="text-center">
            <div className="text-4xl font-black" style={{ color: risk.color }}>{news2}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', fontWeight: 700, color: risk.color, textTransform: 'uppercase' }}>NEWS2</div>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: risk.color }}>{risk.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">Escore de deterioração clínica</p>
          </div>
        </div>
      )}

      {vitals && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Freq. Cardíaca', key: 'fc',   value: vitals.fc,   unit: 'bpm'  },
            { label: 'Saturação O₂',  key: 'spo2', value: vitals.spo2, unit: '%'    },
            { label: 'Freq. Resp.',   key: 'fr',   value: vitals.fr,   unit: 'rpm'  },
            { label: 'Temperatura',   key: 'temp', value: vitals.temp, unit: '°C'   },
            { label: 'Pressão Art.',  key: 'pa',   value: vitals.pa,   unit: 'mmHg' },
          ].filter(v => v.value !== undefined).map(({ label, key, value, unit }) => {
            const vc = vitalColor(key, value)
            return (
              <div key={label} className="rounded-xl px-3 py-2.5" style={{ borderLeft: `3px solid ${vc.border}`, background: vc.bg }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: vc.label }}>{label}</p>
                <p className="font-bold text-slate-800 text-lg leading-tight mt-0.5">
                  {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
                </p>
              </div>
            )
          })}
        </div>
      )}

      {record.details?.notes && (
        <p className="text-xs text-slate-500 italic">{record.details.notes}</p>
      )}

      <button
        onClick={() => window.open(`${API_BASE}/app/exames/${record.id}/pdf`, '_blank')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        <Download size={15} /> Baixar laudo PDF
      </button>
    </div>
  )
}

function ExamModalContent({ exam, onShare, sharingId }: {
  exam: Exam
  onShare: (id: string, shared: boolean) => void
  sharingId: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950 rounded-2xl">
        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
          <FlaskConical size={20} />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{exam.examType}</p>
          <p className="text-xs text-slate-500">{exam.fileName}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Recebido em</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(exam.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Compartilhado com médico</span>
          <span className="font-medium" style={{ color: exam.shared ? '#16A34A' : '#DC2626' }}>
            {exam.shared ? 'Sim' : 'Não'}
          </span>
        </div>
        {exam.shared && exam.sharedUntil && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Compartilhado até</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(exam.sharedUntil)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={sharingId === exam.id}
          onClick={() => onShare(exam.id, exam.shared)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            exam.shared ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Share2 size={14} /> {exam.shared ? 'Revogar compartilhamento' : 'Compartilhar com médico'}
        </button>
        <button
          onClick={() => window.open(`${API_BASE}/app/exames/${exam.id}/pdf`, '_blank')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-[#0079C8] text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
          <Download size={14} /> PDF
        </button>
      </div>
    </div>
  )
}

function AppointmentModalContent({ appt, onCancel, cancelling }: {
  appt: Appointment
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  const badge = statusLabel(appt.status)
  const canCancel = appt.status === 'pending' || appt.status === 'confirmed'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
        <span className="text-xs text-slate-400">{fmtDateTime(appt.scheduledAt)}</span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${appt.type === 'telechamada' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-[#0079C8]'}`}>
            {appt.type === 'telechamada' ? <Video size={16} /> : <MapPin size={16} />}
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 capitalize">{appt.type}</p>
            <p className="text-xs text-slate-500">{appt.type === 'telechamada' ? 'Consulta por videochamada' : 'Consulta presencial'}</p>
          </div>
        </div>

        {appt.notes && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-100 dark:border-amber-900">
            <p className="text-xs text-amber-700 dark:text-amber-400 italic">{appt.notes}</p>
          </div>
        )}
      </div>

      {appt.type === 'telechamada' && appt.status === 'confirmed' && (
        <a
          href={`/videochamada/${appt.id}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <Video size={15} /> Iniciar videochamada
        </a>
      )}

      <a
        href="/paciente/conversa"
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0079C8] text-white text-sm font-semibold hover:bg-[#0060a0] transition-colors"
      >
        <MessageCircle size={15} /> Enviar mensagem ao médico
      </a>

      {canCancel && (
        <button
          onClick={() => onCancel(appt.id)}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {cancelling ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />} Cancelar consulta
        </button>
      )}
    </div>
  )
}

// ── Booking form ──────────────────────────────────────────────────────────────

function BookAppointmentForm({ onSubmit, submitting }: {
  onSubmit: (data: { type: 'presencial' | 'telechamada'; scheduledAt: number; notes: string }) => void
  submitting: boolean
}) {
  // Sensible prefilled defaults so the flow is reachable in a couple of clicks
  // during a live demo (tomorrow @ 09:00, presencial).
  const tomorrow = new Date(Date.now() + 86400000)
  const [type, setType]   = useState<'presencial' | 'telechamada'>('presencial')
  const [date, setDate]   = useState(() => tomorrow.toISOString().slice(0, 10))
  const [time, setTime]   = useState('09:00')
  const [notes, setNotes] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const scheduledAt = new Date(`${date}T${time}`).getTime()
    if (isNaN(scheduledAt)) return
    onSubmit({ type, scheduledAt, notes: notes.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-tour="modal">
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo de consulta</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {([['presencial', MapPin, 'Presencial'], ['telechamada', Video, 'Telechamada']] as const).map(([val, Icon, label]) => (
            <button
              type="button"
              key={val}
              onClick={() => setType(val)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                type === val
                  ? 'border-green-600 bg-green-50 dark:bg-green-950 text-green-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data</label>
          <input
            type="date" value={date} min={new Date().toISOString().slice(0, 10)}
            onChange={e => setDate(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-green-600"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Horário</label>
          <input
            type="time" value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-green-600"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observações (opcional)</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Ex.: retorno, ajuste de medicação…"
          className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-green-600 resize-none placeholder:text-slate-400"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />} Solicitar agendamento
      </button>
    </form>
  )
}

// ── ExamRecommendationBanner ──────────────────────────────────────────────────

function ExamRecommendationBanner({ recommendations }: { recommendations: typeof EXAM_RECOMMENDATIONS }) {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('exam-recs-dismissed') === 'true'
  )

  if (dismissed || recommendations.length === 0) return null

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Bell size={16} className="text-[#0079C8] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0079C8] mb-1">
            {recommendations.length} exame{recommendations.length > 1 ? 's' : ''} recomendado{recommendations.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
            Com base nas diretrizes do Ministério da Saúde e SBMFC para atenção preventiva:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map(r => (
              <span key={r.key} className="text-xs bg-white dark:bg-blue-900 text-[#0079C8] border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full font-medium">
                {r.icon} {r.label}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => { setDismissed(true); localStorage.setItem('exam-recs-dismissed', 'true') }}
          className="text-blue-400 hover:text-blue-600 p-0.5 shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── HealthSummaryStrip ────────────────────────────────────────────────────────

function HealthSummaryStrip({ latestTriagem, upcoming, news2, risk }: {
  latestTriagem: HistoryRecord | null
  upcoming: Appointment[]
  news2?: number
  risk: ReturnType<typeof riskStyle>
}) {
  if (!latestTriagem) return null

  const nextAppt = upcoming[0]
  const daysToNext = nextAppt ? Math.ceil((nextAppt.scheduledAt - Date.now()) / 86400000) : null

  const items = [
    {
      icon: <ShieldCheck size={15} />,
      label: 'Nível de risco',
      value: risk.label.replace('Risco ', ''),
      color: risk.color,
      bg: risk.bg,
    },
    ...(news2 !== undefined ? [{
      icon: <Activity size={15} />,
      label: 'NEWS2',
      value: `${news2} pts`,
      color: risk.color,
      bg: risk.bg,
    }] : []),
    {
      icon: <HeartPulse size={15} />,
      label: 'Última triagem',
      value: daysAgo(latestTriagem.date),
      color: '#0079C8',
      bg: '#EBF5FF',
    },
    ...(nextAppt ? [{
      icon: <CalendarDays size={15} />,
      label: 'Próx. consulta',
      value: daysToNext === 0 ? 'Hoje' : `em ${daysToNext}d`,
      color: '#7C3AED',
      bg: '#F5F3FF',
    }] : []),
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: item.bg, color: item.color }}>
            {item.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">{item.label}</p>
            <p className="text-sm font-bold truncate" style={{ color: item.color }}>{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Clinical insight summary ──────────────────────────────────────────────────

function ClinicalInsight({ riskLevel, news2, vitals, isDemo }: {
  riskLevel?: string
  news2?: number
  vitals?: { fc?: number; fr?: number; spo2?: number; temp?: number; pa?: number }
  isDemo?: boolean
}) {
  const level = riskLevel ?? 'baixo'
  const { profile } = usePatientProfile(DEMO_PATIENT)

  const cfgMap = {
    baixo: { mark: '✓', title: 'Você está bem!',               text: 'Todos os sinais vitais dentro da normalidade. Continue com os bons hábitos e mantenha o monitoramento regular.', color: '#16A34A', bg: '#F0FDF4' },
    médio: { mark: '⚠', title: 'Atenção moderada',              text: 'Alguns indicadores merecem acompanhamento. Recomendamos agendar uma consulta de revisão preventiva em breve.', color: '#D97706', bg: '#FFFBEB' },
    alto:  { mark: '!', title: 'Procure seu médico',             text: 'Indicadores fora dos parâmetros normais. Agende uma consulta com urgência para avaliação clínica.', color: '#DC2626', bg: '#FEF2F2' },
  }

  const cfg = cfgMap[level as keyof typeof cfgMap] ?? cfgMap.baixo

  const highlights = [
    vitals?.fc   !== undefined && `FC ${vitals.fc} bpm`,
    vitals?.spo2 !== undefined && `SpO₂ ${vitals.spo2}%`,
    vitals?.temp !== undefined && `${vitals.temp} °C`,
    vitals?.pa   !== undefined && `PA ${vitals.pa} mmHg`,
  ].filter(Boolean).join('  ·  ')

  return (
    <div className='flex flex-col gap-3'>
      <div className="rounded-xl p-3.5 flex gap-3" style={{ background: cfg.bg }}>
        <div className="text-sm font-black shrink-0 mt-0.5 w-4 text-center" style={{ color: cfg.color }}>{cfg.mark}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.title}</p>
            {news2 !== undefined && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/80" style={{ color: cfg.color }}>
                NEWS2 · {news2} pts
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{cfg.text}</p>
          {highlights && <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{highlights}</p>}
          {isDemo && (
            <p className="text-[10px] text-slate-400 italic mt-1.5">
              Dados demonstrativos — realize uma triagem no totem para ver seus dados reais
            </p>
          )}
        </div>
      </div>
      <div data-tour="saude-meus-dados">
        <MeusDadosCard profile={profile} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PacienteDashboard() {
  const [tab, setTab]             = useState<Tab>('saude')
  const wearables                 = useWearables(DEMO_PATIENT)
  const [appointments, setAppts]  = useState<Appointment[]>([])
  const [exams, setExams]         = useState<Exam[]>([])
  const [records, setRecords]     = useState<HistoryRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [sharingId, setSharingId] = useState<string | null>(null)

  // Consultas filters
  const [cStatus, setCStatus] = useState<'todos' | 'pending' | 'confirmed'>('todos')
  const [cType,   setCType]   = useState<'todos' | 'presencial' | 'telechamada'>('todos')
  // Registros filters
  const [rFilter, setRFilter] = useState<'todos' | 'exames' | 'triagens'>('todos')
  const [rSort,   setRSort]   = useState<'recente' | 'antigo'>('recente')
  const [cSearch, setCSearch] = useState('')
  const [rSearch, setRSearch] = useState('')

  // Modal state
  const [triModal, setTriModal]   = useState<HistoryRecord | null>(null)
  const [examModal, setExamModal] = useState<Exam | null>(null)
  const [apptModal, setApptModal] = useState<Appointment | null>(null)

  // Consultas booking + view
  const [booking, setBooking]       = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cView, setCView]           = useState<'lista' | 'calendario'>('lista')

  useEffect(() => {
    const handler = (e: Event) => setTab((e as CustomEvent).detail as Tab)
    window.addEventListener('paciente-tab', handler)
    return () => window.removeEventListener('paciente-tab', handler)
  }, [])

  // Back from a wearable OAuth round-trip (/paciente?connected=… | ?error=…):
  // jump to the Integrações tab, refresh the connection list, and tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('connected') || params.has('error')) {
      setTab('integracoes')
      wearables.reload?.()
      window.history.replaceState({}, '', '/paciente')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lets the platform tour open/close the "Agendar consulta" popup.
  useEffect(() => {
    const open = () => setBooking(true)
    const close = () => { setBooking(false); setTriModal(null); setExamModal(null); setApptModal(null) }
    window.addEventListener('paciente-open-modal', open)
    window.addEventListener('tour-close-modals', close)
    return () => {
      window.removeEventListener('paciente-open-modal', open)
      window.removeEventListener('tour-close-modals', close)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      apiFetch<{ appointments: Appointment[] }>('/app/agendamentos'),
      apiFetch<{ exams: Exam[] }>('/app/exames'),
      apiFetch<{ records: HistoryRecord[] }>('/app/history'),
    ])
      .then(([a, e, h]) => {
        setAppts(a.appointments.filter(ap => ap.patientName === DEMO_PATIENT))
        setExams(e.exams.filter(ex => ex.patientName === DEMO_PATIENT))
        setRecords(h.records.filter(r => r.patientName === DEMO_PATIENT))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleShare = useCallback(async (examId: string, currentlyShared: boolean) => {
    setSharingId(examId)
    try {
      if (currentlyShared) {
        await fetch(`${API_BASE}/app/exames/${examId}/share`, { method: 'DELETE' })
        setExams(prev => prev.map(e => e.id === examId ? { ...e, shared: false, sharedUntil: null } : e))
        if (examModal?.id === examId) setExamModal(prev => prev ? { ...prev, shared: false, sharedUntil: null } : null)
      } else {
        const r = await fetch(`${API_BASE}/app/exames/${examId}/share`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        })
        const data = await r.json()
        setExams(prev => prev.map(e => e.id === examId ? { ...e, shared: true, sharedUntil: data.sharedUntil } : e))
        if (examModal?.id === examId) setExamModal(prev => prev ? { ...prev, shared: true, sharedUntil: data.sharedUntil } : null)
      }
    } catch { /* noop */ }
    finally { setSharingId(null) }
  }, [examModal])

  // Book a new appointment (defaults to pending; appears instantly for médico too).
  const handleBook = useCallback(async (data: { type: 'presencial' | 'telechamada'; scheduledAt: number; notes: string }) => {
    setBookingBusy(true)
    try {
      const { id } = await apiFetch<{ id: string }>('/app/agendamentos', {
        method: 'POST',
        body: JSON.stringify({
          patientName: DEMO_PATIENT,
          type: data.type,
          scheduledAt: data.scheduledAt,
          notes: data.notes || undefined,
        }),
      })
      // Optimistic insert so the new consulta shows up immediately.
      setAppts(prev => [...prev, {
        id, patientName: DEMO_PATIENT, type: data.type,
        status: 'pending', scheduledAt: data.scheduledAt,
        notes: data.notes || null,
      }])
      setBooking(false)
    } catch (err) { console.error(err) }
    finally { setBookingBusy(false) }
  }, [])

  const handleCancelAppt = useCallback(async (id: string) => {
    setCancelling(true)
    try {
      await apiFetch(`/app/agendamentos/${id}/cancel`, { method: 'PUT', body: '{}' })
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
      setApptModal(null)
    } catch (err) { console.error(err) }
    finally { setCancelling(false) }
  }, [])

  // Derived data
  const upcoming         = appointments.filter(a => a.status !== 'cancelled' && a.scheduledAt > Date.now())
  const latestTriagem    = records.find(r => r.type === 'triagem')
  const effectiveTriagem = latestTriagem ?? DEMO_TRIAGEM
  const effectiveVitals  = effectiveTriagem.details?.vitals
  const effectiveRisk    = effectiveTriagem.details?.riskLevel
  const effectiveNews2   = effectiveTriagem.details?.news2?.total
  const risk             = riskStyle(effectiveRisk)
  const pendingCount  = upcoming.filter(a => a.status === 'pending').length
  const sharedCount   = exams.filter(e => e.shared).length
  // Uploaded/attached exams (exams table) also satisfy recommendations, not just triagens.
  const examAsRecords: HistoryRecord[] = exams.map(e => ({
    id: e.id, type: 'exame', patientName: e.patientName, date: e.createdAt,
    summary: e.examType, details: { examName: e.examType, fileName: e.fileName },
  }))
  const recommendations = checkExamRecommendations([...records, ...examAsRecords])

  // Lift tab navigation into the unified Header (paciente uses the green accent).
  useRegisterHeaderTabs({
    accent: '#16A34A',
    active: tab,
    onSelect: id => setTab(id as Tab),
    tabs: [
      { id: 'saude',       label: 'Saúde',       Icon: Activity     },
      { id: 'consultas',   label: 'Consultas',   Icon: CalendarDays, badge: pendingCount || undefined },
      { id: 'registros',   label: 'Registros',   Icon: FileText,     badge: sharedCount  || undefined },
      { id: 'integracoes', label: 'Integrações', Icon: Watch },
    ],
  }, [tab, pendingCount, sharedCount])

  const allRecords = [
    ...records.map(r => ({ ...r, _kind: 'record' as const })),
    ...exams.map(e => ({
      id: e.id, type: 'exame' as const, patientName: e.patientName,
      date: e.createdAt, summary: e.examType,
      details: { examName: e.examType, fileName: e.fileName },
      _kind: 'exam' as const, _exam: e,
    })),
  ].sort((a, b) => b.date - a.date)

  const q = (s: string) => s.toLowerCase()

  const filteredConsultas = upcoming
    .filter(a => cStatus === 'todos' || a.status === cStatus)
    .filter(a => cType   === 'todos' || a.type   === cType)
    .filter(a => !cSearch || q(a.type).includes(q(cSearch)) || q(a.notes ?? '').includes(q(cSearch)))

  const filteredRecords = allRecords
    .filter(item => {
      if (rFilter === 'exames')   return item._kind === 'exam'
      if (rFilter === 'triagens') return item._kind === 'record'
      return true
    })
    .filter(item => !rSearch || q(item.summary).includes(q(rSearch)))
    .sort((a, b) => rSort === 'antigo' ? a.date - b.date : b.date - a.date)

  const vitalRows = [
    { label: 'Freq. Cardíaca', key: 'fc',   value: effectiveVitals?.fc,   unit: 'bpm'  },
    { label: 'Saturação O₂',  key: 'spo2', value: effectiveVitals?.spo2, unit: '%'    },
    { label: 'Freq. Resp.',   key: 'fr',   value: effectiveVitals?.fr,   unit: 'rpm'  },
    { label: 'Temperatura',   key: 'temp', value: effectiveVitals?.temp, unit: '°C'   },
    { label: 'Pressão Art.',  key: 'pa',   value: effectiveVitals?.pa,   unit: 'mmHg' },
  ].filter(v => v.value !== undefined)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-28 transition-colors">

      {/* ── Content ── */}
      <div className="px-6 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20 text-slate-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* ════════ Tab: Saúde ════════ */}
            {tab === 'saude' && (
              <div className="space-y-5">

                {/* Exam recommendations banner */}
                <div data-tour="saude-recomendados">
                  <ExamRecommendationBanner recommendations={recommendations} />
                </div>

                {/* Health summary strip */}
                <div data-tour="saude-status">
                  <HealthSummaryStrip
                    latestTriagem={effectiveTriagem}
                    upcoming={upcoming}
                    news2={effectiveNews2}
                    risk={risk}
                  />
                </div>

                {/* Atividade — wearables conectados */}
                <ActivityWidget providers={wearables.providers} />

                {/* Meus dados — perfil cadastral */}
                {/* <MeusDadosCard profile={profile} /> */}

                {/* Triagem card — sempre visível, com dados reais ou demo */}
                <div data-tour="saude-visualizacao" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-50 dark:border-slate-800">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: risk.bg, color: risk.color }}>
                      {risk.label}
                    </span>
                    <span className="text-xs text-slate-400">{fmtDate(effectiveTriagem.date)}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row">
                    <div className="flex justify-center sm:justify-start p-4 sm:p-5 shrink-0">
                      <DigitalTwin vitals={effectiveVitals ?? {}} riskLevel={effectiveRisk ?? null} />
                    </div>
                    <div className="flex-1 min-w-0 px-5 pb-5 pt-2 sm:pt-5 flex flex-col gap-4">
                      {/* NEWS2 */}
                      {effectiveNews2 !== undefined && (
                        <div className="flex items-center gap-4 p-4 rounded-2xl border-2" style={{ borderColor: risk.color, background: risk.bg }}>
                          <div className="text-center shrink-0">
                            <div className="text-4xl font-black leading-none" style={{ color: risk.color }}>{effectiveNews2}</div>
                            <div style={{ fontSize: 9, letterSpacing: '0.18em', fontWeight: 700, color: risk.color, textTransform: 'uppercase', marginTop: 2 }}>NEWS2</div>
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: risk.color }}>{risk.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Escore de deterioração clínica</p>
                          </div>
                        </div>
                      )}

                      {/* Vital cards */}
                      {vitalRows.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {vitalRows.map(({ label, key, value, unit }) => {
                            const vc = vitalColor(key, value)
                            return (
                              <div key={label} className="rounded-xl px-3 py-2.5" style={{ borderLeft: `3px solid ${vc.border}`, background: vc.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: vc.label }}>{label}</p>
                                <p className="font-bold text-slate-800 text-lg leading-tight mt-0.5">
                                  {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Resumão clínico inline */}
                      <ClinicalInsight
                        riskLevel={effectiveRisk}
                        news2={effectiveNews2}
                        vitals={effectiveVitals}
                        isDemo={!latestTriagem}
                      />
                    </div>
                  </div>
                </div>

                {/* Historical triagens */}
                {/* {records.filter(r => r.type === 'triagem').length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Histórico de triagens</p>
                    <div className="space-y-2">
                      {records.filter(r => r.type === 'triagem').slice(1).map(r => {
                        const rs = riskStyle(r.details?.riskLevel)
                        return (
                          <button
                            key={r.id}
                            onClick={() => setTriModal(r)}
                            className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3 hover:shadow-md transition-all group"
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rs.color }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{r.summary}</p>
                              <p className="text-xs text-slate-400">{fmtDate(r.date)}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )} */}
              </div>
            )}

            {/* ════════ Tab: Consultas ════════ */}
            {tab === 'consultas' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    data-tour="consultas-agendar"
                    onClick={() => setBooking(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    <Plus size={15} /> Agendar consulta
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setCView('lista')}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        cView === 'lista' ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <List size={12} /> Lista
                    </button>
                    <button
                      onClick={() => setCView('calendario')}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        cView === 'calendario' ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Calendar size={12} /> Calendário
                    </button>
                  </div>
                </div>
                <div data-tour="consultas-filtros" className="space-y-3">
                <SearchBar value={cSearch} onChange={setCSearch} placeholder="Buscar consulta…" />
                <ListControlsBar>
                  <div className="flex flex-col gap-1.5">
                    <FilterChips<'todos' | 'pending' | 'confirmed'>
                      options={[
                        { value: 'todos',     label: 'Todos' },
                        { value: 'pending',   label: 'Pendentes' },
                        { value: 'confirmed', label: 'Confirmados' },
                      ]}
                      value={cStatus}
                      onChange={setCStatus}
                      accent="#16A34A"
                    />
                    <FilterChips<'todos' | 'presencial' | 'telechamada'>
                      options={[
                        { value: 'todos',       label: 'Qualquer tipo' },
                        { value: 'presencial',  label: 'Presencial' },
                        { value: 'telechamada', label: 'Telechamada' },
                      ]}
                      value={cType}
                      onChange={setCType}
                      accent="#16A34A"
                    />
                  </div>
                </ListControlsBar>
                </div>
                <div data-tour="consultas-lista" className="space-y-3">
                {cView === 'calendario' ? (
                  <CalendarView appointments={filteredConsultas} onSelectAppt={setApptModal} />
                ) : filteredConsultas.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center text-slate-400">
                    <CalendarDays size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma consulta encontrada.</p>
                  </div>
                ) : (
                  filteredConsultas.map(appt => {
                    const badge = statusLabel(appt.status)
                    return (
                      <button
                        key={appt.id}
                        onClick={() => setApptModal(appt)}
                        className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-start gap-3 hover:shadow-md transition-all group"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          appt.type === 'telechamada' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-[#0079C8]'
                        }`}>
                          {appt.type === 'telechamada' ? <Video size={16} /> : <MapPin size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{appt.type}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock size={11} /> {fmtDateTime(appt.scheduledAt)}
                          </div>
                          {appt.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{appt.notes}</p>}
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-1" />
                      </button>
                    )
                  })
                )}
                </div>
              </div>
            )}

            {/* ════════ Tab: Registros (exams + triagens combined) ════════ */}
            {tab === 'registros' && (
              <div className="space-y-3">
                <div data-tour="registros-busca">
                <SearchBar value={rSearch} onChange={setRSearch} placeholder="Buscar exame ou triagem…" />
                </div>
                <div data-tour="registros-historico" className="space-y-3">
                <ListControlsBar>
                  <FilterChips<'todos' | 'exames' | 'triagens'>
                    options={[
                      { value: 'todos',    label: 'Todos',    count: allRecords.length },
                      { value: 'exames',   label: 'Exames',   count: allRecords.filter(r => r._kind === 'exam').length },
                      { value: 'triagens', label: 'Triagens', count: allRecords.filter(r => r._kind === 'record').length },
                    ]}
                    value={rFilter}
                    onChange={setRFilter}
                    accent="#16A34A"
                  />
                  <SortSelect<'recente' | 'antigo'>
                    options={[
                      { value: 'recente', label: 'Mais recente' },
                      { value: 'antigo',  label: 'Mais antigo' },
                    ]}
                    value={rSort}
                    onChange={setRSort}
                  />
                </ListControlsBar>
                {filteredRecords.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center text-slate-400">
                    <FileText size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum registro encontrado.</p>
                  </div>
                ) : (
                  filteredRecords.map(item => {
                    if (item._kind === 'exam') {
                      const exam = item._exam
                      return (
                        <button
                          key={`exam-${exam.id}`}
                          onClick={() => setExamModal(exam)}
                          className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3 hover:shadow-md transition-all group"
                        >
                          <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <FlaskConical size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{exam.examType}</p>
                            <p className="text-xs text-slate-400 truncate">{exam.fileName}</p>
                            {exam.shared && exam.sharedUntil && (
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-green-600">
                                <ShieldCheck size={11} /> Compartilhado até {fmtDate(exam.sharedUntil)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${exam.shared ? 'bg-green-50 text-green-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                              {exam.shared ? 'Compartilhado' : 'Privado'}
                            </span>
                            <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500" />
                          </div>
                        </button>
                      )
                    }

                    // Triagem record
                    const rs = riskStyle(item.details?.riskLevel)
                    return (
                      <button
                        key={`rec-${item.id}`}
                        onClick={() => setTriModal(item)}
                        className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3 hover:shadow-md transition-all group"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: rs.bg, color: rs.color }}>
                          <Activity size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">Triagem clínica</p>
                            {item.type === 'triagem' && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">triagem</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{item.summary}</p>
                          <p className="text-xs text-slate-400">{fmtDate(item.date)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rs.bg, color: rs.color }}>{rs.label}</span>
                          <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500" />
                        </div>
                      </button>
                    )
                  })
                )}
                </div>
              </div>
            )}
            {/* ════════ Tab: Integrações (wearables) ════════ */}
            {tab === 'integracoes' && (
              <WearablesTab
                providers={wearables.providers}
                loading={wearables.loading}
                connect={wearables.connect}
                disconnect={wearables.disconnect}
                startOAuth={wearables.startOAuth}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {triModal && (
        <Modal title="Detalhes da Triagem" onClose={() => setTriModal(null)}>
          <TriagemModalContent record={triModal} />
        </Modal>
      )}
      {examModal && (
        <Modal title="Detalhes do Exame" onClose={() => setExamModal(null)}>
          <ExamModalContent exam={examModal} onShare={handleShare} sharingId={sharingId} />
        </Modal>
      )}
      {apptModal && (
        <Modal title="Detalhes da Consulta" onClose={() => setApptModal(null)}>
          <AppointmentModalContent appt={apptModal} onCancel={handleCancelAppt} cancelling={cancelling} />
        </Modal>
      )}
      {booking && (
        <Modal title="Agendar consulta" onClose={() => setBooking(false)}>
          <BookAppointmentForm onSubmit={handleBook} submitting={bookingBusy} />
        </Modal>
      )}
    </div>
  )
}
