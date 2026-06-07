import { ChevronDown, Search, X } from 'lucide-react'

// ── FilterChips ───────────────────────────────────────────────────────────────

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accent = '#0079C8',
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  accent?: string
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              active
                ? 'text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            style={active ? { background: accent } : {}}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={`text-[10px] font-bold min-w-[16px] text-center px-1 rounded-full ${
                active ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── SortSelect ────────────────────────────────────────────────────────────────

export function SortSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">Ordenar:</span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value as T)}
          className="appearance-none text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-6 py-1.5 outline-none focus:border-[#0079C8] transition-colors cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}

// ── SearchBar ─────────────────────────────────────────────────────────────────

export function SearchBar({
  value,
  onChange,
  placeholder = 'Pesquisar…',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative mb-3">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-8 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#0079C8] dark:focus:border-[#60A5FA] transition-colors placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ── ListControlsBar ───────────────────────────────────────────────────────────

export function ListControlsBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
      {children}
    </div>
  )
}
