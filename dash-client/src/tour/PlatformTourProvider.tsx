import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Joyride, STATUS, type Step } from 'react-joyride'
import { useTheme } from '../contexts/ThemeContext'
import { router } from '../routes/router'
import { FLAT_STEPS, type FlatStep } from './platformTour'

interface TourCtx {
  /** Start (or restart) the full platform tour from the home screen. */
  start: () => void
  running: boolean
}

const Ctx = createContext<TourCtx>({ start: () => {}, running: false })
export const usePlatformTour = () => useContext(Ctx)

/** Tooltip width in px. Default react-joyride width is 380 — tweak this to taste. */
const TOOLTIP_WIDTH = 300

/**
 * Below this width the guided tour doesn't run: many step targets (tables, near
 * fullscreen modals, single-column sections) end up larger than the viewport,
 * which breaks Joyride's spotlight/tooltip positioning. Matches Tailwind's `md`.
 */
const MOBILE_BREAKPOINT = 768

/**
 * Wait until a step's target exists in the DOM. While waiting, the step's tab
 * event is (re)dispatched every tick — this both switches the dashboard tab and
 * sidesteps the race where the dashboard's event listener hasn't mounted yet.
 */
function ensureTarget(step: FlatStep, timeout = 9000): Promise<void> {
  return new Promise(resolve => {
    const startedAt = Date.now()
    const tick = () => {
      if (document.querySelector(step.target)) return resolve()
      if (step.tab) window.dispatchEvent(new CustomEvent(step.tab.event, { detail: step.tab.tabId }))
      // Re-dispatch the open event each tick: idempotent, and it also covers the
      // race where the dashboard's listener hasn't mounted yet after navigation.
      if (step.open) window.dispatchEvent(new CustomEvent(step.open.event))
      if (Date.now() - startedAt > timeout) return resolve()
      window.setTimeout(tick, 90)
    }
    tick()
  })
}

export function PlatformTourProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [run, setRun] = useState(false)

  // Each step gets a `before` hook (awaited by react-joyride v3): it routes to the
  // right page, switches the dashboard tab, and waits for the target to render —
  // which is what makes a single continuous tour span multiple routes.
  const steps: Step[] = useMemo(
    () =>
      FLAT_STEPS.map(f => ({
        target: f.target,
        title: f.title,
        content: f.content,
        placement: f.placement,
        before: async () => {
          if (window.location.pathname !== f.url) router.navigate(f.url)
          // Steps that don't open a popup clear any popup left open by a prior step
          // (e.g. when stepping back), so it can't cover the next target.
          if (!f.open) window.dispatchEvent(new CustomEvent('tour-close-modals'))
          await ensureTarget(f)
          // Bring the target into view ourselves (only if actually offscreen), so we
          // can disable Joyride's own scroll — which overscrolls and, together with the
          // tooltip, was producing a phantom scrollbar on pages that don't scroll.
          const el = document.querySelector(f.target)
          if (el) {
            const r = el.getBoundingClientRect()
            const offscreen = r.top < 0 || r.bottom > window.innerHeight
            if (offscreen) el.scrollIntoView({ block: 'center', behavior: 'auto' })
          }
        },
      })),
    [],
  )

  const start = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return
    if (window.location.pathname !== '/') router.navigate('/')
    // Toggle off→on so a re-trigger restarts cleanly from the first step.
    setRun(false)
    window.setTimeout(() => setRun(true), 60)
  }, [])

  return (
    <Ctx.Provider value={{ start, running: run }}>
      {children}
      <Joyride
        steps={steps}
        run={run}
        continuous
        // Fixed positioning keeps the tooltip anchored to the viewport instead of the
        // document, so it can never extend page height and spawn a phantom scrollbar.
        floatingOptions={{ strategy: 'fixed' }}
        options={{
          skipBeacon: true,
          // We scroll targets into view manually in each step's `before` hook.
          skipScroll: true,
          buttons: ['back', 'skip', 'primary'],
          showProgress: false,
          width: TOOLTIP_WIDTH,
          // Generous waits: routes mount + dashboards fetch data before targets exist.
          beforeTimeout: 12000,
          targetWaitTimeout: 6000,
          scrollOffset: 90,
          arrowColor: dark ? '#1e293b' : '#ffffff',
          backgroundColor: dark ? '#1e293b' : '#ffffff',
          primaryColor: '#0079C8',
          textColor: dark ? '#e2e8f0' : '#334155',
          overlayColor: 'rgba(0,0,0,0.55)',
          zIndex: 10000,
        }}
        locale={{ back: 'Voltar', close: 'Fechar', last: 'Concluir', next: 'Próximo', skip: 'Pular' }}
        onEvent={data => {
          if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) setRun(false)
        }}
      />
    </Ctx.Provider>
  )
}
