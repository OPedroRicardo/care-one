import { useOperadoraColors } from './theme'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { C } = useOperadoraColors()
  return (
    <div style={{ background: C.border, borderRadius: 4, height: 5, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${clamp(value, 0, 100)}%`, background: color ?? C.blue, height: '100%', borderRadius: 4 }} />
    </div>
  )
}
