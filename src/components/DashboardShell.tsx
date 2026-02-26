'use client'

import { TabProvider, TabBar, TabPanel } from './TabNav'
import ThemeToggle from './ThemeToggle'
import ChatCoach from './ChatCoach'
import UitgaveCheck from './UitgaveCheck'
import SubscriptionManager from './checkout/SubscriptionManager'
import GenerateBriefingButton from './GenerateBriefingButton'
import BudgetPlanner from './BudgetPlanner'
import HealthScore from './HealthScore'
import FinancialRadar from './FinancialRadar'
import SubscriptionBanner from './checkout/SubscriptionBanner'
import ConnectBank from '@/components/ConnectBank'
import CategoryBreakdown from './CategoryBreakdown'
import OnboardingFlow from './OnboardingFlow'
import AFMDisclaimer from './AFMDisclaimer'
import VasteLastenKalender from './VasteLastenKalender'

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'inkomen': '💵', 'overig': '📦',
}

interface Props {
  user: { id: string; email?: string }
  accounts: { id: string; account_name: string; iban: string; balance?: number | null }[]
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
  subscriptionStatus: string | null
  trialEndsAt: string | null
  isPro: boolean
}

export default function DashboardShell({
  user, accounts, stats, sortedCategories, briefing,
  transactionCount, subscriptionStatus, trialEndsAt, isPro
}: Props) {
  const firstName = user.email?.split('@')[0] ?? 'daar'
  const hasData = accounts.length > 0 && transactionCount > 0

  return (
    <TabProvider isPro={isPro}>
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
          {hasData && (
            <div className="max-w-2xl mx-auto px-4 pb-3">
              <TabBar />
            </div>
          )}
        </nav>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Onboarding */}
          {!hasData && (
            <OnboardingFlow userId={user.id} isPro={isPro} />
          )}

          {/* Reconnect + Banner — altijd zichtbaar */}
          {hasData && (
            <ConnectBank
              userId={user.id}
              label="Rekening opnieuw koppelen"
              compact={true}
            />
          )}
          <SubscriptionBanner
            status={subscriptionStatus}
            trialEndsAt={trialEndsAt}
          />

          {/* OVERZICHT TAB */}
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
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs opacity-60 mb-1">Saldo</p>
                    <p className="text-lg font-semibold">
                      {accounts[0]?.balance != null ? `€${Number(accounts[0].balance).toFixed(0)}` : '—'}
                    </p>
                  </div>
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

              {/* Briefing — alleen Pro */}
              {isPro ? (
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
                        <AFMDisclaimer />
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>
                        Klik op "Genereer" voor je eerste persoonlijke briefing.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Upgrade nudge voor free users */
                <div className="rounded-2xl p-5 text-center"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-2xl mb-2">📬</p>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                    Wekelijkse persoonlijke briefing
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                    Elke maandag een helder overzicht van jouw financiën — alleen voor Pro.
                  </p>
                  <button className="text-xs px-4 py-2 rounded-xl text-white"
                    style={{ backgroundColor: 'var(--brand)' }}>
                    Upgrade naar Pro
                  </button>
                </div>
              )}

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
                    <div className="flex items-center gap-2">
                      {account.balance != null && (
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          €{Number(account.balance).toFixed(2)}
                        </p>
                      )}
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            </TabPanel>
          )}

          {/* ANALYSE TAB */}
          {hasData && (
            <TabPanel id="analyse">
              <CategoryBreakdown
                sortedCategories={sortedCategories}
                totalUitgaven={stats.totalUitgaven}
              />
              {/* Abonnementenbeheer — alleen Pro */}
              {isPro ? (
                <SubscriptionManager />
              ) : (
                <div className="rounded-2xl p-5 text-center mt-4"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-2xl mb-2">📱</p>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                    Abonnementenbeheer
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                    Zie precies welke abonnementen je hebt en wat ze kosten — alleen voor Pro.
                  </p>
                  <button className="text-xs px-4 py-2 rounded-xl text-white"
                    style={{ backgroundColor: 'var(--brand)' }}>
                    Upgrade naar Pro
                  </button>
                </div>
              )}
            </TabPanel>
          )}

          {/* COACH TAB — alleen Pro */}
          {hasData && isPro && (
            <TabPanel id="coach">
              <ChatCoach />
              <AFMDisclaimer />
            </TabPanel>
          )}

          {hasData && (
            <TabPanel id="kalender">
              <VasteLastenKalender />
            </TabPanel>
          )}

          {/* BUDGET TAB — alleen Pro */}
          {hasData && isPro && (
            <TabPanel id="budget">
              <BudgetPlanner />
              <AFMDisclaimer />
            </TabPanel>
          )}

          {/* CHECK TAB — alleen Pro */}
          {hasData && isPro && (
            <TabPanel id="check">
              <UitgaveCheck />
              <AFMDisclaimer />
            </TabPanel>
          )}

        </main>
      </div>
    </TabProvider>
  )
}