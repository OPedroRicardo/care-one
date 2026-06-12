import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Send, Stethoscope, UserRound, Loader2,
  Activity, FlaskConical, HeartPulse, Thermometer, X,
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import DigitalTwin from '../components/DigitalTwin'
import { usePatientProfile, PatientProfileSnippet } from '../components/PatientProfile'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attachment { id: string; examType: string; fileName: string }

interface ChatMessage {
  id: number
  patientName: string
  senderRole: 'medico' | 'paciente'
  content: string
  attachment?: Attachment | null
  createdAt: number
}

interface TriagemDetails {
  riskLevel?: string
  news2?: { total: number; fr?: number; fc?: number; spo2?: number; temp?: number; pa?: number }
  vitals?: { fr?: number; fc?: number; spo2?: number; temp?: number; pa?: number }
}

interface HistoryRecord {
  id: string
  type: 'triagem' | 'exame'
  patientName: string
  date: number
  summary: string
  details: TriagemDetails | Record<string, unknown> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isDoctor = msg.senderRole === 'medico'
  return (
    <div className={`flex gap-2 ${isDoctor ? 'justify-end' : 'justify-start'}`}>
      {!isDoctor && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
          <UserRound size={14} />
        </div>
      )}
      <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isDoctor
          ? 'bg-[#0079C8] text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
      }`}>
        <p>{msg.content}</p>
        {msg.attachment && (
          <div className={`flex items-center gap-2 mt-2 rounded-lg px-2.5 py-1.5 ${
            isDoctor ? 'bg-white/15' : 'bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900'
          }`}>
            <FlaskConical size={13} className={isDoctor ? 'text-white shrink-0' : 'text-purple-600 shrink-0'} />
            <div className="min-w-0">
              <p className={`text-xs font-semibold truncate ${isDoctor ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{msg.attachment.examType}</p>
              <p className={`text-[10px] truncate ${isDoctor ? 'text-blue-100' : 'text-slate-400'}`}>{msg.attachment.fileName}</p>
            </div>
          </div>
        )}
        <p className={`text-[10px] mt-1 ${isDoctor ? 'text-blue-200' : 'text-slate-400'}`}>
          {fmtTime(msg.createdAt)} · {isDoctor ? 'Dr. Silva' : msg.patientName}
        </p>
      </div>
      {isDoctor && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-[#0079C8] flex items-center justify-center">
          <Stethoscope size={14} />
        </div>
      )}
    </div>
  )
}

// ── Sidebar record cards ──────────────────────────────────────────────────────

