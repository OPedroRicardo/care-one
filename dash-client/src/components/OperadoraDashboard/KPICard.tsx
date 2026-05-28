import { C, MONO, SANS } from './theme'

interface KPICardProps {
  label: string
  value: string
  sub?: string
  color?: string
  delay?: number
}

export default function KPICard({ label, value, sub, color = C.blue, delay = 0 }: KPICardProps) {
  return (
    <div
      className="anim-fade-up"
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '20px 24px', flex: 1, minWidth: 0,
        animationDelay: `${delay}ms`,
        transition: 'border-color 0.18s ease, transform 0.18s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}55`
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = C.border
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      <div style={{ color: C.muted, fontSize: 11, ...SANS, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 30, ...MONO, fontWeight: 400, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: C.dim, fontSize: 11, ...SANS, marginTop: 7 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
