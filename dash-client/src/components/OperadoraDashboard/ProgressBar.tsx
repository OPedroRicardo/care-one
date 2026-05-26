import { C } from './theme'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function ProgressBar({ value, color = C.blue }: { value: number; color?: string }) {
  return (
    <div style={{ background: C.border, borderRadius: 4, height: 5, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${clamp(value, 0, 100)}%`, background: color, height: '100%', borderRadius: 4 }} />
    </div>
  )
}