function RecordCard({ record, onClick }: { record: HistoryRecord; onClick: () => void }) {
  const d = record.details as TriagemDetails | null
  const risk = d?.riskLevel
  const color =
    risk === 'alto'  ? '#DC2626' :
    risk === 'médio' ? '#D97706' : '#16A34A'
  const bg =
    risk === 'alto'  ? '#FEF2F2' :
    risk === 'médio' ? '#FFFBEB' : '#F0FDF4'

  if (record.type === 'exame') {
    return (
      <button
        onClick={onClick}
        className="w-full text-left p-3 rounded-xl border border-purple-100 bg-purple-50 hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={13} className="text-purple-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 truncate">{record.summary}</span>
        </div>
        <p className="text-[10px] text-slate-400">{fmtDate(record.date)}</p>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border transition-colors"
      style={{ background: bg, borderColor: color + '33' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Activity size={13} style={{ color }} className="shrink-0" />
        <span className="text-xs font-semibold text-slate-700 truncate">Triagem</span>
        {risk && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'white', color }}>
            {risk}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-500 truncate italic">{record.summary}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(record.date)}</p>
    </button>
  )
}

// ── Record detail modal ───────────────────────────────────────────────────────

function RecordDetailModal({ record, onClose }: { record: HistoryRecord; onClose: () => void }) {
  const d = record.details as TriagemDetails | null
  const vitals = d?.vitals ?? d?.news2
  const risk   = d?.riskLevel

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const riskColor =
    risk === 'alto'  ? { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' } :
    risk === 'médio' ? { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706' } :
                       { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">
            {record.type === 'triagem' ? 'Triagem clínica' : 'Exame'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">{fmtTime(record.date)}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 italic">{record.summary}</p>

          {record.type === 'triagem' && (
            <>
              {d?.news2 && (
                <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: riskColor.bg, borderColor: riskColor.border }}>
                  <span className="text-xs text-slate-500">NEWS2</span>
                  <span className="font-bold text-2xl ml-auto" style={{ color: riskColor.text }}>
                    {(d.news2 as { total: number }).total}
                  </span>
                  <span className="text-xs text-slate-400">pontos</span>
                </div>
              )}
              {vitals && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'FC',   value: vitals.fc,   unit: 'bpm', Icon: HeartPulse },
                    { label: 'SpO₂', value: vitals.spo2, unit: '%',   Icon: Activity },
                    { label: 'FR',   value: vitals.fr,   unit: 'rpm', Icon: Activity },
                    { label: 'Temp', value: vitals.temp, unit: '°C',  Icon: Thermometer },
                    { label: 'PA',   value: vitals.pa,   unit: 'mmHg',Icon: HeartPulse },
                  ]
                    .filter(v => v.value !== undefined)
                    .map(({ label, value, unit, Icon }) => (
                      <div key={label} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5">
                        <Icon size={12} style={{ color: riskColor.text }} />
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="ml-auto text-xs font-semibold text-slate-700 dark:text-slate-200">{value} {unit}</span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export default function MedicoConversa() {
  const { patientName = '' } = useParams<{ patientName: string }>()
  const decoded = decodeURIComponent(patientName)
  const { profile } = usePatientProfile(decoded)

  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [records,   setRecords]   = useState<HistoryRecord[]>([])
  const [loading,   setLoading]   = useState(true)
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [activeRec, setActiveRec] = useState<HistoryRecord | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function fetchData() {
    try {
      const { messages: msgs, records: recs } = await apiFetch<{
        messages: ChatMessage[]
        records:  HistoryRecord[]
      }>(`/app/medico/conversa/${encodeURIComponent(decoded)}`)
      setMessages(msgs.sort((a, b) => a.createdAt - b.createdAt))
      setRecords(recs.sort((a, b) => b.date - a.date))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [decoded])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(e: { preventDefault: () => void }) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    const optimistic: ChatMessage = {
      id: Date.now(), patientName: decoded, senderRole: 'medico',
      content: text, createdAt: Date.now(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      await fetch(`${API_BASE}/app/medico/conversa/${encodeURIComponent(decoded)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text, senderRole: 'medico' }),
      })
    } catch { /* optimistic already added */ }
    finally { setSending(false); textareaRef.current?.focus() }
  }

  const DEMO_VITALS_DT = { fc: 78, fr: 17, spo2: 97, temp: 37.1, pa: 125 }

  const latestTriagem  = records.find(r => r.type === 'triagem')
  const tDetails       = latestTriagem?.details as TriagemDetails | null
  const twinVitals     = tDetails?.vitals ?? tDetails?.news2
  const effectiveVitals = (twinVitals as typeof DEMO_VITALS_DT | undefined) ?? DEMO_VITALS_DT
  const effectiveRisk   = tDetails?.riskLevel ?? 'baixo'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-16 flex flex-col transition-colors">

      {/* Patient info strip */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
            <UserRound size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{decoded}</p>
            <p className="text-xs text-slate-400">Conversa médico–paciente</p>
          </div>
          {latestTriagem && (
            <span className="ml-auto text-xs text-slate-400">
              {records.length} registro{records.length !== 1 ? 's' : ''} clínico{records.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex max-w-5xl mx-auto w-full gap-0 min-h-0">

        {/* ── Sidebar: Digital Twin + clinical records ── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
          {/* Patient profile snippet */}
          <PatientProfileSnippet profile={profile} />

          {/* Digital twin — sempre visível (dados reais ou demo) */}
          <div className="p-4 pb-2 flex justify-center border-b border-slate-50 dark:border-slate-800">
            <DigitalTwin vitals={effectiveVitals} riskLevel={effectiveRisk} />
          </div>

          {/* Clinical records list */}
          <div className="p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 mb-3">
              Registros clínicos
            </p>
            <div className="flex flex-col space-y-2 overflow-y-auto h-[calc(100vh-650px)]">
              {records.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 italic">Nenhum registro ainda</p>
              ) : (
                records.map(rec => (
                  <RecordCard key={rec.id} record={rec} onClick={() => setActiveRec(rec)} />
                ))
              )}
            </div>
          </div>
        </aside>

        {/* ── Main: chat only ── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {loading && (
              <div className="flex justify-center py-16 text-slate-400">
                <Loader2 size={28} className="animate-spin" />
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
                <UserRound size={32} className="opacity-30" />
                <p>Nenhuma mensagem ainda com {decoded}.</p>
                <p className="text-xs">Os registros clínicos estão visíveis na barra lateral.</p>
              </div>
            )}

            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="border-t border-slate-100 dark:border-slate-800 dark:bg-slate-900 px-4 py-3 flex gap-2 items-end shrink-0"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) }
              }}
              placeholder={`Mensagem para ${decoded}...`}
              rows={1}
              disabled={sending}
              className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0079C8]/30 focus:border-[#0079C8] disabled:opacity-50 transition-all max-h-28"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="shrink-0 w-10 h-10 rounded-xl bg-[#0079C8] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0060a0] transition-colors"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>

      {activeRec && <RecordDetailModal record={activeRec} onClose={() => setActiveRec(null)} />}
    </div>
  )
}
