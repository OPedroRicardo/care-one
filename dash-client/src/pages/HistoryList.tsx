import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2, Activity, FlaskConical } from 'lucide-react'
import { apiFetch } from '../lib/api'

interface HistoryRecord {
  id: string
  type: 'triagem' | 'exame'
  patientName: string
  date: number
  summary: string
  createdAt: number
}

interface ListResponse {
  records: HistoryRecord[]
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function HistoryList() {
  const navigate                  = useNavigate()
  const [records, setRecords]     = useState<HistoryRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'triagem' | 'exame'>('all')

  useEffect(() => {
    const query = filter !== 'all' ? `?type=${filter}` : ''
    setLoading(true)
    apiFetch<ListResponse>(`/app/history${query}`)
      .then(r => { setRecords(r.records); setError(null) })
      .catch(() => setError('Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Histórico</h1>
      <p className="text-sm text-slate-400 mb-5">Suas triagens e exames registrados</p>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['all', 'triagem', 'exame'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#0079C8] text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {{ all: 'Todos', triagem: 'Triagens', exame: 'Exames' }[f]}
          </button>
        ))}
      </div>

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

      {!loading && !error && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <FlaskConical size={40} className="opacity-40" />
          <p className="text-sm">Nenhum registro encontrado.</p>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <ul className="space-y-3">
          {records.map(record => (
            <li key={record.id}>
              <button
                onClick={() => navigate(`/history/${record.id}`)}
                className="w-full flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-4 py-4 shadow-sm hover:shadow-md hover:border-[#0079C8]/30 transition-all text-left group"
              >
                {/* Ícone do tipo */}
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    record.type === 'triagem' ? 'bg-blue-50 text-[#0079C8]' : 'bg-purple-50 text-purple-600'
                  }`}
                >
                  {record.type === 'triagem' ? <Activity size={20} /> : <FlaskConical size={20} />}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        record.type === 'triagem'
                          ? 'bg-blue-100 text-[#0079C8]'
                          : 'bg-purple-100 text-purple-600'
                      }`}
                    >
                      {record.type}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(record.date)}</span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{record.summary}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{record.patientName}</p>
                </div>

                <ChevronRight
                  size={18}
                  className="shrink-0 text-slate-300 group-hover:text-[#0079C8] transition-colors"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
