import type { Placement } from 'react-joyride'
// Shared tour spec maintained at the repo root and consumed by the app.
import tourSpec from './tour.json'

// ── Raw spec types (mirror of tour.json) ────────────────────────────────────────

interface RawStep {
  target: string
  title: string
  content: string
  placement?: string
  inner_tour?: RawSection
}
interface RawSection {
  url: string
  tour: RawStep[]
}

// ── Flattened step the runner consumes ──────────────────────────────────────────

export interface FlatStep {
  /** Route this step lives on. */
  url: string
  target: string
  title: string
  content: string
  placement: Placement | 'auto' | 'center'
  /** Tab to activate (within a dashboard) before showing the step. */
  tab?: { event: string; tabId: string }
  /** Event that opens a representative modal/popup for this step (if any). */
  open?: { event: string }
}

/**
 * Per-route tab wiring. Each dashboard listens for its CustomEvent and switches
 * to the requested tab; the `map` translates a `data-tour` prefix → internal tab id.
 */
const TAB_CONFIG: Record<string, { event: string; map: Record<string, string> }> = {
  '/operadora': {
    event: 'operadora-tab',
    map: { geral: 'overview', carteira: 'carteira', roi: 'roi' },
  },
  '/medico': {
    event: 'medico-tab',
    map: { pacientes: 'pacientes', agenda: 'agenda', exames: 'exames' },
  },
  '/paciente': {
    event: 'paciente-tab',
    map: { saude: 'saude', consultas: 'consultas', registros: 'registros', integracoes: 'integracoes' },
  },
}

/**
 * Per-route event that opens the screen's representative popup so the tour can
 * showcase it. The dashboard listens for this event and opens the modal with a
 * demo entity; it closes on `tour-close-modals` (dispatched on non-modal steps).
 */
const MODAL_EVENT: Record<string, string> = {
  '/operadora': 'operadora-open-modal',
  '/medico': 'medico-open-modal',
  '/paciente': 'paciente-open-modal',
}

/** Pull the `data-tour="…"` value out of a target selector. */
function tourKey(target: string): string | null {
  const m = target.match(/data-tour="([^"]+)"/)
  return m ? m[1] : null
}

/** Steps targeting `[data-tour="modal"]` open the route's representative popup. */
function deriveOpen(url: string, target: string): FlatStep['open'] {
  const key = tourKey(target)
  const event = MODAL_EVENT[url]
  if (key === 'modal' && event) return { event }
  return undefined
}

/** Derive which tab (if any) must be active for a step on a given route. */
function deriveTab(url: string, target: string): FlatStep['tab'] {
  const cfg = TAB_CONFIG[url]
  const key = tourKey(target)
  if (!cfg || !key) return undefined
  const prefix = key.split('-')[0]
  const tabId = cfg.map[prefix]
  return tabId ? { event: cfg.event, tabId } : undefined
}

function placementOf(p?: string): FlatStep['placement'] {
  return (p as FlatStep['placement']) ?? 'bottom'
}

/**
 * Walk the nested spec into a single ordered list. Each top-level step is emitted
 * on its own route; an `inner_tour` is expanded inline right after its parent so
 * the tour dives into the dashboard, then returns to continue the overview.
 */
export function flattenTour(spec: RawSection[]): FlatStep[] {
  const out: FlatStep[] = []
  const root = spec[0]
  if (!root) return out

  for (const step of root.tour) {
    out.push({
      url: root.url,
      target: step.target,
      title: step.title,
      content: step.content,
      placement: placementOf(step.placement),
    })

    if (step.inner_tour) {
      const inner = step.inner_tour
      for (const sub of inner.tour) {
        out.push({
          url: inner.url,
          target: sub.target,
          title: sub.title,
          content: sub.content,
          placement: placementOf(sub.placement),
          tab: deriveTab(inner.url, sub.target),
          open: deriveOpen(inner.url, sub.target),
        })
      }
    }
  }

  return out
}

export const FLAT_STEPS: FlatStep[] = flattenTour(tourSpec as RawSection[])
