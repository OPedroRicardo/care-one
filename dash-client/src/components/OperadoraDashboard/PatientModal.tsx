import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts/umd/Recharts'
import { X, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import type { Patient } from './types'
import { MONO, SANS, fmtBRL, useOperadoraColors } from './theme'
import RiskBadge from './RiskBadge'
import ChartTip from './ChartTip'

interface PatientModalProps {
  patient: Patient
  onClose: () => void
}

function TrendPill({ label, slope, color }: { label: string; slope: number; color: string }) {
  const { C } = useOperadoraColors()
  const up   = slope > 0.5
  const down = slope < -0.5
  return (
    <div style={{
      display: 'flex', gap: 7, alignItems: 'center',
      background: `${color}10`, border: `1px solid ${color}28`, borderRadius: 6, padding: '6px 12px',
    }}>
      {up   ? <TrendingUp   size={13} color={C.high} /> :
       down ? <TrendingDown size={13} color={C.low}  /> :
              <Minus        size={13} color={C.muted} />}
      <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
      <span style={{ ...MONO, fontSize: 12, color: up ? C.high : down ? C.low : C.dim }}>
        {slope > 0 ? '+' : ''}{slope.toFixed(2)} /mês
      </span>
    </div>
  )
}

export default function PatientModal({ patient, onClose }: PatientModalProps) {
  const { C, riskColor, riskBg } = useOperadoraColors()
  const lat = patient.exams[patient.exams.length - 1]

  const markerLabels = ['Glicemia','Insulina','Col. Total','LDL','HDL','Triglicerídeos','PAS']
  const markerVals   = [lat.glucose, lat.insulin, lat.totalChol, lat.ldl, lat.hdl, lat.triglycerides, lat.sysBP]
  const markerUnits  = ['mg/dL','μU/mL','mg/dL','mg/dL','mg/dL','mg/dL','mmHg']
  const markerRef    = ['70–99','2–25','<200','<130', patient.sex === 'F' ? '>50' : '>40','<150','<130']

  const trendData = patient.exams.map(e => ({
    m: e.date, Gli: e.glucose, CT: e.totalChol, PAS: e.sysBP,
  }))

  const bpSlope = patient.exams.length >= 2
    ? ((patient.exams[patient.exams.length - 1].sysBP - patient.exams[0].sysBP) /
       Math.max(patient.exams.length - 1, 1))
    : 0

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16,
        width: '100%', maxWidth: 960, maxHeight: '92vh', overflowY: 'auto', padding: 32, ...SANS,
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: riskBg(patient.riskLevel), border: `2px solid ${riskColor(patient.riskLevel)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: riskColor(patient.riskLevel), fontSize: 16, fontWeight: 600, ...SANS,
              flexShrink: 0,
            }}>
              {patient.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ fontSize: 19, color: C.text, fontWeight: 600 }}>{patient.name}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
                {patient.age} anos · {patient.sex === 'M' ? 'Masculino' : 'Feminino'} · ID #{String(patient.id).padStart(5, '0')}
                {patient.diabetic  && <span style={{ marginLeft: 8, color: C.med,  fontSize: 10, background: C.medBg,  padding: '2px 6px', borderRadius: 4 }}>DM</span>}
                {patient.medicated && <span style={{ marginLeft: 4, color: C.blue, fontSize: 10, background: C.blueBg, padding: '2px 6px', borderRadius: 4 }}>Medicado</span>}
              </div>
            </div>
            <RiskBadge level={patient.riskLevel} />
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid transparent`, borderRadius: 6, cursor: 'pointer', color: C.muted,
            padding: 6, transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── 3 scores ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Prob. Sinistro', val: `${patient.compositeScore.toFixed(1)}%`, sub: `Confiança ${(patient.confidence * 100).toFixed(0)}%`, color: riskColor(patient.riskLevel) },
            { label: 'Framingham',     val: `${patient.framingham}%`,                sub: 'Risco CV 10 anos',                                      color: C.blue },
            { label: 'HOMA-IR',        val: patient.homaIR.toFixed(2),              sub: patient.homaIR > 2.5 ? 'Resistência insulínica' : 'Normal', color: patient.homaIR > 2.5 ? C.med : C.low },
          ].map(s => (
            <div key={s.label} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 26, ...MONO }}>{s.val}</div>
              <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Lab markers ────────────────────────────────────────────── */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '18px 20px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Marcadores Laboratoriais
            </div>
            <div style={{ ...MONO, fontSize: 11, color: patient.alteredCount >= 4 ? C.high : patient.alteredCount >= 2 ? C.med : C.low }}>
              {patient.alteredCount}/7 alterados
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 8 }}>
            {markerLabels.map((label, i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 6,
                background: patient.alteredMarkers[i] ? 'rgba(248,113,113,0.08)' : C.raised,
                border: `1px solid ${patient.alteredMarkers[i] ? 'rgba(248,113,113,0.28)' : C.border}`,
                transition: 'background 0.15s ease',
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

        {/* ── Trend chart ────────────────────────────────────────────── */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '18px 20px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Evolução Temporal — {patient.exams.length} exames
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.dim, fontSize: 10 }}>
              <Activity size={11} />
              <span>Glicemia · Col. Total · PAS</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.med}  stopOpacity={0.28} />
                  <stop offset="95%" stopColor={C.med}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.high} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={C.high} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="Gli" name="Glicemia"   stroke={C.med}  fill="url(#gG)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="CT"  name="Col. Total" stroke={C.blue} fill="url(#gC)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="PAS" name="PAS"        stroke={C.high} fill="url(#gP)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <TrendPill label="Glicemia"   slope={patient.trendGlucose} color={C.med}  />
            <TrendPill label="Col. Total" slope={patient.trendChol}    color={C.blue} />
            <TrendPill label="PAS"        slope={parseFloat(bpSlope.toFixed(2))} color={C.high} />
          </div>
        </div>

        {/* ── Atividade recente na plataforma (pacientes "live") ──────── */}
        {patient.live && patient.recentActivity && (() => {
          const ra = patient.recentActivity!
          const fmtTs = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
          return (
            <div style={{
              background: C.surface, border: `1px solid ${C.blue}55`, borderRadius: 10,
              padding: '18px 20px', marginBottom: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Activity size={13} color={C.blue} />
                <span style={{ color: C.blue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                  Atividade recente na plataforma · dados reais
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ra.latestTriagem && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: C.dim }}>
                      Última triagem
                      {ra.latestTriagem.riskLevel && (
                        <span style={{ marginLeft: 8, ...MONO, fontSize: 11, color: riskColor(ra.latestTriagem.riskLevel === 'médio' ? 'medio' : ra.latestTriagem.riskLevel) }}>
                          {ra.latestTriagem.riskLevel}
                        </span>
                      )}
                    </span>
                    <span style={{ ...MONO, fontSize: 11, color: C.muted }}>{fmtTs(ra.latestTriagem.date)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: C.dim }}>Exames compartilhados</span>
                  <span style={{ ...MONO, fontSize: 12, color: ra.sharedExams.length ? C.low : C.muted }}>
                    {ra.sharedExams.length > 0 ? ra.sharedExams.map(e => e.examType).join(', ') : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: C.dim }}>Próxima consulta</span>
                  <span style={{ ...MONO, fontSize: 11, color: ra.nextAppointment ? C.blue : C.muted }}>
                    {ra.nextAppointment
                      ? `${ra.nextAppointment.type} · ${fmtTs(ra.nextAppointment.scheduledAt)} (${ra.nextAppointment.status === 'confirmed' ? 'confirmada' : 'pendente'})`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Footer stats ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Custo Projetado',  val: fmtBRL(patient.projectedCost),  color: riskColor(patient.riskLevel) },
            { label: 'Marcadores Alt.',  val: `${patient.alteredCount}/7`,     color: patient.alteredCount >= 4 ? C.high : patient.alteredCount >= 2 ? C.med : C.low },
            { label: 'Consultas (12m)',  val: String(patient.consultas12m),    color: C.blue },
            { label: 'Últ. Exame',       val: `${patient.diasUltimoExame}d`,   color: patient.diasUltimoExame > 120 ? C.high : C.dim },
          ].map(s => (
            <div key={s.label} style={{
              background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '12px 14px', textAlign: 'center',
            }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 19, ...MONO }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
