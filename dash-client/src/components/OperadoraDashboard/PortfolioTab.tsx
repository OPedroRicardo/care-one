import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Patient, SortKey } from './types'
import { MONO, SANS, fmtBRL, useOperadoraColors } from './theme'
import RiskBadge from './RiskBadge'
import MarkerDots from './MarkerDots'
import ProgressBar from './ProgressBar'

interface PortfolioTabProps {
  patients: Patient[]
  onSelect: (p: Patient) => void
}

const PAGE_SIZE = 50

type CohortFilter = 'diabetic' | 'medicated' | 'trending'

function exportCSV(patients: Patient[]) {
  const header = 'Nome,Idade,Sexo,Risco,Score,Framingham,HOMA-IR,Marcadores,CustoProjetado,Glicemia,Colesterol,PAS'
  const rows = patients.map(p => {
    const lat = p.exams[p.exams.length - 1]
    return [
      `"${p.name}"`, p.age, p.sex, p.riskLevel,
      p.compositeScore.toFixed(1), p.framingham, p.homaIR.toFixed(2),
      p.alteredCount, p.projectedCost,
      lat.glucose, lat.totalChol, lat.sysBP,
    ].join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `careplus_carteira_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PortfolioTab({ patients, onSelect }: PortfolioTabProps) {
  const { C, riskColor, riskBg } = useOperadoraColors()
  const [search,      setSearch]      = useState('')
  const [riskFilter,  setRiskFilter]  = useState<'todos' | 'alto' | 'medio' | 'baixo'>('todos')
  const [cohorts,     setCohorts]     = useState<Set<CohortFilter>>(new Set())
  const [sortKey,     setSortKey]     = useState<SortKey>('compositeScore')
  const [sortDir,     setSortDir]     = useState<'desc' | 'asc'>('desc')
  const [page,        setPage]        = useState(1)

  const filtered = useMemo(() => {
    let r = [...patients]
    if (riskFilter !== 'todos') r = r.filter(p => p.riskLevel === riskFilter)
    if (search.trim()) r = r.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (cohorts.has('diabetic'))  r = r.filter(p => p.diabetic)
    if (cohorts.has('medicated')) r = r.filter(p => p.medicated)
    if (cohorts.has('trending'))  r = r.filter(p => p.trendGlucose > 1 || p.trendChol > 0.5)
    r.sort((a, b) => {
      const d = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'desc' ? -d : d
    })
    return r
  }, [patients, search, riskFilter, cohorts, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
    setPage(1)
  }

  function toggleCohort(c: CohortFilter) {
    setCohorts(prev => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      return next
    })
    setPage(1)
  }

  function SortTH({ label, k }: { label: string; k: SortKey }) {
    return (
      <th onClick={() => toggleSort(k)} style={{
        textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        color: sortKey === k ? C.blue : C.muted, fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 14px 14px 0',
      }}>
        {label}{' '}
        {sortKey === k
          ? (sortDir === 'desc'
            ? <ChevronDown size={11} style={{ display: 'inline' }} />
            : <ChevronUp size={11} style={{ display: 'inline' }} />)
          : null}
      </th>
    )
  }

  const COHORT_OPTIONS: { id: CohortFilter; label: string }[] = [
    { id: 'diabetic',  label: 'Diabéticos' },
    { id: 'medicated', label: 'Medicados'  },
    { id: 'trending',  label: 'Tendência ↑' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Filters bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div data-tour="carteira-filtros" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '7px 14px', flex: 1, maxWidth: 340,
            transition: 'border-color 0.18s ease',
          }}>
            <Search size={14} color={C.muted} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar beneficiário..."
              style={{ all: 'unset', color: C.text, fontSize: 13, ...SANS, width: '100%' } as React.CSSProperties}
            />
          </div>

          {/* Risk filter */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['todos','alto','medio','baixo'] as const).map(f => (
              <button key={f} onClick={() => { setRiskFilter(f); setPage(1) }} style={{
                background: riskFilter === f ? (f === 'todos' ? C.blueBg : riskBg(f)) : 'transparent',
                border: `1px solid ${riskFilter === f ? (f === 'todos' ? C.blue : riskColor(f)) : C.border}`,
                color: riskFilter === f ? (f === 'todos' ? C.blue : riskColor(f)) : C.muted,
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, ...SANS,
                transition: 'all 0.15s ease',
              }}>
                {f === 'todos' ? 'Todos' : f === 'alto' ? 'Alto' : f === 'medio' ? 'Médio' : 'Baixo'}
              </button>
            ))}
          </div>

          {/* Cohort filters */}
          <div style={{ display: 'flex', gap: 6 }}>
            {COHORT_OPTIONS.map(c => (
              <button key={c.id} onClick={() => toggleCohort(c.id)} style={{
                background: cohorts.has(c.id) ? C.blueBg : 'transparent',
                border: `1px solid ${cohorts.has(c.id) ? C.blue : C.border}`,
                color: cohorts.has(c.id) ? C.blue : C.muted,
                borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, ...SANS,
                transition: 'all 0.15s ease',
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats + export */}
        <div data-tour="carteira-exportar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ color: C.muted, fontSize: 12, ...MONO }}>{filtered.length} beneficiários</span>
          <button onClick={() => exportCSV(filtered)} title="Exportar CSV" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '5px 10px', cursor: 'pointer', color: C.muted, fontSize: 11, ...SANS,
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.low; (e.currentTarget as HTMLButtonElement).style.color = C.low }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div data-tour="carteira-completa" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 20px' }}>Beneficiário</th>
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 14px 14px 0' }}>Nível</th>
                <SortTH label="Score"      k="compositeScore" />
                <SortTH label="Framingham" k="framingham" />
                <SortTH label="HOMA-IR"    k="homaIR" />
                <SortTH label="Marcadores" k="alteredCount" />
                <SortTH label="Custo Proj."k="projectedCost" />
                <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '14px 20px 14px 0' }}>Prob. Sinistro</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map(p => (
                <tr key={p.id} onClick={() => onSelect(p)}
                  className="data-row"
                  style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <td style={{ padding: '11px 20px' }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {p.age}a · {p.sex}
                      {p.diabetic  && <span style={{ marginLeft: 6, color: C.med,  fontSize: 10 }}>DM</span>}
                      {p.medicated && <span style={{ marginLeft: 4, color: C.blue, fontSize: 10 }}>Med</span>}
                    </div>
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

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '5px 8px', cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              color: safePage === 1 ? C.border : C.muted, display: 'flex',
              transition: 'all 0.15s ease',
            }}>
            <ChevronLeft size={14} />
          </button>

          <span style={{ ...MONO, fontSize: 12, color: C.dim }}>
            {safePage} / {totalPages}
            <span style={{ color: C.muted, marginLeft: 10 }}>
              ({(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length})
            </span>
          </span>

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '5px 8px', cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              color: safePage === totalPages ? C.border : C.muted, display: 'flex',
              transition: 'all 0.15s ease',
            }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
