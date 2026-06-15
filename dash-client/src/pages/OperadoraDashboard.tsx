import { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, Sun, Moon, Home } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-mono/400.css'
import '../components/OperadoraDashboard/scrollbar.css'
import '../components/OperadoraDashboard/animations.css'
import '../components/OperadoraDashboard/responsive.css'
import type { Patient } from '../components/OperadoraDashboard/types'
import { SANS, useOperadoraColors } from '../components/OperadoraDashboard/theme'
import { usePatients } from '../hooks/usePatients'
import OverviewTab from '../components/OperadoraDashboard/OverviewTab'
import PortfolioTab from '../components/OperadoraDashboard/PortfolioTab'
import ROITab from '../components/OperadoraDashboard/ROITab'
import PatientModal from '../components/OperadoraDashboard/PatientModal'
import DashSkeleton from '../components/OperadoraDashboard/DashSkeleton'
import { useNavigate } from 'react-router-dom'

type Tab = 'overview' | 'carteira' | 'roi'

const TABS: [Tab, string][] = [
  ['overview', 'Visão Geral'],
  ['carteira', 'Carteira'],
  ['roi', 'ROI'],
]

function fmtTime(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function OperadoraDashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [spinning, setSpinning] = useState(false)
  const { patients, loading, error, refresh, lastUpdated } = usePatients()
  const { theme, toggle } = useTheme()
  const { C } = useOperadoraColors()
  const navigate = useNavigate()

  // Lets the platform tour switch tabs while walking through this dashboard.
  useEffect(() => {
    const handler = (e: Event) => setTab((e as CustomEvent).detail as Tab)
    window.addEventListener('operadora-tab', handler)
    return () => window.removeEventListener('operadora-tab', handler)
  }, [])

  // Lets the platform tour open/close the beneficiary detail modal.
  useEffect(() => {
    const open = () => {
      const demo = patients.find(p => p.riskLevel === 'alto') ?? patients[0]
      if (demo) setSelected(demo)
    }
    const close = () => setSelected(null)
    window.addEventListener('operadora-open-modal', open)
    window.addEventListener('tour-close-modals', close)
    return () => {
      window.removeEventListener('operadora-open-modal', open)
      window.removeEventListener('tour-close-modals', close)
    }
  }, [patients])

  function handleRefresh() {
    setSpinning(true)
    refresh()
    setTimeout(() => setSpinning(false), 700)
  }

  const alerts = patients.filter(
    p => p.riskLevel === 'alto' && (p.trendGlucose > 1.5 || p.trendChol > 0.8)
  ).length

  return (
    <div className="operadora-root px-4 pb-4"
      style={{ minHeight: '100vh', background: C.bg, color: C.text, ...SANS }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="op-header" style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '0px 20px',
        position: 'sticky', top: 0, background: C.bg, zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 58 }}>

          {/* Logo + tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <button
              onClick={() => navigate('/')}
              title="Início"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Home size={20} />
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  background: tab === id ? C.blueBg : 'transparent',
                  border: `1px solid ${tab === id ? C.blue : 'transparent'}`,
                  color: tab === id ? C.blue : C.muted,
                  borderRadius: 6, padding: '5px 16px', cursor: 'pointer', fontSize: 13, ...SANS,
                  transition: 'all 0.18s ease',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {alerts > 0 && (
              <div className="op-alerts" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(248,113,113,0.10)', border: `1px solid rgba(248,113,113,0.25)`,
                borderRadius: 8, padding: '4px 10px',
              }}>
                <div className="alert-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: C.high }} />
                <span style={{ fontSize: 11, color: C.high }}>{alerts} alerta{alerts > 1 ? 's' : ''}</span>
              </div>
            )}

            <button onClick={handleRefresh} title="Atualizar dados" style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '5px 8px', cursor: 'pointer', color: C.muted, display: 'flex',
              transition: 'border-color 0.18s ease, color 0.18s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.blue; (e.currentTarget as HTMLButtonElement).style.color = C.blue }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
            >
              <RefreshCw size={14} className={spinning ? 'spin' : ''} />
            </button>

            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '5px 8px', cursor: 'pointer', color: C.muted, display: 'flex',
                transition: 'border-color 0.18s ease, color 0.18s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.blue; (e.currentTarget as HTMLButtonElement).style.color = C.blue }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div className="op-status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: error ? C.high : loading ? C.muted : C.low,
                boxShadow: error ? `0 0 8px ${C.high}` : loading ? 'none' : `0 0 8px ${C.low}`,
                transition: 'all 0.3s ease',
              }} />
              <span style={{ fontSize: 12, color: C.muted }}>
                {loading ? 'Carregando…' : error ? 'Erro' : `${patients.length} beneficiários`}
                {lastUpdated && !loading && !error && (
                  <span style={{ marginLeft: 6, color: C.dim }}>· {fmtTime(lastUpdated)}</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="op-content pt-4" style={{ maxWidth: 1380, margin: '0 auto' }}>

        {/* Error state */}
        {error && !loading && (
          <div className="anim-fade-up" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 0', gap: 16,
          }}>
            <AlertTriangle size={36} color={C.high} />
            <div style={{ color: C.high, fontSize: 15 }}>Falha ao carregar dados de análise</div>
            <div style={{ color: C.muted, fontSize: 12, fontFamily: 'monospace' }}>{error}</div>
            <button onClick={handleRefresh} style={{
              background: C.blueBg, border: `1px solid ${C.blue}`, borderRadius: 8,
              padding: '8px 20px', color: C.blue, cursor: 'pointer', fontSize: 13, ...SANS, marginTop: 8,
            }}>
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && <DashSkeleton />}

        {/* Dashboard content */}
        {!loading && !error && (
          <div key={tab} className="tab-content">
            {tab === 'overview' && <OverviewTab patients={patients} onSelect={setSelected} />}
            {tab === 'carteira' && <PortfolioTab patients={patients} onSelect={setSelected} />}
            {tab === 'roi'      && <ROITab patients={patients} />}
          </div>
        )}
      </div>

      {selected && (
        <PatientModal patient={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
