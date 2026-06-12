import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface HeaderTab {
  id: string
  label: string
  Icon?: React.ComponentType<{ size?: number }>
  /** Optional count badge; falsy values (0/undefined) hide the badge. */
  badge?: number
}

export interface HeaderTabsConfig {
  tabs: HeaderTab[]
  active: string
  onSelect: (id: string) => void
  /** Active-tab accent color (defaults to the Care One blue). */
  accent?: string
}

interface Ctx {
  config: HeaderTabsConfig | null
  setConfig: (c: HeaderTabsConfig | null) => void
}

const HeaderTabsContext = createContext<Ctx>({ config: null, setConfig: () => {} })

export function HeaderTabsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderTabsConfig | null>(null)
  return (
    <HeaderTabsContext.Provider value={{ config, setConfig }}>
      {children}
    </HeaderTabsContext.Provider>
  )
}

export const useHeaderTabs = () => useContext(HeaderTabsContext)

/**
 * Lets a page lift its tab navigation into the unified `Header`'s second row.
 * Pass the current config and a dependency list (active tab + any badge counts);
 * the config is cleared automatically when the page unmounts.
 */
export function useRegisterHeaderTabs(config: HeaderTabsConfig, deps: unknown[]) {
  const { setConfig } = useHeaderTabs()
  useEffect(() => {
    setConfig(config)
    return () => setConfig(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
