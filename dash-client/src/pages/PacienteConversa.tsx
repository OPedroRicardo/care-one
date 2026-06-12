import { useState, useEffect, useRef } from 'react'
import { Send, Stethoscope, UserRound, Loader2, Paperclip, FlaskConical, X } from 'lucide-react'
import { apiFetch } from '../lib/api'

const DEMO_PATIENT = 'João da Silva'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

interface Attachment { id: string; examType: string; fileName: string }
interface ChatMessage {
  id: number
  patientName: string
  senderRole: 'medico' | 'paciente'
  content: string
  attachment?: Attachment | null
  createdAt: number
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function AttachmentChip({ attachment, light }: { attachment: Attachment; light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 mt-2 rounded-lg px-2.5 py-1.5 ${
      light ? 'bg-white/15' : 'bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900'
    }`}>
      <FlaskConical size={13} className={light ? 'text-white shrink-0' : 'text-purple-600 shrink-0'} />
      <div className="min-w-0">
        <p className={`text-xs font-semibold truncate ${light ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{attachment.examType}</p>
        <p className={`text-[10px] truncate ${light ? 'text-blue-100' : 'text-slate-400'}`}>{attachment.fileName}</p>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isPatient = msg.senderRole === 'paciente'
  return (
    <div className={`flex gap-2 ${isPatient ? 'justify-end' : 'justify-start'}`}>
      {!isPatient && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-[#0079C8] flex items-center justify-center">
          <Stethoscope size={14} />
        </div>
      )}
      <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isPatient
          ? 'bg-green-600 text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
      }`}>
        {msg.content && <p>{msg.content}</p>}
        {msg.attachment && <AttachmentChip attachment={msg.attachment} light={isPatient} />}
        <p className={`text-[10px] mt-1 ${isPatient ? 'text-green-100' : 'text-slate-400'}`}>
          {fmtTime(msg.createdAt)} · {isPatient ? msg.patientName : 'Dr. Silva'}
        </p>
      </div>
      {isPatient && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
          <UserRound size={14} />
        </div>
      )}
    </div>
  )
}

export default function PacienteConversa() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  async function fetchData() {
    try {
      const { messages: msgs } = await apiFetch<{ messages: ChatMessage[] }>(
        `/app/medico/conversa/${encodeURIComponent(DEMO_PATIENT)}`)
      setMessages(msgs.sort((a, b) => a.createdAt - b.createdAt))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(e: { preventDefault: () => void }) {
    e.preventDefault()
    const text = input.trim()
    if ((!text && !pendingFile) || sending) return

    setSending(true)
    setInput('')
    const file = pendingFile
    setPendingFile(null)

    try {
      let attachmentExamId: string | undefined
      if (file) {
        const fileData = await fileToBase64(file)
        const examType = file.name.replace(/\.[^.]+$/, '') || 'Exame anexado'
        const up = await apiFetch<{ id: string }>('/app/exames/upload', {
          method: 'POST',
          body: JSON.stringify({ patientName: DEMO_PATIENT, examType, fileName: file.name, fileData }),
        })
        attachmentExamId = up.id
      }

      await fetch(`${API_BASE}/app/medico/conversa/${encodeURIComponent(DEMO_PATIENT)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text || 'Enviei um exame.', senderRole: 'paciente', attachmentExamId }),
      })
      await fetchData()
    } catch (err) { console.error(err) }
    finally { setSending(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-16 flex flex-col transition-colors">

      {/* Doctor info strip */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-[#0079C8] flex items-center justify-center shrink-0">
            <Stethoscope size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Dr. Silva</p>
            <p className="text-xs text-slate-400">Converse e compartilhe exames com seu médico</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {loading && (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
              <Stethoscope size={32} className="opacity-30" />
              <p>Inicie a conversa com seu médico.</p>
              <p className="text-xs">Você pode anexar exames usando o clipe 📎.</p>
            </div>
          )}
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={send}
          className="border-t border-slate-100 dark:border-slate-800 dark:bg-slate-900 px-4 py-3 shrink-0"
        >
          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900 rounded-lg px-3 py-2">
              <FlaskConical size={14} className="text-purple-600 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate">{pendingFile.name}</span>
              <button type="button" onClick={() => setPendingFile(null)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input
              ref={fileRef} type="file" className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = '' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Anexar exame"
              className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 hover:border-purple-300 flex items-center justify-center transition-colors"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
              placeholder="Mensagem para Dr. Silva…"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-green-600 disabled:opacity-50 transition-all max-h-28"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingFile) || sending}
              className="shrink-0 w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-green-700 transition-colors"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
