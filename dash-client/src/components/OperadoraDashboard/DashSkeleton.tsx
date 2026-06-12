import { useOperadoraColors } from './theme'

function Skel({ w = '100%', h = 18, radius = 6 }: { w?: number | string; h?: number; radius?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius }} />
}

function Card({ children }: { children: React.ReactNode }) {
  const { C } = useOperadoraColors()
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '20px 24px', flex: 1,
    }}>
      {children}
    </div>
  )
}

export default function DashSkeleton() {
  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <Card key={i}>
            <Skel w={80} h={10} />
            <div style={{ marginTop: 12 }}><Skel w={100} h={30} /></div>
            <div style={{ marginTop: 8 }}><Skel w={120} h={10} /></div>
          </Card>
        ))}
      </div>
      {/* Chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
        <Card><Skel h={240} /></Card>
        <Card><Skel h={240} /></Card>
      </div>
      {/* Table */}
      <Card>
        <Skel w={180} h={10} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skel key={i} h={36} radius={4} />
          ))}
        </div>
      </Card>
    </div>
  )
}
