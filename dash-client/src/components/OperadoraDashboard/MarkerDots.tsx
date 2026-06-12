import { useOperadoraColors } from './theme'

const LABELS = ['Gli','Ins','CT','LDL','HDL','TG','PAS']

export default function MarkerDots({ altered }: { altered: boolean[] }) {
  const { C } = useOperadoraColors()
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {altered.map((a, i) => (
        <div key={i} title={LABELS[i]} style={{
          width: 9, height: 9, borderRadius: '50%',
          background: a ? C.high : C.border,
          border: `1px solid ${a ? C.high : C.muted}`,
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}
