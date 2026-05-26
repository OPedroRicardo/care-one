import { C, MONO, SANS } from './theme'

interface ChartTipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

export default function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', ...SANS, minWidth: 140 }}>
      {label && <div style={{ color: C.muted, fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ color: C.dim, fontSize: 12 }}>{p.name}</span>
          <span style={{ color: p.color ?? C.text, fontSize: 12, ...MONO }}>
            {typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
