import { useState } from 'react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-mono/400.css'
import './scrollbar.css'
import type { Patient } from './OperadoraDashboard/types'
import { C, SANS } from './OperadoraDashboard/theme'
import { PATIENTS } from './OperadoraDashboard/data'
import OverviewTab from './OperadoraDashboard/OverviewTab'
import PortfolioTab from './OperadoraDashboard/PortfolioTab'
import ROITab from './OperadoraDashboard/ROITab'
import PatientModal from './OperadoraDashboard/PatientModal'

export default function OperadoraDashboard() {
  const [tab, setTab] = useState<'overview' | 'carteira' | 'roi'>('overview')
  const [selected, setSelected] = useState<Patient | null>(null)

  return (
    <div className="operadora-root" style={{ minHeight: '100vh', background: C.bg, color: C.text, ...SANS }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 32px', position: 'sticky', top: 0, background: C.bg, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 58 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: 15, color: C.low, letterSpacing: '0.04em' }}>CARE+</span>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginLeft: 6 }}>Operadora · Análise Preditiva</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['overview','Visão Geral'],['carteira','Carteira'],['roi','ROI']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  background: tab === id ? C.blueBg : 'transparent',
                  border: `1px solid ${tab === id ? C.blue : 'transparent'}`,
                  color: tab === id ? C.blue : C.muted,
                  borderRadius: 6, padding: '5px 16px', cursor: 'pointer', fontSize: 13, ...SANS,
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.low, boxShadow: `0 0 8px ${C.low}` }} />
            <span style={{ fontSize: 12, color: C.muted }}>80 beneficiários · 25 mai 2026</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 32px', maxWidth: 1380, margin: '0 auto' }}>
        {tab === 'overview' && <OverviewTab patients={PATIENTS} onSelect={setSelected} />}
        {tab === 'carteira' && <PortfolioTab patients={PATIENTS} onSelect={setSelected} />}
        {tab === 'roi' && <ROITab patients={PATIENTS} />}
      </div>

      {selected && <PatientModal patient={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
