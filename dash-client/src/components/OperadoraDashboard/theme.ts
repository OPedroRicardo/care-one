import type { CSSProperties } from 'react'

export const C = {
  bg: '#0B1120',
  surface: '#111827',
  raised: '#162032',
  border: '#1e2d45',
  text: '#F1F5F9',
  muted: '#64748B',
  dim: '#94A3B8',
  high: '#F87171',
  highBg: 'rgba(248,113,113,0.10)',
  med: '#FBBF24',
  medBg: 'rgba(251,191,36,0.10)',
  low: '#00D4A8',
  lowBg: 'rgba(0,212,168,0.10)',
  blue: '#60A5FA',
  blueBg: 'rgba(96,165,250,0.10)',
}

export const MONO: CSSProperties = { fontFamily: "'DM Mono', 'Courier New', monospace" }
export const SANS: CSSProperties = { fontFamily: "'DM Sans', system-ui, sans-serif" }

export const riskColor = (l: string) => l === 'alto' ? C.high : l === 'medio' ? C.med : C.low
export const riskBg = (l: string) => l === 'alto' ? C.highBg : l === 'medio' ? C.medBg : C.lowBg
export const fmtBRL = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
