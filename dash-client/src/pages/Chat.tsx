import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Bot, User, Square, Loader2 } from 'lucide-react'
import { apiFetch, apiStream } from '../lib/api'
import MarkdownMessage from '../components/MarkdownMessage'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface NewChatResponse { chatId: string }
interface SessionResponse { id: string; history: Array<{ role: string; content: string }> }

export default function Chat() {
  const { id: sessionId }               = useParams<{ id: string }>()
  const [chatId, setChatId]             = useState<string | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [streamingText, setStreaming]   = useState<string | null>(null)
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [initializing, setInitializing] = useState(!!sessionId)
  const [error, setError]               = useState<string | null>(null)
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const abortRef                        = useRef<AbortController | null>(null)
  // Accumulates tokens synchronously so the final commit never reads stale closure state
  const streamingRef                    = useRef('')

  // Resume an existing session when an id is present in the route
  useEffect(() => {
    if (!sessionId) return
    setInitializing(true)
    apiFetch<SessionResponse>(`/app/chat/${sessionId}`)
      .then(r => {
        setChatId(r.id)
        setMessages(r.history.map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        })))
      })
      .catch(() => setError('Não foi possível carregar a conversa.'))
      .finally(() => setInitializing(false))
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function sendMessage(e: { preventDefault: () => void }) {
    e.preventDefault()
    const text = input.trim()
    if (!text || initializing || loading) return

    // Lazy creation: only open a session when the user first sends a message
    let activeId = chatId
    if (!activeId) {
      try {
        const r = await apiFetch<NewChatResponse>('/app/chat/new', { method: 'POST', body: '{}' })
        activeId = r.chatId
        setChatId(activeId)
      } catch {
        setError('Não foi possível iniciar o chat. Verifique sua conexão.')
        return
      }
    }

    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    streamingRef.current = ''
    setStreaming('')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const gen = apiStream(
        '/app/chat/message/stream',
        { chatId: activeId, message: text },
        abort.signal,
      )

      for await (const event of gen) {
        if (event.type === 'token') {
          streamingRef.current += event.value
          setStreaming(streamingRef.current)
        } else if (event.type === 'done') {
          setMessages(msgs => [...msgs, { role: 'assistant', content: streamingRef.current }])
          setStreaming(null)
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (streamingRef.current) {
          setMessages(msgs => [...msgs, { role: 'assistant', content: streamingRef.current }])
        }
        setStreaming(null)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
        setStreaming(null)
        setMessages(prev => prev.slice(0, -1))
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  function cancelStream() {
    abortRef.current?.abort()
  }

  return (
    <div className="flex flex-col h-screen pt-17.5">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {initializing ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 size={32} className="animate-spin text-[#0079C8]" />
          </div>
        ) : messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 gap-3">
            <Bot size={48} className="text-[#0079C8] opacity-40" />
            <p className="text-base font-medium">Olá! Sou seu assistente clínico CarePlus.</p>
            <p className="text-sm">Pergunte sobre seus exames, triagens ou sinais vitais.</p>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#0079C8] flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
            )}
            {msg.role === 'user' ? (
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-[#0079C8] text-white">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-100 text-slate-800">
                <MarkdownMessage content={msg.content} />
              </div>
            )}
            {msg.role === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User size={16} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming bubble */}
        {streamingText !== null && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#0079C8] flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-100 text-slate-800">
              {streamingText === '' ? (
                <div className="flex items-center gap-1 py-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0s_infinite]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
                </div>
              ) : (
                <MarkdownMessage content={streamingText} streaming />
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={sendMessage}
        className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3 flex gap-3 items-end"
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(e)
            }
          }}
          placeholder="Digite sua mensagem..."
          rows={1}
          disabled={initializing || loading}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0079C8]/30 focus:border-[#0079C8] disabled:opacity-50 transition-all max-h-32"
          style={{ padding: '12px 16px', fontSize: '14px' }}
        />
        {loading ? (
          <button
            type="button"
            onClick={cancelStream}
            className="shrink-0 w-11 h-11 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors"
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || initializing}
            className="shrink-0 w-11 h-11 rounded-xl bg-[#0079C8] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0060a0] transition-colors"
          >
            <Send size={18} />
          </button>
        )}
      </form>
    </div>
  )
}
