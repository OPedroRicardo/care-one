import type { CSSProperties } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

export interface Palette {
  bg: string
  surface: string
  raised: string
  border: string
  text: string
  muted: string
  dim: string
  high: string
  highBg: string
  med: string
  medBg: string
  low: string
  lowBg: string
  blue: string
  blueBg: string
}

export const DARK: Palette = {
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

export const LIGHT: Palette = {
  bg: '#F1F5F9',
  surface: '#FFFFFF',
  raised: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  dim: '#475569',
  high: '#DC2626',
  highBg: 'rgba(220,38,38,0.08)',
  med: '#D97706',
  medBg: 'rgba(217,119,6,0.10)',
  low: '#0F9D8C',
  lowBg: 'rgba(15,157,140,0.10)',
  blue: '#0079C8',
  blueBg: 'rgba(0,121,200,0.10)',
}

// Back-compat static export (defaults to the dark palette). Prefer `useOperadoraColors()`
// inside components so the dashboard re-renders when the global theme toggles.
export const C = DARK

export const MONO: CSSProperties = { fontFamily: "'DM Mono', 'Courier New', monospace" }
export const SANS: CSSProperties = { fontFamily: "'DM Sans', system-ui, sans-serif" }

export const riskColorOf = (p: Palette, l: string) => l === 'alto' ? p.high : l === 'medio' ? p.med : p.low
export const riskBgOf    = (p: Palette, l: string) => l === 'alto' ? p.highBg : l === 'medio' ? p.medBg : p.lowBg

// Back-compat helpers bound to the dark palette (used only by non-component callers).
export const riskColor = (l: string) => riskColorOf(DARK, l)
export const riskBg    = (l: string) => riskBgOf(DARK, l)

export const fmtBRL = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`

/**
 * Theme-aware access point for the Operadora palette. Reads the global `ThemeContext`
 * and returns the matching palette plus risk-color helpers bound to it, so every
 * consumer re-renders when the user flips light/dark.
 */
export function useOperadoraColors() {
  const { theme } = useTheme()
  const palette = theme === 'dark' ? DARK : LIGHT
  return {
    C: palette,
    theme,
    riskColor: (l: string) => riskColorOf(palette, l),
    riskBg:    (l: string) => riskBgOf(palette, l),
  }
}
