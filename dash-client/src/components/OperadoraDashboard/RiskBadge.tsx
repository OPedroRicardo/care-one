import { MONO, useOperadoraColors } from './theme'

export default function RiskBadge({ level }: { level: string }) {
  const { riskColor, riskBg } = useOperadoraColors()
  return (
    <span style={{
      background: riskBg(level), color: riskColor(level),
      border: `1px solid ${riskColor(level)}44`,
      ...MONO, fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 4, letterSpacing: '0.07em',
    }}>
      {level === 'alto' ? 'ALTO' : level === 'medio' ? 'MÉDIO' : 'BAIXO'}
    </span>
  )
}
