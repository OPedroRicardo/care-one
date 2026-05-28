import { MessageSquare, ClipboardList, MessagesSquare } from "lucide-react"
import { useLocation, useNavigate, NavLink } from "react-router-dom"

// Top-level pages: no back button shown
const TOP_LEVEL = ['/chat', '/chats', '/history']

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname === '/') return null

  const showBackBtn = !TOP_LEVEL.includes(location.pathname)

  return (
    <header className="w-full px-6 py-4 flex justify-between items-center fixed top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      {showBackBtn ? (
        <button
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          onClick={() => navigate(-1)}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0079C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <div />
      )}

      <div>Care One</div>

      <nav className="flex items-center gap-2">
        <NavLink
          to="/chat"
          end
          className={({ isActive }) =>
            `p-2 rounded-full transition-colors ${isActive ? 'bg-blue-100 text-[#0079C8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#0079C8]'}`
          }
          title="Novo chat"
        >
          <MessageSquare size={24} />
        </NavLink>
        <NavLink
          to="/chats"
          className={({ isActive }) =>
            `p-2 rounded-full transition-colors ${isActive ? 'bg-blue-100 text-[#0079C8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#0079C8]'}`
          }
          title="Conversas"
        >
          <MessagesSquare size={24} />
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `p-2 rounded-full transition-colors ${isActive ? 'bg-blue-100 text-[#0079C8]' : 'text-slate-400 hover:bg-slate-100 hover:text-[#0079C8]'}`
          }
          title="Histórico clínico"
        >
          <ClipboardList size={24} />
        </NavLink>
      </nav>
    </header>
  )
}
