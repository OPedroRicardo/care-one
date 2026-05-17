import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Loader2, Trash2, Check, X, Plus } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface ChatItem {
  id:           string
  createdAt:    number
  preview:      string | null
  messageCount: number
}

interface ListResponse { chats: ChatItem[] }

function formatDate(ts: number): string {
  const now  = Date.now()
  const diff = now - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)

  if (mins < 1)   return 'Agora mesmo'
  if (mins < 60)  return `${mins} min atrás`
  if (hours < 24) return `${hours}h atrás`
  if (days === 1) return 'Ontem'
  if (days < 7)   return `${days} dias atrás`

  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ChatList() {
  const navigate                          = useNavigate()
  const [chats, setChats]                 = useState<ChatItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  // Tracks which row is in confirm-delete mode
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting]           = useState<string | null>(null)

  const fetchChats = useCallback(() => {
    setLoading(true)
    apiFetch<ListResponse>('/app/chat/list')
      .then(r => { setChats(r.chats); setError(null) })
      .catch(() => setError('Não foi possível carregar as conversas.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await apiFetch('/app/chat/delete', {
        method: 'POST',
        body:   JSON.stringify({ chatId: id }),
      })
      setChats(prev => prev.filter(c => c.id !== id))
      setPendingDelete(null)
    } catch {
      setError('Não foi possível excluir a conversa.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-800">Conversas</h1>
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0079C8] text-white text-sm font-medium hover:bg-[#0060a0] transition-colors"
        >
          <Plus size={16} />
          Nova conversa
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-6">Seu histórico de conversas com o assistente</p>

      {loading && (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 size={32} className="animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 text-center">
          {error}
        </div>
      )}

      {!loading && !error && chats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <MessageSquare size={40} className="opacity-40" />
          <p className="text-sm">Nenhuma conversa ainda.</p>
          <button
            onClick={() => navigate('/chat')}
            className="mt-1 text-sm text-[#0079C8] font-medium hover:underline"
          >
            Iniciar primeira conversa
          </button>
        </div>
      )}

      {!loading && !error && chats.length > 0 && (
        <ul className="space-y-3">
          {chats.map(chat => {
            const isPending  = pendingDelete === chat.id
            const isDeleting = deleting === chat.id

            return (
              <li key={chat.id}>
                <div className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-4 shadow-sm hover:shadow-md hover:border-[#0079C8]/30 transition-all group">
                  {/* Icon */}
                  <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 text-[#0079C8] flex items-center justify-center">
                    <MessageSquare size={20} />
                  </div>

                  {/* Content — clickable area */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => !isPending && navigate(`/chat/${chat.id}`)}
                    disabled={isPending}
                  >
                    <p className="text-sm text-slate-700 truncate">
                      {chat.preview ?? <span className="italic text-slate-400">Sem mensagens</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{formatDate(chat.createdAt)}</span>
                      {chat.messageCount > 0 && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">
                            {chat.messageCount} {chat.messageCount === 1 ? 'mensagem' : 'mensagens'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Delete controls */}
                  {isPending ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleDelete(chat.id)}
                        disabled={isDeleting}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {isDeleting
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Check size={12} />
                        }
                        Confirmar
                      </button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setPendingDelete(chat.id) }}
                      className="shrink-0 p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
