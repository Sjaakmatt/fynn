'use client'

import { useState, createContext, useContext } from 'react'

type Tab = 'overzicht' | 'analyse' | 'coach' | 'check' | 'budget'

const TabContext = createContext<{ active: Tab; setActive: (t: Tab) => void }>({
  active: 'overzicht',
  setActive: () => {},
})

export function useTab() {
  return useContext(TabContext)
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overzicht', label: 'Overzicht', icon: '◎' },
  { id: 'analyse', label: 'Analyse', icon: '↗' },
  { id: 'coach', label: 'Coach', icon: '✦' },
  { id: 'budget', label: 'Budget', icon: '◈' },
  { id: 'check', label: 'Check', icon: '✓' },
]

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Tab>('overzicht')
  return (
    <TabContext.Provider value={{ active, setActive }}>
      {children}
    </TabContext.Provider>
  )
}

export function TabBar() {
  const { active, setActive } = useTab()
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActive(tab.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: active === tab.id ? 'var(--tab-active)' : 'transparent',
            color: active === tab.id ? 'var(--tab-active-text)' : 'var(--muted)',
            boxShadow: active === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <span className="text-xs">{tab.icon}</span>
          <span className="hidden sm:block">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export function TabPanel({ id, children }: { id: Tab; children: React.ReactNode }) {
  const { active } = useTab()
  if (active !== id) return null
  return <div className="animate-fadeIn">{children}</div>
}