import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, FlaskConical, AlertTriangle, Stethoscope, Check } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface Notification {
  id: string
  recipientRole: string
  recipientName: string | null
  type: string
  title: string
  body: string
  relatedEntityId: string | null
  read: boolean
  createdAt: number
}

const TYPE_ICON: Record<string, typeof Bell> = {
  appointment: CalendarDays,
  exam: FlaskConical,
  risk: AlertTriangle,
  recommendation: Stethoscope,
}

function fmtAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotificationBell({ role, name }: { role: 'medico' | 'paciente'; name: string | null }) {
  const navigate = useNavigate()
  const [open, setOpen]   = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const qs = `role=${role}${name ? `&name=${encodeURIComponent(name)}` : ''}`

  const load = useCallback(async () => {
    try {
      const { notifications } = await apiFetch<{ notifications: Notification[] }>(`/app/notifications?${qs}`)
      setItems(notifications)
    } catch { /* noop */ }
  }, [qs])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    const onRefresh = () => load()
    window.addEventListener('notifications-refresh', onRefresh)
    return () => { clearInterval(t); window.removeEventListener('notifications-refresh', onRefresh) }
  }, [load])

  useEffect(() => {
    if (!open) return
    load()
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open, load])

  const unread = items.filter(n => !n.read).length

  function targetFor(n: Notification): { path: string; tab?: string } {
    if (role === 'medico') {
      if (n.type === 'risk' && n.relatedEntityId) return { path: `/medico/conversa/${encodeURIComponent(n.relatedEntityId)}` }
      return { path: '/medico' }
    }
    if (n.type === 'recommendation') return { path: '/paciente', tab: 'saude' }
    return { path: '/paciente', tab: 'consultas' }
  }

  async function openItem(n: Notification) {
    setOpen(false)
    if (!n.read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      apiFetch(`/app/notifications/${n.id}/read`, { method: 'PUT', body: '{}' }).catch(() => {})
    }
    const { path, tab } = targetFor(n)
    navigate(path)
    if (tab) setTimeout(() => window.dispatchEvent(new CustomEvent('paciente-tab', { detail: tab })), 60)
  }

  async function markAll() {
    setItems(prev => prev.map(x => ({ ...x, read: true })))
    apiFetch(`/app/notifications/read-all?${qs}`, { method: 'PUT', body: '{}' }).catch(() => {})
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notificações"
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Notificações</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-[#0079C8] hover:underline flex items-center gap-1">
                <Check size={12} /> Marcar todas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">
              <Bell size={28} className="mx-auto mb-2 opacity-30" />
              Nenhuma notificação.
            </div>
          ) : (
            items.map(n => {
              const Icon = TYPE_ICON[n.type] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    n.read ? '' : 'bg-blue-50/40 dark:bg-blue-950/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    n.type === 'risk' ? 'bg-red-50 text-red-600' : n.type === 'exam' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-[#0079C8]'
                  }`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#0079C8] shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtAgo(n.createdAt)}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
