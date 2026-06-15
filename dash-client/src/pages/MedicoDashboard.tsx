import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, CalendarDays, FileText, CheckCircle2, XCircle,
  Clock, Video, MapPin, AlertTriangle, Loader2, FlaskConical,
  ChevronRight, Shield, MessageCircle, List, Calendar,
  Download, X,
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import { FilterChips, SortSelect, ListControlsBar, SearchBar } from '../components/ListControls'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
import { useRegisterHeaderTabs } from '../contexts/HeaderTabsContext'
import CalendarView from '../components/CalendarView'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient {
  name: string
  lastRecord: number
  lastSummary: string
  riskLevel: string | null
  totalRecords: number
  triagens: number
  exames: number
}

interface Appointment {
  id: string
  patientName: string
  doctorName: string
  type: 'presencial' | 'telechamada'
  status: 'pending' | 'confirmed' | 'cancelled'
  scheduledAt: number
  notes: string | null
  createdAt: number
}

interface SharedExam {
  id: string
  patientName: string
  examType: string
  fileName: string
  shared: boolean
  sharedUntil: number | null
  createdAt: number
}

type Tab        = 'pacientes' | 'agenda' | 'exames'
type AgendaView = 'lista' | 'calendario'
type PFilter    = 'todos' | 'alto' | 'médio' | 'baixo'
type PSort      = 'recente' | 'nome' | 'risco'
type AStatus    = 'todos' | 'pending' | 'confirmed'
type AType      = 'todos' | 'presencial' | 'telechamada'
type ASort      = 'proxima' | 'recente'
type ESort      = 'recente' | 'antigo' | 'paciente'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function riskColor(level: string | null) {
  if (level === 'alto')  return { bg: '#FEF2F2', text: '#DC2626', outline: '#FECACA90' }
  if (level === 'médio') return { bg: '#FFFBEB', text: '#D97706', outline: '#FDE68A80' }
  return { bg: '#F0FDF4', text: '#16A34A', outline: '#BBF7D090 ' }
}

function statusBadge(status: Appointment['status']) {
  if (status === 'confirmed') return { label: 'Confirmado', color: '#16A34A', bg: '#F0FDF4' }
  if (status === 'cancelled') return { label: 'Cancelado',  color: '#DC2626', bg: '#FEF2F2' }
  return { label: 'Pendente', color: '#D97706', bg: '#FFFBEB' }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
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

// ── Sub-components ────────────────────────────────────────────────────────────

function PatientCard({ patient }: { patient: Patient }) {
  const navigate = useNavigate()
  const risk     = riskColor(patient.riskLevel)

  return (
    <button
      onClick={() => navigate(`/medico/conversa/${encodeURIComponent(patient.name)}`)}
      className={`cursor-pointer w-full text-left rounded-2xl bg-white dark:bg-slate-900 p-4 hover:shadow-md transition-all group flex items-start gap-4`}
      style={{ outline: `solid 3px ${risk.outline}` }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: risk.bg, color: risk.text }}>
        {patient.riskLevel === 'alto' ? <AlertTriangle size={18} /> : <Shield size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{patient.name}</span>
          {patient.riskLevel && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: risk.bg, color: risk.text }}>
              {patient.riskLevel}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">{patient.lastSummary}</p>
        <div className="flex gap-3 text-xs text-slate-400">
          <span>{patient.triagens} triagem{patient.triagens !== 1 ? 's' : ''}</span>
          <span>{patient.exames} exame{patient.exames !== 1 ? 's' : ''}</span>
          <span>Último: {fmtDate(patient.lastRecord)}</span>
        </div>
      </div>
      <div className="hover:bg-blue-50 dark:hover:bg-blue-950 p-1 rounded-2xl flex items-center gap-1 shrink-0 text-xs font-medium text-[#0079C8] opacity-0 group-hover:opacity-100 transition-opacity mt-1">
        <MessageCircle size={14} />
        <span>Conversa</span>
        <ChevronRight size={14} />
      </div>
    </button>
  )
}

