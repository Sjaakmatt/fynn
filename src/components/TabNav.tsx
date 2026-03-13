'use client'

import { useState, createContext, useContext } from 'react'

type Tab = 'overzicht' | 'analyse' | 'budget' | 'kalender' | 'sparen'

const TabContext = createContext<{
  active: Tab
  setActive: (t: Tab) => void
  isPro: boolean
}>({
  active: 'overzicht',
  setActive: () => {},
  isPro: false,
})

export function useTab() {
  return useContext(TabContext)
}

const TABS: { id: Tab; label: string; icon: string; proOnly: boolean }[] = [
  { id: 'overzicht', label: 'Overzicht', icon: '◎', proOnly: false },
  { id: 'analyse',   label: 'Analyse',   icon: '↗', proOnly: false },
  { id: 'kalender',  label: 'Kalender',  icon: '▦', proOnly: true  },
  { id: 'sparen',    label: 'Sparen',    icon: '◉', proOnly: true  },
  { id: 'budget',    label: 'Budget',    icon: '◈', proOnly: true  },
]

export function TabProvider({ children, isPro }: { children: React.ReactNode; isPro: boolean }) {
  const [active, setActive] = useState<Tab>('overzicht')
  return (
    <TabContext.Provider value={{ active, setActive, isPro }}>
      {children}
    </TabContext.Provider>
  )
}

export function TabBar() {
  const { active, setActive, isPro } = useTab()

  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
      {TABS.map(tab => {
        const locked = tab.proOnly && !isPro
        const isActive = active === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => { if (!locked) setActive(tab.id) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all relative"
            style={{
              backgroundColor: isActive ? 'var(--tab-active)' : 'transparent',
              color: locked ? 'var(--muted)' : isActive ? 'var(--tab-active-text)' : 'var(--muted)',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              opacity: locked ? 0.5 : 1,
              cursor: locked ? 'not-allowed' : 'pointer',
            }}
            title={locked ? 'Upgrade naar Pro' : undefined}
          >
            <span className="text-xs">{tab.icon}</span>
            <span className="hidden sm:block">{tab.label}</span>
            {locked && (
              <span className="text-xs leading-none" style={{ fontSize: 9 }}>🔒</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, children }: { id: Tab; children: React.ReactNode }) {
  const { active } = useTab()
  if (active !== id) return null
  return <div className="animate-fadeIn">{children}</div>
}