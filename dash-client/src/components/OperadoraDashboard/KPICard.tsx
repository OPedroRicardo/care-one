import { C, MONO, SANS } from './theme'

interface KPICardProps {
  label: string
  value: string
  sub?: string
  color?: string
}

export default function KPICard({ label, value, sub, color = C.blue }: KPICardProps) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 0 }}>
      <div style={{ color: C.muted, fontSize: 11, ...SANS, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>{label}</div>
      <div style={{ color, fontSize: 30, ...MONO, fontWeight: 400, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.dim, fontSize: 11, ...SANS, marginTop: 7 }}>{sub}</div>}
    </div>
  )
}