function AppointmentCard({
  appt, onConfirm, onCancel, onClick,
}: {
  appt: Appointment
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onClick: () => void
}) {
  const navigate = useNavigate()
  const badge    = statusBadge(appt.status)

  return (
    <div
      className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex gap-4 items-start cursor-pointer hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
        appt.type === 'telechamada' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-[#0079C8]'
      }`}>
        {appt.type === 'telechamada' ? <Video size={18} /> : <MapPin size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <button
            className="font-semibold text-slate-800 dark:text-slate-100 text-sm hover:text-[#0079C8] hover:underline"
            onClick={e => { e.stopPropagation(); navigate(`/medico/conversa/${encodeURIComponent(appt.patientName)}`) }}
          >
            {appt.patientName}
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
          <Clock size={11} /> {fmtDateTime(appt.scheduledAt)}
          <span className="text-slate-400">· {appt.type}</span>
        </div>
        {appt.notes && <p className="text-xs text-slate-400 italic truncate">{appt.notes}</p>}
      </div>
      {appt.status === 'pending' && (
        <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onConfirm(appt.id)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium">
            <CheckCircle2 size={13} /> Confirmar
          </button>
          <button onClick={() => onCancel(appt.id)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
            <XCircle size={13} /> Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Exam modal content ────────────────────────────────────────────────────────

function ExamModalContent({ exam }: { exam: SharedExam }) {
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
          <span className="text-slate-500">Paciente</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{exam.patientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tipo</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{exam.examType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Arquivo</span>
          <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{exam.fileName}</span>
        </div>
        {exam.sharedUntil && (
          <div className="flex justify-between">
            <span className="text-slate-500">Compartilhado até</span>
            <span className="font-medium text-green-700">{fmtDate(exam.sharedUntil)}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => window.open(`${API_BASE}/app/exames/${exam.id}/pdf`, '_blank')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-[#0079C8] text-sm font-semibold hover:bg-blue-100 transition-colors">
        <Download size={15} /> Baixar arquivo original
      </button>
    </div>
  )
}

// ── Appointment modal content ─────────────────────────────────────────────────

function ApptModalContent({ appt, onConfirm, onCancel }: {
  appt: Appointment
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}) {
  const navigate = useNavigate()
  const badge = statusBadge(appt.status)

  return (
    <div className="space-y-4" data-tour="modal">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
        <span className="text-xs text-slate-400">{fmtDateTime(appt.scheduledAt)}</span>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Paciente</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{appt.patientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tipo</span>
          <span className="font-medium text-slate-800 dark:text-slate-100 capitalize">{appt.type}</span>
        </div>
        {appt.notes && (
          <div>
            <span className="text-slate-500">Observações</span>
            <p className="text-slate-700 dark:text-slate-200 italic mt-0.5">{appt.notes}</p>
          </div>
        )}
      </div>

      {appt.type === 'telechamada' && appt.status === 'confirmed' && (
        <button
          onClick={() => navigate(`/videochamada/${appt.id}`)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <Video size={15} /> Iniciar videochamada
        </button>
      )}

      <div className="flex gap-2">
        {appt.status === 'pending' && (
          <>
            <button onClick={() => onConfirm(appt.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium transition-colors">
              <CheckCircle2 size={15} /> Confirmar
            </button>
            <button onClick={() => onCancel(appt.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-colors">
              <XCircle size={15} /> Cancelar
            </button>
          </>
        )}
        <button
          onClick={() => navigate(`/medico/conversa/${encodeURIComponent(appt.patientName)}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0079C8] text-white text-sm font-medium hover:bg-[#0060a0] transition-colors"
        >
          <MessageCircle size={15} /> Ver conversa
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function riskRank(r: string | null) {
  return r === 'alto' ? 2 : r === 'médio' ? 1 : 0
}

export default function MedicoDashboard() {
  const [tab,         setTab]       = useState<Tab>('pacientes')
  const [agendaView,  setAgendaView]= useState<AgendaView>('lista')
  const [patients,    setPatients]  = useState<Patient[]>([])
  const [appointments,setAppts]     = useState<Appointment[]>([])
  const [sharedExams, setExams]     = useState<SharedExam[]>([])
  const [loading,     setLoading]   = useState(true)

  // Per-tab filters & sorts
  const [pFilter, setPFilter] = useState<PFilter>('todos')
  const [pSort,   setPSort]   = useState<PSort>('recente')
  const [aStatus, setAStatus] = useState<AStatus>('todos')
  const [aType,   setAType]   = useState<AType>('todos')
  const [aSort,   setASort]   = useState<ASort>('proxima')
  const [eSort,   setESort]   = useState<ESort>('recente')

  // Search
  const [pSearch, setPSearch] = useState('')
  const [aSearch, setASearch] = useState('')
  const [eSearch, setESearch] = useState('')

  // Modals
  const [examModal, setExamModal]   = useState<SharedExam | null>(null)
  const [apptModal, setApptModal]   = useState<Appointment | null>(null)

  // Lets the platform tour switch tabs while walking through this dashboard.
  useEffect(() => {
    const handler = (e: Event) => setTab((e as CustomEvent).detail as Tab)
    window.addEventListener('medico-tab', handler)
    return () => window.removeEventListener('medico-tab', handler)
  }, [])

  // Lets the platform tour open/close the appointment detail modal.
  useEffect(() => {
    const open = () => {
      const demo: Appointment = appointments[0] ?? {
        id: 'tour-demo', patientName: 'João da Silva', doctorName: 'Dra. Helena',
        type: 'telechamada', status: 'confirmed',
        scheduledAt: Date.now() + 86400000, notes: 'Consulta de retorno — revisão de exames.',
        createdAt: Date.now(),
      }
      setApptModal(demo)
    }
    const close = () => { setApptModal(null); setExamModal(null) }
    window.addEventListener('medico-open-modal', open)
    window.addEventListener('tour-close-modals', close)
    return () => {
      window.removeEventListener('medico-open-modal', open)
      window.removeEventListener('tour-close-modals', close)
    }
  }, [appointments])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch<{ patients: Patient[] }>('/app/medico/patients'),
      apiFetch<{ appointments: Appointment[] }>('/app/medico/agenda'),
      apiFetch<{ exams: SharedExam[] }>('/app/medico/exames'),
    ])
      .then(([p, a, e]) => { setPatients(p.patients); setAppts(a.appointments); setExams(e.exams) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleConfirm(id: string) {
    await apiFetch(`/app/agendamentos/${id}/confirm`, { method: 'PUT', body: '{}' })
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' } : a))
    setApptModal(prev => prev?.id === id ? { ...prev, status: 'confirmed' } : prev)
  }

  async function handleCancel(id: string) {
    await apiFetch(`/app/agendamentos/${id}/cancel`, { method: 'PUT', body: '{}' })
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
    setApptModal(prev => prev?.id === id ? { ...prev, status: 'cancelled' } : prev)
  }

  const pending   = appointments.filter(a => a.status === 'pending').length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const highRisk  = patients.filter(p => p.riskLevel === 'alto').length

  // Lift tab navigation into the unified Header; fold the old KPI counts into tab badges.
  useRegisterHeaderTabs({
    accent: '#0079C8',
    active: tab,
    onSelect: id => setTab(id as Tab),
    tabs: [
      { id: 'pacientes', label: 'Pacientes', Icon: Users,        badge: highRisk || undefined },
      { id: 'agenda',    label: 'Agenda',    Icon: CalendarDays, badge: pending  || undefined },
      { id: 'exames',    label: 'Exames',    Icon: FileText,     badge: sharedExams.length || undefined },
    ],
  }, [tab, highRisk, pending, sharedExams.length])

  const q = (s: string) => s.toLowerCase()

  const filteredPatients = patients
    .filter(p => pFilter === 'todos' || p.riskLevel === pFilter)
    .filter(p => !pSearch || q(p.name).includes(q(pSearch)) || q(p.lastSummary ?? '').includes(q(pSearch)))
    .sort((a, b) =>
      pSort === 'nome'  ? a.name.localeCompare(b.name) :
      pSort === 'risco' ? riskRank(b.riskLevel) - riskRank(a.riskLevel) :
      b.lastRecord - a.lastRecord
    )

  const filteredAppts = [...appointments]
    .filter(a => aStatus === 'todos' || a.status === aStatus)
    .filter(a => aType   === 'todos' || a.type   === aType)
    .filter(a => !aSearch || q(a.patientName).includes(q(aSearch)) || q(a.notes ?? '').includes(q(aSearch)))
    .sort((a, b) => aSort === 'recente' ? b.scheduledAt - a.scheduledAt : a.scheduledAt - b.scheduledAt)

  const filteredExams = [...sharedExams]
    .filter(e => !eSearch || q(e.patientName).includes(q(eSearch)) || q(e.examType).includes(q(eSearch)) || q(e.fileName).includes(q(eSearch)))
    .sort((a, b) =>
      eSort === 'antigo'   ? a.createdAt - b.createdAt :
      eSort === 'paciente' ? a.patientName.localeCompare(b.patientName) :
      b.createdAt - a.createdAt
    )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-28 transition-colors">

      {/* Content */}
      <div className="px-6 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : (
          <>
              {/* ── Pacientes ── */}
            {tab === 'pacientes' && (
              <div className="space-y-3">
                <div data-tour="pacientes-filtros" className="space-y-3">
                <SearchBar value={pSearch} onChange={setPSearch} placeholder="Buscar paciente…" />
                <ListControlsBar>
                  <FilterChips<PFilter>
                    options={[
                      { value: 'todos', label: 'Todos',       count: patients.length },
                      { value: 'alto',  label: 'Risco alto',  count: patients.filter(p => p.riskLevel === 'alto').length },
                      { value: 'médio', label: 'Risco médio', count: patients.filter(p => p.riskLevel === 'médio').length },
                      { value: 'baixo', label: 'Risco baixo', count: patients.filter(p => !p.riskLevel || p.riskLevel === 'baixo').length },
                    ]}
                    value={pFilter}
                    onChange={setPFilter}
                  />
                  <SortSelect<PSort>
                    options={[
                      { value: 'recente', label: 'Último registro' },
                      { value: 'nome',    label: 'Nome A-Z' },
                      { value: 'risco',   label: 'Maior risco' },
                    ]}
                    value={pSort}
                    onChange={setPSort}
                  />
                </ListControlsBar>
                </div>
                <div data-tour="pacientes-lista" className="space-y-3">
                {filteredPatients.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <Users size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum paciente encontrado.</p>
                  </div>
                )}
                {filteredPatients.map(p => (
                  <PatientCard key={p.name} patient={p} />
                ))}
                </div>
              </div>
            )}

            {/* ── Agenda ── */}
            {tab === 'agenda' && (
              <div className="space-y-3">
                <div data-tour="agenda-busca">
                <SearchBar value={aSearch} onChange={setASearch} placeholder="Buscar por paciente ou observações…" />
                </div>
                <div data-tour="agenda-filtros" className="space-y-2 mb-1">
                  <ListControlsBar>
                    <FilterChips<AStatus>
                      options={[
                        { value: 'todos',     label: 'Todos' },
                        { value: 'pending',   label: 'Pendentes',   count: pending },
                        { value: 'confirmed', label: 'Confirmados', count: confirmed },
                      ]}
                      value={aStatus}
                      onChange={setAStatus}
                    />
                    <SortSelect<ASort>
                      options={[
                        { value: 'proxima',  label: 'Mais próxima' },
                        { value: 'recente',  label: 'Mais recente' },
                      ]}
                      value={aSort}
                      onChange={setASort}
                    />
                  </ListControlsBar>
                  <div className="flex items-center justify-between">
                    <FilterChips<AType>
                      options={[
                        { value: 'todos',       label: 'Qualquer tipo' },
                        { value: 'presencial',  label: 'Presencial' },
                        { value: 'telechamada', label: 'Telechamada' },
                      ]}
                      value={aType}
                      onChange={setAType}
                    />
                    <div data-tour="agenda-calendario" className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setAgendaView('lista')}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          agendaView === 'lista'
                            ? 'bg-[#0079C8] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <List size={12} /> Lista
                      </button>
                      <button
                        onClick={() => setAgendaView('calendario')}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          agendaView === 'calendario'
                            ? 'bg-[#0079C8] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Calendar size={12} /> Calendário
                      </button>
                    </div>
                  </div>
                </div>

                <div data-tour="agenda-consultas" className="space-y-3">
                {agendaView === 'calendario' ? (
                  <CalendarView appointments={filteredAppts} onSelectAppt={setApptModal} />
                ) : (
                  <>
                    {filteredAppts.length === 0 && (
                      <div className="text-center py-16 text-slate-400">
                        <CalendarDays size={40} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma consulta encontrada.</p>
                      </div>
                    )}
                    {filteredAppts.map(appt => (
                      <AppointmentCard
                        key={appt.id}
                        appt={appt}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        onClick={() => setApptModal(appt)}
                      />
                    ))}
                  </>
                )}
                </div>
              </div>
            )}

            {/* ── Exames compartilhados ── */}
            {tab === 'exames' && (
              <div className="space-y-3">
                <div data-tour="exames-busca">
                <SearchBar value={eSearch} onChange={setESearch} placeholder="Buscar por paciente, tipo ou arquivo…" />
                </div>
                <div data-tour="exames-lista" className="space-y-3">
                <ListControlsBar>
                  <span className="text-xs text-slate-400">{filteredExams.length} exame{filteredExams.length !== 1 ? 's' : ''}</span>
                  <SortSelect<ESort>
                    options={[
                      { value: 'recente',  label: 'Mais recente' },
                      { value: 'antigo',   label: 'Mais antigo' },
                      { value: 'paciente', label: 'Paciente A-Z' },
                    ]}
                    value={eSort}
                    onChange={setESort}
                  />
                </ListControlsBar>
                {filteredExams.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <FlaskConical size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum exame compartilhado com você.</p>
                  </div>
                )}
                {filteredExams.map(exam => (
                  <button
                    key={exam.id}
                    onClick={() => setExamModal(exam)}
                    className="w-full text-left rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-4 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FlaskConical size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{exam.patientName}</p>
                      <p className="text-xs text-slate-500 truncate">{exam.examType} · {exam.fileName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Até {exam.sharedUntil ? fmtDate(exam.sharedUntil) : '—'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </button>
                ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {examModal && (
        <Modal title="Detalhes do Exame" onClose={() => setExamModal(null)}>
          <ExamModalContent exam={examModal} />
        </Modal>
      )}
      {apptModal && (
        <Modal title="Detalhes da Consulta" onClose={() => setApptModal(null)}>
          <ApptModalContent appt={apptModal} onConfirm={handleConfirm} onCancel={handleCancel} />
        </Modal>
      )}
    </div>
  )
}
