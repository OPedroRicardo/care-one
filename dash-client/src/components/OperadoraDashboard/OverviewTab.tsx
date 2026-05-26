import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts/umd/Recharts'
import type { Patient } from './types'
import { C, MONO, SANS, riskColor, riskBg, fmtBRL } from './theme'
import KPICard from './KPICard'
import RiskBadge from './RiskBadge'
import ChartTip from './ChartTip'

interface OverviewTabProps {
  patients: Patient[]
  onSelect: (p: Patient) => void
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', paddingBottom: 10, paddingRight: 14, whiteSpace: 'nowrap' }}>{children}</th>
  )
}

export default function OverviewTab({ patients, onSelect }: OverviewTabProps) {
  const alto = patients.filter(p => p.riskLevel === 'alto')
  const medio = patients.filter(p => p.riskLevel === 'medio')
  const baixo = patients.filter(p => p.riskLevel === 'baixo')
  const totalCost = patients.reduce((s, p) => s + p.projectedCost, 0)
  const altoTotalCost = alto.reduce((s, p) => s + p.projectedCost, 0)
  const intervCost = alto.length * 2800
  const economia = altoTotalCost * 0.72 - intervCost
  const roi = Math.round((economia / intervCost) * 100)

  const pieData = [
    { name: 'Alto Risco', value: alto.length, color: C.high },
    { name: 'Médio Risco', value: medio.length, color: C.med },
    { name: 'Baixo Risco', value: baixo.length, color: C.low },
  ]

  const ageGroups = [['25','34'],['35','44'],['45','54'],['55','64'],['65','99']]
  const ageData = ageGroups.map(([lo, hi]) => {
    const label = hi === '99' ? '65+' : `${lo}–${hi}`
    const g = patients.filter(p => p.age >= +lo && p.age <= +hi)
    return { label, Alto: g.filter(p => p.riskLevel === 'alto').length, Médio: g.filter(p => p.riskLevel === 'medio').length, Baixo: g.filter(p => p.riskLevel === 'baixo').length }
  })

  const costSeg = [
    { name: 'Alto', custo: Math.round(altoTotalCost / 1000), fill: C.high },
    { name: 'Médio', custo: Math.round(medio.reduce((s, p) => s + p.projectedCost, 0) / 1000), fill: C.med },
    { name: 'Baixo', custo: Math.round(baixo.reduce((s, p) => s + p.projectedCost, 0) / 1000), fill: C.low },
  ]

  const top10 = patients.slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <KPICard label="Alto Risco" value={String(alto.length)} sub={`${((alto.length / patients.length) * 100).toFixed(0)}% da carteira`} color={C.high} />
        <KPICard label="Médio Risco" value={String(medio.length)} sub={`${((medio.length / patients.length) * 100).toFixed(0)}% da carteira`} color={C.med} />
        <KPICard label="Custo Projetado" value={`R$ ${(totalCost / 1e6).toFixed(2)}M`} sub="próximos 12 meses" color={C.blue} />
        <KPICard label="ROI Intervenção" value={`${roi}%`} sub="intervenção nos alto risco" color={C.low} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Distribuição de Risco</div>
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

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Risco por Faixa Etária</div>
          <ResponsiveContainer width="100%" height={225}>
            <BarChart data={ageData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="Alto" stackId="a" fill={C.high} />
              <Bar dataKey="Médio" stackId="a" fill={C.med} />
              <Bar dataKey="Baixo" stackId="a" fill={C.low} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Custo por Segmento (R$ mil)</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={costSeg} layout="vertical" margin={{ top: 0, right: 14, bottom: 0, left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => `${v}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.dim }} width={44} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="custo" radius={[0, 6, 6, 0]}>
                {costSeg.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Top 10 — Maior Risco de Sinistro</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>#</TH><TH>Beneficiário</TH><TH>Nível</TH><TH>Framingham</TH><TH>HOMA-IR</TH><TH>Custo Proj.</TH>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr key={p.id} onClick={() => onSelect(p)}
                  style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.raised)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: C.muted }}>{i + 1}</td>
                  <td style={{ padding: '9px 14px 9px 0', fontSize: 13, color: C.text }}>{p.name}</td>
                  <td style={{ padding: '9px 14px 9px 0' }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: C.blue }}>{p.framingham}%</td>
                  <td style={{ padding: '9px 14px 9px 0', ...MONO, fontSize: 12, color: p.homaIR > 2.5 ? C.med : C.dim }}>{p.homaIR.toFixed(2)}</td>
                  <td style={{ padding: '9px 0', ...MONO, fontSize: 12, color: riskColor(p.riskLevel) }}>{fmtBRL(p.projectedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
