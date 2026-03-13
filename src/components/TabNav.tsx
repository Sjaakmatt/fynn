// src/components/TabNav.tsx
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

const TABS: { id: Tab; label: string; proOnly: boolean }[] = [
  { id: 'overzicht', label: 'Overzicht', proOnly: false },
  { id: 'analyse',   label: 'Analyse',   proOnly: false },
  { id: 'budget',    label: 'Budget',    proOnly: true  },
  { id: 'kalender',  label: 'Kalender',  proOnly: true  },
  { id: 'sparen',    label: 'Sparen',    proOnly: true  },
]

function TabIcon({ id, active }: { id: Tab; active: boolean }) {
  const color = active ? 'var(--brand)' : 'currentColor'
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (id) {
    case 'overzicht':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="4" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="11" width="7" height="10" rx="1.5" />
        </svg>
      )
    case 'analyse':
      return (
        <svg {...props}>
          <path d="M3 20L9 14L13 18L21 10" />
          <path d="M17 10H21V14" />
        </svg>
      )
    case 'budget':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7V12L15 15" />
        </svg>
      )
    case 'kalender':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2V6" />
          <path d="M8 2V6" />
          <path d="M3 10H21" />
        </svg>
      )
    case 'sparen':
      return (
        <svg {...props}>
          <path d="M19 5L5 19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      )
  }
}

export function TabProvider({ children, isPro }: { children: React.ReactNode; isPro: boolean }) {
  const [active, setActive] = useState<Tab>('overzicht')
  return (
    <TabContext.Provider value={{ active, setActive, isPro }}>
      {children}
    </TabContext.Provider>
  )
}

/* ── TabBar: desktop pill bar + mobile bottom bar ── */
export function TabBar() {
  const { active, setActive, isPro } = useTab()

  return (
    <>
      {/* Desktop — inline pill bar */}
      <div className="hidden sm:flex gap-1 p-0.5 rounded-xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
        {TABS.map(tab => {
          const locked = tab.proOnly && !isPro
          const isActive = active === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => { if (!locked) setActive(tab.id) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: isActive ? 'var(--tab-active)' : 'transparent',
                color: locked ? 'var(--muted)' : isActive ? 'var(--tab-active-text)' : 'var(--muted)',
                opacity: locked ? 0.3 : 1,
                cursor: locked ? 'not-allowed' : 'pointer',
              }}
              title={locked ? 'Upgrade naar Pro' : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Mobile — fixed bottom bar */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-[90] border-t"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex">
          {TABS.map(tab => {
            const locked = tab.proOnly && !isPro
            const isActive = active === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => { if (!locked) setActive(tab.id) }}
                className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 transition-colors"
                style={{
                  color: locked ? 'var(--muted)' : isActive ? 'var(--brand)' : 'var(--muted)',
                  opacity: locked ? 0.3 : 1,
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                <TabIcon id={tab.id} active={isActive} />
                <span className="text-[10px] leading-none mt-0.5">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function TabPanel({ id, children }: { id: Tab; children: React.ReactNode }) {
  const { active } = useTab()
  if (active !== id) return null
  return <div className="animate-fadeIn">{children}</div>
}