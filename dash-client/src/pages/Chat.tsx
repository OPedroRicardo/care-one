import { useState, useEffect, useRef, FormEvent } from 'react'
import { Send, Loader2, Bot, User } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface NewChatResponse   { chatId: string }
interface MessageResponse   { reply: string; sources: string[] }

export default function Chat() {
  const [chatId, setChatId]     = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef               = useRef<HTMLDivElement>(null)

  // Cria uma nova sessão de chat ao montar
  useEffect(() => {
    apiFetch<NewChatResponse>('/app/chat/new', { method: 'POST', body: '{}' })
      .then(r => setChatId(r.chatId))
      .catch(() => setError('Não foi possível iniciar o chat. Verifique sua conexão.'))
  }, [])

  // Scroll automático ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !chatId || loading) return

    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await apiFetch<MessageResponse>('/app/chat/message', {
        method: 'POST',
        body: JSON.stringify({ chatId, message: text }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
      // Remove a mensagem do usuário otimista em caso de falha
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen pt-17.5">
      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 gap-3 mb-0">
            <Bot size={48} className="text-[#0079C8] opacity-40" />
            <p className="text-base font-medium">Olá! Sou seu assistente clínico CarePlus.</p>
            <p className="text-sm">Pergunte sobre seus exames, triagens ou sinais vitais.</p>
          </div>
        )}

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

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#0079C8] text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>

            {msg.role === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User size={16} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#0079C8] flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Processando...
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

      {/* Input */}
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
              sendMessage(e as unknown as FormEvent)
            }
          }}
          placeholder="Digite sua mensagem..."
          rows={1}
          disabled={!chatId || loading}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0079C8]/30 focus:border-[#0079C8] disabled:opacity-50 transition-all max-h-32"
          style={{ padding: '12px 16px', fontSize: '14px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || !chatId || loading}
          className="shrink-0 w-11 h-11 rounded-xl bg-[#0079C8] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0060a0] transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
