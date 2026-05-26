import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart, Area, CartesianGrid } from 'recharts/umd/Recharts'
import type { Patient } from './types'
import { C, MONO, SANS, fmtBRL } from './theme'
import ChartTip from './ChartTip'

interface ROITabProps {
  patients: Patient[]
}

export default function ROITab({ patients }: ROITabProps) {
  const alto = patients.filter(p => p.riskLevel === 'alto')
  const N = alto.length
  const recall = 0.78
  const tp = Math.round(N * recall)
  const costSinistro = 52000
  const costIntervencao = 2800
  const reducao = 0.72

  const semInterv = tp * costSinistro
  const custoInterv = N * costIntervencao
  const comInterv = Math.round(tp * (1 - reducao) * costSinistro) + custoInterv
  const economia = semInterv - comInterv
  const roiPct = Math.round((economia - custoInterv) / custoInterv * 100)

  const compData = [
    { label: 'Sem Intervenção', value: semInterv },
    { label: 'Custo Intervenção', value: custoInterv },
    { label: 'Com Intervenção', value: comInterv },
  ]
  const compColors = [C.high, C.med, C.low]

  const sorted = [...patients].sort((a, b) => b.projectedCost - a.projectedCost)
  const totalC = sorted.reduce((s, p) => s + p.projectedCost, 0)
  let cum = 0
  const paretoFull = sorted.map((p, i) => {
    cum += p.projectedCost
    return { pb: parseFloat(((i + 1) / sorted.length * 100).toFixed(1)), pc: parseFloat((cum / totalC * 100).toFixed(1)) }
  })
  const pareto = paretoFull.filter((_, i) => i % 4 === 0 || i === paretoFull.length - 1)
  const at20 = paretoFull.find(d => d.pb >= 20)?.pc ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 20 }}>Modelo de ROI — Passo a Passo</div>
          {[
            { label: 'Beneficiários alto risco identificados', val: String(N), color: C.high },
            { label: `True positives (recall ${(recall*100).toFixed(0)}%)`, val: String(tp), color: C.med },
            { label: 'Custo médio internação cardiológica', val: fmtBRL(costSinistro), color: C.dim },
            { label: 'Custo intervenção preventiva/paciente', val: fmtBRL(costIntervencao), color: C.dim },
            { label: 'Redução de risco com intervenção', val: `${(reducao*100).toFixed(0)}%`, color: C.blue },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.dim }}>{r.label}</span>
              <span style={{ ...MONO, fontSize: 14, color: r.color }}>{r.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>ROI Estimado</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Economia líquida: {fmtBRL(economia)}</div>
            </div>
            <span style={{ ...MONO, fontSize: 32, color: C.low }}>{roiPct}%</span>
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px' }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 20 }}>Comparativo de Custo</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={compData} margin={{ top: 4, right: 4, bottom: 4, left: 16 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" name="Custo (R$)" radius={[6, 6, 0, 0]}>
                {compData.map((_, i) => <Cell key={i} fill={compColors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Curva de Pareto — Concentração de Custo</div>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 5 }}>
            ~20% dos beneficiários concentram <span style={{ ...MONO, color: C.blue }}>{at20.toFixed(0)}%</span> do custo projetado — argumento direto para priorização de intervenção
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={pareto} margin={{ top: 4, right: 20, bottom: 24, left: -10 }}>
            <defs>
              <linearGradient id="gPareto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.22} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="pb" tick={{ fontSize: 10, fill: C.muted }} label={{ value: '% Beneficiários', position: 'insideBottom', offset: -14, fill: C.muted, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} label={{ value: '% Custo Acumulado', angle: -90, position: 'insideLeft', fill: C.muted, fontSize: 11 }} />
            <Tooltip content={<ChartTip />} />
            <Area type="monotone" dataKey="pc" name="% Custo Acum." stroke={C.blue} fill="url(#gPareto)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
