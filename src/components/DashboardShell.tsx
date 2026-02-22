'use client'

import { TabProvider, TabBar, TabPanel } from './TabNav'
import ThemeToggle from './ThemeToggle'
import ChatCoach from './ChatCoach'
import UitgaveCheck from './UitgaveCheck'
import SubscriptionManager from './SubscriptionManager'
import GenerateBriefingButton from './GenerateBriefingButton'
import BudgetPlanner from './BudgetPlanner'
import HealthScore from './HealthScore'
import FinancialRadar from './FinancialRadar'
import SubscriptionBanner from './SubscriptionBanner'

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'inkomen': '💵', 'overig': '📦',
}

interface Props {
  user: { id: string; email?: string }
  accounts: { id: string; account_name: string; iban: string }[]
  stats: {
    totalUitgaven: number
    totalInkomen: number
    beschikbaar: number
    spaarpct: string
    totalGespaard: number
  }
  sortedCategories: [string, { total: number; count: number }][]
  briefing: { content: string; created_at: string } | null
  transactionCount: number
  subscriptionStatus: string | null   // ← toevoegen
  trialEndsAt: string | null          // ← toevoegen
}

export default function DashboardShell({
  user, accounts, stats, sortedCategories, briefing, transactionCount, subscriptionStatus, trialEndsAt
}: Props) {
  const firstName = user.email?.split('@')[0] ?? 'daar'
  const hasData = accounts.length > 0 && transactionCount > 0

  return (
    <TabProvider>
      <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg)' }}>

        {/* Nav */}
        <nav className="sticky top-0 z-20 border-b transition-colors"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--brand)' }}>
                <span className="text-white text-xs font-bold">F</span>
              </div>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>Fynn</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
          {/* Tab bar */}
          {hasData && (
            <div className="max-w-2xl mx-auto px-4 pb-3">
              <TabBar />
            </div>
          )}
        </nav>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Geen data state */}
          {!hasData && (
            <div className="rounded-2xl p-10 text-center"
              style={{ backgroundColor: 'var(--surface)' }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                style={{ backgroundColor: 'var(--brand)' }}>
                🏦
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Welkom bij Fynn
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Koppel je bankrekening. Fynn analyseert alles automatisch.
              </p>
              <a href="/api/tink/link"
                className="inline-block px-6 py-3 rounded-xl text-white text-sm font-medium"
                style={{ backgroundColor: 'var(--brand)' }}>
                Bankrekening koppelen
              </a>
            </div>
          )}

          {/* OVERZICHT TAB */}
          <SubscriptionBanner 
            status={subscriptionStatus} 
            trialEndsAt={trialEndsAt} 
          />
          {hasData && (
            <TabPanel id="overzicht">
              {/* Hero */}
              <div className="rounded-2xl p-6 text-white mb-4"
                style={{ backgroundColor: 'var(--brand)' }}>
                <p className="text-sm mb-1 opacity-70">Hoi {firstName} 👋</p>
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-5xl font-bold">€{stats.totalUitgaven.toFixed(0)}</p>
                </div>
                <p className="text-sm opacity-70 mb-6">uitgegeven deze periode</p>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs opacity-60 mb-1">Inkomen</p>
                    <p className="text-lg font-semibold">€{stats.totalInkomen.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-60 mb-1">Beschikbaar</p>
                    <p className="text-lg font-semibold">€{stats.beschikbaar.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-60 mb-1">Spaarquote</p>
                    <p className="text-lg font-semibold">{stats.spaarpct}%</p>
                  </div>
                </div>
              </div>
              <FinancialRadar />
              <HealthScore />
              {/* Briefing */}
              <div className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 flex items-center justify-between border-b"
                  style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      Jouw wekelijkse briefing
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Persoonlijk overzicht van Fynn
                    </p>
                  </div>
                  <GenerateBriefingButton />
                </div>
                <div className="px-5 py-4">
                  {briefing ? (
                    <>
                      <div className="space-y-3">
                        {briefing.content.split('\n\n').filter(Boolean).map((paragraph, i) => (
                          <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                            {paragraph.trim()}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                        {new Date(briefing.created_at).toLocaleDateString('nl-NL', {
                          weekday: 'long', day: 'numeric', month: 'long'
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      Klik op "Genereer" voor je eerste persoonlijke briefing.
                    </p>
                  )}
                </div>
              </div>

              {/* Rekeningen */}
              <div className="mt-4 rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Rekeningen</h2>
                </div>
                {accounts.map(account => (
                  <div key={account.id} className="px-5 py-3 flex items-center justify-between border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                        style={{ backgroundColor: 'var(--tab-bg)' }}>🏦</div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {account.account_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{account.iban}</p>
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                ))}
              </div>
            </TabPanel>
          )}

          {/* ANALYSE TAB */}
          {hasData && (
            <TabPanel id="analyse">
              {/* Categorieën */}
              <div className="rounded-2xl overflow-hidden mb-4"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    Uitgaven per categorie
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {transactionCount} transacties geanalyseerd
                  </p>
                </div>
                <div>
                  {sortedCategories.map(([cat, data]) => {
                    const pct = stats.totalUitgaven > 0 ? (data.total / stats.totalUitgaven) * 100 : 0
                    return (
                      <div key={cat} className="px-5 py-4 border-b last:border-0"
                        style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_ICONS[cat] ?? '📦'}</span>
                            <div>
                              <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                                {cat}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                {data.count} transacties
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            €{data.total.toFixed(0)}
                          </p>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden ml-8"
                          style={{ backgroundColor: 'var(--tab-bg)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: 'var(--brand)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <SubscriptionManager />
            </TabPanel>
          )}

          {/* COACH TAB */}
          {hasData && (
            <TabPanel id="coach">
              <ChatCoach />
            </TabPanel>
          )}

          {hasData && (
            <TabPanel id="budget">
              <BudgetPlanner />
            </TabPanel>
          )}

          {/* CHECK TAB */}
          {hasData && (
            <TabPanel id="check">
              <UitgaveCheck />
            </TabPanel>
          )}

        </main>
      </div>
    </TabProvider>
  )
}