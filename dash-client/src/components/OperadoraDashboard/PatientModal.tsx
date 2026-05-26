import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts/umd/Recharts'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Patient } from './types'
import { C, MONO, SANS, riskColor, riskBg, fmtBRL } from './theme'
import RiskBadge from './RiskBadge'
import ChartTip from './ChartTip'

interface PatientModalProps {
  patient: Patient
  onClose: () => void
}

export default function PatientModal({ patient, onClose }: PatientModalProps) {
  const lat = patient.exams[5]
  const markerLabels = ['Glicemia','Insulina','Col. Total','LDL','HDL','Triglicerídeos','PAS']
  const markerVals: number[] = [lat.glucose, lat.insulin, lat.totalChol, lat.ldl, lat.hdl, lat.triglycerides, lat.sysBP]
  const markerUnits = ['mg/dL','μU/mL','mg/dL','mg/dL','mg/dL','mg/dL','mmHg']
  const markerRef = ['70–99','2–25','<200','<130', patient.sex === 'F' ? '>50' : '>40','<150','<130']
  const trendData = patient.exams.map(e => ({ m: e.date, Gli: e.glucose, CT: e.totalChol, PAS: e.sysBP }))

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16,
        width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', padding: 32, ...SANS,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: riskBg(patient.riskLevel), border: `2px solid ${riskColor(patient.riskLevel)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: riskColor(patient.riskLevel), fontSize: 16, fontWeight: 600, ...SANS,
            }}>
              {patient.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ fontSize: 19, color: C.text, fontWeight: 600 }}>{patient.name}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                {patient.age} anos · {patient.sex === 'M' ? 'Masculino' : 'Feminino'} · ID #{String(patient.id).padStart(4, '0')}
              </div>
            </div>
            <RiskBadge level={patient.riskLevel} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}>
            <X size={20} />
          </button>
        </div>

        {/* 3 scores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Prob. Sinistro', val: `${patient.compositeScore.toFixed(1)}%`, sub: `Confiança ${(patient.confidence * 100).toFixed(0)}%`, color: riskColor(patient.riskLevel) },
            { label: 'Framingham', val: `${patient.framingham}%`, sub: 'Risco CV 10 anos', color: C.blue },
            { label: 'HOMA-IR', val: patient.homaIR.toFixed(2), sub: patient.homaIR > 2.5 ? 'Resistência insulínica' : 'Normal', color: patient.homaIR > 2.5 ? C.med : C.low },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 26, ...MONO }}>{s.val}</div>
              <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Markers */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Marcadores Laboratoriais</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 8 }}>
            {markerLabels.map((label, i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 6,
                background: patient.alteredMarkers[i] ? 'rgba(248,113,113,0.08)' : C.raised,
                border: `1px solid ${patient.alteredMarkers[i] ? 'rgba(248,113,113,0.30)' : C.border}`,
              }}>
                <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ ...MONO, fontSize: 13, color: patient.alteredMarkers[i] ? C.high : C.low }}>
                    {Number.isInteger(markerVals[i]) ? markerVals[i] : markerVals[i].toFixed(1)}
                    <span style={{ fontSize: 9, marginLeft: 3, color: C.muted }}>{markerUnits[i]}</span>
                  </span>
                  <div style={{ fontSize: 10, color: C.muted }}>ref {markerRef[i]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Evolução Temporal — 6 exames</div>
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.med} stopOpacity={0.28}/>
                  <stop offset="95%" stopColor={C.med} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.28}/>
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="Gli" name="Glicemia" stroke={C.med} fill="url(#gG)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="CT" name="Col. Total" stroke={C.blue} fill="url(#gC)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {[{ label: 'Glicemia', slope: patient.trendGlucose, color: C.med }, { label: 'Col. Total', slope: patient.trendChol, color: C.blue }].map(t => (
              <div key={t.label} style={{ display: 'flex', gap: 7, alignItems: 'center', background: `${t.color}10`, border: `1px solid ${t.color}28`, borderRadius: 6, padding: '6px 12px' }}>
                {t.slope > 0.5 ? <TrendingUp size={13} color={C.high} /> : t.slope < -0.5 ? <TrendingDown size={13} color={C.low} /> : <Minus size={13} color={C.muted} />}
                <span style={{ fontSize: 11, color: C.dim }}>{t.label}</span>
                <span style={{ ...MONO, fontSize: 12, color: t.slope > 0.5 ? C.high : t.slope < -0.5 ? C.low : C.dim }}>
                  {t.slope > 0 ? '+' : ''}{t.slope.toFixed(2)} mg/dL/mês
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Custo Projetado', val: fmtBRL(patient.projectedCost), color: riskColor(patient.riskLevel) },
            { label: 'Marcadores Alt.', val: `${patient.alteredCount}/7`, color: patient.alteredCount >= 4 ? C.high : patient.alteredCount >= 2 ? C.med : C.low },
            { label: 'Consultas (12m)', val: String(patient.consultas12m), color: C.blue },
            { label: 'Últ. Exame', val: `${patient.diasUltimoExame}d`, color: patient.diasUltimoExame > 120 ? C.high : C.dim },
          ].map(s => (
            <div key={s.label} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 19, ...MONO }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
