import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import type { Patient, SortKey } from './types'
import { C, MONO, SANS, riskColor, riskBg, fmtBRL } from './theme'
import RiskBadge from './RiskBadge'
import MarkerDots from './MarkerDots'
import ProgressBar from './ProgressBar'

interface PortfolioTabProps {
  patients: Patient[]
  onSelect: (p: Patient) => void
}

export default function PortfolioTab({ patients, onSelect }: PortfolioTabProps) {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<'todos' | 'alto' | 'medio' | 'baixo'>('todos')
  const [sortKey, setSortKey] = useState<SortKey>('compositeScore')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const filtered = useMemo(() => {
    let r = [...patients]
    if (riskFilter !== 'todos') r = r.filter(p => p.riskLevel === riskFilter)
    if (search.trim()) r = r.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    r.sort((a, b) => {
      const d = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'desc' ? -d : d
    })
    return r
  }, [patients, search, riskFilter, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function SortTH({ label, k }: { label: string; k: SortKey }) {
    return (
      <th onClick={() => toggleSort(k)} style={{
        textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        color: sortKey === k ? C.blue : C.muted, fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        padding: '14px 14px 14px 0',
      }}>
        {label} {sortKey === k ? (sortDir === 'desc' ? <ChevronDown size={11} style={{ display: 'inline' }} /> : <ChevronUp size={11} style={{ display: 'inline' }} />) : null}
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', flex: 1, maxWidth: 340 }}>
          <Search size={14} color={C.muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar beneficiário..."
            style={{ all: 'unset', color: C.text, fontSize: 13, ...SANS, width: '100%' } as React.CSSProperties}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['todos','alto','medio','baixo'] as const).map(f => (
            <button key={f} onClick={() => setRiskFilter(f)} style={{
              background: riskFilter === f ? (f === 'todos' ? C.blueBg : riskBg(f)) : 'transparent',
              border: `1px solid ${riskFilter === f ? (f === 'todos' ? C.blue : riskColor(f)) : C.border}`,
              color: riskFilter === f ? (f === 'todos' ? C.blue : riskColor(f)) : C.muted,
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, ...SANS,
            }}>
              {f === 'todos' ? 'Todos' : f === 'alto' ? 'Alto' : f === 'medio' ? 'Médio' : 'Baixo'}
            </button>
          ))}
        </div>
        <span style={{ color: C.muted, fontSize: 12, ...MONO, marginLeft: 'auto' }}>{filtered.length} beneficiários</span>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 20px' }}>Beneficiário</th>
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 14px 14px 0' }}>Nível</th>
                <SortTH label="Score" k="compositeScore" />
                <SortTH label="Framingham" k="framingham" />
                <SortTH label="HOMA-IR" k="homaIR" />
                <SortTH label="Marcadores" k="alteredCount" />
                <SortTH label="Custo Proj." k="projectedCost" />
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 20px 14px 0' }}>Prob. Sinistro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => onSelect(p)} style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.raised)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 20px' }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.age}a · {p.sex}</div>
                  </td>
                  <td style={{ padding: '11px 14px 11px 0' }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: '11px 14px 11px 0', ...MONO, fontSize: 13, color: riskColor(p.riskLevel) }}>{p.compositeScore.toFixed(1)}%</td>
                  <td style={{ padding: '11px 14px 11px 0', ...MONO, fontSize: 13, color: C.blue }}>{p.framingham}%</td>
                  <td style={{ padding: '11px 14px 11px 0', ...MONO, fontSize: 13, color: p.homaIR > 2.5 ? C.med : C.dim }}>{p.homaIR.toFixed(2)}</td>
                  <td style={{ padding: '11px 14px 11px 0' }}><MarkerDots altered={p.alteredMarkers} /></td>
                  <td style={{ padding: '11px 14px 11px 0', ...MONO, fontSize: 13, color: riskColor(p.riskLevel) }}>{fmtBRL(p.projectedCost)}</td>
                  <td style={{ padding: '11px 20px 11px 0', width: 130 }}>
                    <ProgressBar value={p.compositeScore} color={riskColor(p.riskLevel)} />
                    <span style={{ ...MONO, fontSize: 10, color: C.muted }}>{p.compositeScore.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
