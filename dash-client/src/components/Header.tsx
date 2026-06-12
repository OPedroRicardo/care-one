import { Home, MessageSquare, ClipboardList, MessagesSquare, Stethoscope, UserRound, Sun, Moon, MessageCircle } from "lucide-react"
import { useLocation, useNavigate, NavLink } from "react-router-dom"
import { useTheme } from "../contexts/ThemeContext"
import { useHeaderTabs } from "../contexts/HeaderTabsContext"
import NotificationBell from "./NotificationBell"

const DEMO_PATIENT = 'João da Silva'

const ROLE_MAP = {
  medico:   { label: 'Médico',   Icon: Stethoscope, color: '#7C3AED', bg: '#F5F3FF' },
  paciente: { label: 'Paciente', Icon: UserRound,   color: '#16A34A', bg: '#F0FDF4' },
} as const

type Role = keyof typeof ROLE_MAP

function getRole(pathname: string): Role | null {
  if (pathname.startsWith('/medico'))   return 'medico'
  if (pathname.startsWith('/paciente')) return 'paciente'
  return null
}

const DASHBOARD_ROOTS = ['/medico', '/paciente', '/chat', '/chats', '/history']

export default function Header() {
  const location          = useLocation()
  const navigate          = useNavigate()
  const { theme, toggle } = useTheme()
  const { config }        = useHeaderTabs()

  if (location.pathname === '/') return null

  const role       = getRole(location.pathname)
  const isRoot     = DASHBOARD_ROOTS.includes(location.pathname)
  const isChatArea = ['/chat', '/chats', '/history'].some(p => location.pathname.startsWith(p))

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `p-2 rounded-full transition-colors ${isActive ? 'bg-blue-100 text-[#0079C8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#0079C8]'}`

  return (
    <header className="w-full fixed top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">

      {/* ── Top row ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex justify-between items-center">

        {/* Left: home or back + role badge */}
        <div className="flex items-center gap-2">
          {isRoot ? (
            <button
              onClick={() => navigate('/')}
              title="Início"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Home size={20} />
            </button>
          ) : (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0079C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {role && (() => {
            const { label, Icon, color, bg } = ROLE_MAP[role]
            return (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: bg, color }}
              >
                <Icon size={12} />
                {label}
              </div>
            )
          })()}
        </div>

        {/* Center: wordmark */}
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Care One</span>

        {/* Right: contextual nav + theme toggle */}
        <nav className="flex items-center gap-1">
          {isChatArea && (
            <>
              <NavLink to="/chat" end className={navLinkClass} title="Novo chat">
                <MessageSquare size={20} />
              </NavLink>
              <NavLink to="/chats" className={navLinkClass} title="Conversas">
                <MessagesSquare size={20} />
              </NavLink>
              <NavLink to="/history" className={navLinkClass} title="Histórico clínico">
                <ClipboardList size={20} />
              </NavLink>
            </>
          )}

          {role === 'paciente' && (
            <NavLink to="/paciente/conversa" className={navLinkClass} title="Conversa com o médico">
              <MessageCircle size={20} />
            </NavLink>
          )}

          {role && (
            <NotificationBell role={role} name={role === 'paciente' ? DEMO_PATIENT : null} />
          )}

          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>

      {/* ── Bottom row: page tabs (lifted from the active dashboard) ─────── */}
      {config && (
        <div className="px-6 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <div className="flex gap-1 max-w-3xl mx-auto">
            {config.tabs.map(t => {
              const active = t.id === config.active
              const accent = config.accent ?? '#0079C8'
              return (
                <button
                  key={t.id}
                  onClick={() => config.onSelect(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? ''
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  style={active ? { borderColor: accent, color: accent } : {}}
                >
                  {t.Icon && <t.Icon size={15} />}
                  {t.label}
                  {t.badge ? (
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
