import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Bot, User, Send, Square, X, MessageCircle, ChevronDown } from 'lucide-react'
import { apiFetch, apiStream } from '../lib/api'
import MarkdownMessage from './MarkdownMessage'

// Routes where the AI assistant should not appear (doctor has patient chat instead)
const HIDDEN_ON = ['/medico']

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface NewChatResponse { chatId: string }

export default function FloatingChat() {
  const loc = useLocation()
  const hidden = HIDDEN_ON.some(p => loc.pathname.startsWith(p))

  const [open, setOpen]           = useState(false)
  const [chatId, setChatId]       = useState<string | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [streamingText, setStream]= useState<string | null>(null)
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                  = useRef<HTMLDivElement>(null)
  const abortRef                   = useRef<AbortController | null>(null)
  const streamingRef               = useRef('')
  const textareaRef                = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 120)
  }, [open])

  async function sendMessage(e: { preventDefault: () => void }) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    let activeId = chatId
    if (!activeId) {
      try {
        const r = await apiFetch<NewChatResponse>('/app/chat/new', { method: 'POST', body: '{}' })
        activeId = r.chatId
        setChatId(activeId)
      } catch {
        setError('Não foi possível iniciar o chat.')
        return
      }
    }

    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    streamingRef.current = ''
    setStream('')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const gen = apiStream('/app/chat/message/stream', { chatId: activeId, message: text }, abort.signal)
      for await (const event of gen) {
        if (event.type === 'token') {
          streamingRef.current += event.value
          setStream(streamingRef.current)
        } else if (event.type === 'done') {
          setMessages(msgs => [...msgs, { role: 'assistant', content: streamingRef.current }])
          setStream(null)
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (streamingRef.current)
          setMessages(msgs => [...msgs, { role: 'assistant', content: streamingRef.current }])
        setStream(null)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
        setStream(null)
        setMessages(prev => prev.slice(0, -1))
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  function cancelStream() { abortRef.current?.abort() }

  function resetChat() {
    abortRef.current?.abort()
    setChatId(null)
    setMessages([])
    setStream(null)
    setInput('')
    setError(null)
  }

  if (hidden) return null

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0079C8] text-white shadow-lg hover:bg-[#0060a0] transition-all hover:scale-105 flex items-center justify-center"
          title="Assistente clínico"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[580px] flex flex-col rounded-2xl shadow-2xl border border-slate-100 bg-white overflow-hidden"
          style={{ animation: 'slideUp 0.2s ease' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0079C8] text-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <span className="font-semibold text-sm">Assistente CarePlus</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-xs"
                  title="Nova conversa"
                >
                  Nova
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Minimizar"
              >
                <ChevronDown size={18} />
              </button>
              <button
                onClick={() => { setOpen(false); resetChat() }}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">

            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 gap-2 py-8">
                <Bot size={36} className="text-[#0079C8] opacity-40" />
                <p className="text-sm font-medium">Olá! Sou seu assistente clínico.</p>
                <p className="text-xs">Pergunte sobre triagens, exames ou protocolos.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-[#0079C8] flex items-center justify-center">
                    <Bot size={13} className="text-white" />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed bg-[#0079C8] text-white">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-3 py-2 bg-slate-100 text-slate-800 text-sm">
                    <MarkdownMessage content={msg.content} />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                    <User size={13} className="text-slate-500" />
                  </div>
                )}
              </div>
            ))}

            {streamingText !== null && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 w-7 h-7 rounded-full bg-[#0079C8] flex items-center justify-center">
                  <Bot size={13} className="text-white" />
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-3 py-2 bg-slate-100 text-slate-800 text-sm">
                  {streamingText === '' ? (
                    <div className="flex items-center gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0s_infinite]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
                    </div>
                  ) : (
                    <MarkdownMessage content={streamingText} streaming />
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 text-center">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="border-t border-slate-100 px-3 py-2 flex gap-2 items-end shrink-0 bg-white"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) }
              }}
              placeholder="Digite sua mensagem..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0079C8]/30 focus:border-[#0079C8] disabled:opacity-50 transition-all max-h-24"
            />
            {loading ? (
              <button type="button" onClick={cancelStream}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-[#0079C8] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0060a0] transition-colors">
                <Send size={15} />
              </button>
            )}
          </form>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
