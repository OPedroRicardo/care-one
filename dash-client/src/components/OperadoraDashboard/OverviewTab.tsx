import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts/umd/Recharts'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { Patient } from './types'
import { C, MONO, SANS, riskColor, fmtBRL } from './theme'
import KPICard from './KPICard'
import RiskBadge from './RiskBadge'
import ChartTip from './ChartTip'

interface OverviewTabProps {
  patients: Patient[]
  onSelect: (p: Patient) => void
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase',
      letterSpacing: '0.07em', paddingBottom: 10, paddingRight: 14, whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

export default function OverviewTab({ patients, onSelect }: OverviewTabProps) {
  const alto  = patients.filter(p => p.riskLevel === 'alto')
  const medio = patients.filter(p => p.riskLevel === 'medio')
  const baixo = patients.filter(p => p.riskLevel === 'baixo')

  const totalCost    = patients.reduce((s, p) => s + p.projectedCost, 0)
  const altoTotal    = alto.reduce((s, p) => s + p.projectedCost, 0)
  const intervCost   = alto.length * 2800
  const economia     = altoTotal * 0.72 - intervCost
  const roi          = Math.round((economia / intervCost) * 100)

  // Alert patients: alto risk + worsening trend
  const alertPatients = patients
    .filter(p => p.riskLevel === 'alto' && (p.trendGlucose > 1.5 || p.trendChol > 0.8))
    .slice(0, 5)

  const pieData = [
    { name: 'Alto Risco', value: alto.length,  color: C.high },
    { name: 'Médio Risco',value: medio.length, color: C.med  },
    { name: 'Baixo Risco',value: baixo.length, color: C.low  },
  ]

  const ageGroups = [['25','34'],['35','44'],['45','54'],['55','64'],['65','99']]
  const ageData = ageGroups.map(([lo, hi]) => {
    const label = hi === '99' ? '65+' : `${lo}–${hi}`
    const g = patients.filter(p => p.age >= +lo && p.age <= +hi)
    return {
      label,
      Alto:  g.filter(p => p.riskLevel === 'alto').length,
      Médio: g.filter(p => p.riskLevel === 'medio').length,
      Baixo: g.filter(p => p.riskLevel === 'baixo').length,
    }
  })

  const costSeg = [
    { name: 'Alto',  custo: Math.round(altoTotal / 1000), fill: C.high },
    { name: 'Médio', custo: Math.round(medio.reduce((s, p) => s + p.projectedCost, 0) / 1000), fill: C.med },
    { name: 'Baixo', custo: Math.round(baixo.reduce((s, p) => s + p.projectedCost, 0) / 1000), fill: C.low },
  ]

  const top10 = patients.slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Alert strip ───────────────────────────────────────────────── */}
      {alertPatients.length > 0 && (
        <div className="anim-fade-up" style={{
          background: 'rgba(248,113,113,0.06)', border: `1px solid rgba(248,113,113,0.22)`,
          borderRadius: 12, padding: '14px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          animationDelay: '0ms',
        }}>
          <AlertTriangle size={16} color={C.high} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.high, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Atenção — tendência de piora em pacientes de alto risco
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {alertPatients.map(p => (
                <button key={p.id} onClick={() => onSelect(p)} style={{
                  background: 'rgba(248,113,113,0.10)', border: `1px solid rgba(248,113,113,0.28)`,
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'background 0.15s ease',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.10)')}
                >
                  <TrendingUp size={11} color={C.high} />
                  <span style={{ fontSize: 12, color: C.text, ...SANS }}>{p.name}</span>
                  <span style={{ ...MONO, fontSize: 10, color: C.high }}>
                    {p.trendGlucose > 1.5 ? `Gli +${p.trendGlucose.toFixed(1)}` : `CT +${p.trendChol.toFixed(1)}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Alto Risco',       value: String(alto.length),          sub: `${((alto.length / Math.max(patients.length,1)) * 100).toFixed(0)}% da carteira`,    color: C.high, delay: 0   },
          { label: 'Médio Risco',      value: String(medio.length),         sub: `${((medio.length / Math.max(patients.length,1)) * 100).toFixed(0)}% da carteira`,   color: C.med,  delay: 60  },
          { label: 'Custo Projetado',  value: `R$ ${(totalCost / 1e6).toFixed(2)}M`, sub: 'próximos 12 meses',                                                        color: C.blue, delay: 120 },
          { label: 'ROI Intervenção',  value: `${roi}%`,                    sub: 'intervenção nos alto risco',                                                         color: C.low,  delay: 180 },
        ].map(k => (
          <KPICard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>

        {/* Pie */}
        <div className="anim-fade-up" style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px',
          animationDelay: '80ms',
        }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>
            Distribuição de Risco
          </div>
          <ResponsiveContainer width="100%" height={195}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value">
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 10, color: C.dim }}>{d.name.split(' ')[0]}</span>
                <span style={{ fontSize: 16, ...MONO, color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Age bars */}
        <div className="anim-fade-up" style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px',
          animationDelay: '120ms',
        }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>
            Risco por Faixa Etária
          </div>
          <ResponsiveContainer width="100%" height={225}>
            <BarChart data={ageData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="Alto"  stackId="a" fill={C.high} />
              <Bar dataKey="Médio" stackId="a" fill={C.med} />
              <Bar dataKey="Baixo" stackId="a" fill={C.low} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Cost + Top10 ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>

        {/* Cost bars */}
        <div className="anim-fade-up" style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px',
          animationDelay: '160ms',
        }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>
            Custo por Segmento (R$ mil)
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={costSeg} layout="vertical" margin={{ top: 0, right: 14, bottom: 0, left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={(v: number) => `${v}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.dim }} width={44} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="custo" radius={[0, 6, 6, 0]}>
                {costSeg.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 */}
        <div className="anim-fade-up" style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px',
          animationDelay: '200ms',
        }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>
            Top 10 — Maior Risco de Sinistro
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><TH>#</TH><TH>Beneficiário</TH><TH>Nível</TH><TH>Score</TH><TH>Framingham</TH><TH>HOMA-IR</TH><TH>Custo Proj.</TH></tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr key={p.id} onClick={() => onSelect(p)} className="data-row"
                  style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: C.muted }}>{i + 1}</td>
                  <td style={{ padding: '9px 14px 9px 0', fontSize: 13, color: C.text }}>{p.name}</td>
                  <td style={{ padding: '9px 14px 9px 0' }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: riskColor(p.riskLevel) }}>{p.compositeScore.toFixed(1)}%</td>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: C.blue }}>{p.framingham}%</td>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: p.homaIR > 2.5 ? C.med : C.dim }}>{p.homaIR.toFixed(2)}</td>
                  <td style={{ padding: '9px 0',           ...MONO, fontSize: 12, color: riskColor(p.riskLevel) }}>{fmtBRL(p.projectedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cohort summary strip ──────────────────────────────────────── */}
      <div className="anim-fade-up" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, animationDelay: '240ms',
      }}>
        {[
          { label: 'Diabéticos',     val: patients.filter(p => p.diabetic).length,    sub: 'com CID E10/E11 ou Gli>126',  color: C.med  },
          { label: 'Medicados',      val: patients.filter(p => p.medicated).length,   sub: 'DM ou HAS controlada',         color: C.blue },
          { label: 'Tendência piora',val: patients.filter(p => p.trendGlucose > 1 || p.trendChol > 0.5).length, sub: 'glicemia ou colesterol subindo', color: C.high },
          { label: 'Baixo risco',    val: baixo.length,                               sub: `${((baixo.length/Math.max(patients.length,1))*100).toFixed(0)}% carteira saudável`, color: C.low },
        ].map(s => (
          <div key={s.label} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '16px 20px',
          }}>
            <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ ...MONO, fontSize: 26, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
