'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabProvider, TabBar, TabPanel } from './TabNav'
import ThemeToggle from './ThemeToggle'
import SavingsSetup from './SavingsSetup'
import SubscriptionManager from './checkout/SubscriptionManager'
import GenerateBriefingButton from './GenerateBriefingButton'
import BudgetPlanner from './BudgetPlanner'
import HealthScore from './HealthScore'
import FinancialRadar from './FinancialRadar'
import SubscriptionBanner from './checkout/SubscriptionBanner'
import CategoryBreakdown from './CategoryBreakdown'
import OnboardingFlow from './OnboardingFlow'
import AFMDisclaimer from './AFMDisclaimer'
import VasteLastenKalender from './VasteLastenKalender'
import SpaargoalCoach from './SpaargoalCoach'
import CoachModal from './CoachModal'
import BankConnectModal from './BankConnectModal'

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'inkomen': '💵', 'overig': '📦',
}

interface Props {
  user: { id: string; email?: string }
  accounts: { id: string; account_name: string; iban: string; balance?: number | null; account_type?: string }[]
  stats: {
    beschikbaar: number
    nogTeBetalen: number
    nogTeOntvangen: number
    reedsBetaald: number
    totalBalance: number
    totalUitgaven: number
    totalInkomen: number
    totalGespaard: number
    spaarpct: string
  }
  sortedCategories: [string, { total: number; count: number }][]
  briefing: { content: string; created_at: string } | null
  transactionCount: number
  subscriptionStatus: string | null
  trialEndsAt: string | null
  isPro: boolean
  activeMonthLabel?: string
  isHistoricData?: boolean
  pendingItems?: { description: string; amount: number; category: string; day_of_month: number }[]
}

export default function DashboardShell({
  user, accounts, stats, sortedCategories, briefing,
  transactionCount, subscriptionStatus, trialEndsAt, isPro,
  activeMonthLabel, isHistoricData,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showSavingsSetup, setShowSavingsSetup] = useState(false)
  const [showBankModal, setShowBankModal] = useState(false)

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      router.replace('/dashboard')
      setShowSavingsSetup(true)
      setTimeout(() => router.refresh(), 2000)
    }
  }, [searchParams, router])

  const firstName = user.email?.split('@')[0] ?? 'daar'
  const hasData = accounts.length > 0

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
              {hasData && (
                <button
                  onClick={() => setShowBankModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                  }}>
                  + Bank
                </button>
              )}
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

          {/* Savings setup — toont direct na bank koppelen */}
          {showSavingsSetup && (
            <SavingsSetup
              onComplete={() => {
                setShowSavingsSetup(false)
                router.refresh()
              }}
            />
          )}

          {/* Onboarding — toont als er nog geen rekeningen zijn */}
          {!hasData && !showSavingsSetup && (
            <OnboardingFlow userId={user.id} isPro={isPro} />
          )}

          {/* Banner — altijd zichtbaar */}
          <SubscriptionBanner
            status={subscriptionStatus}
            trialEndsAt={trialEndsAt}
          />

          {/* OVERZICHT TAB */}
          {hasData && (
            <TabPanel id="overzicht">

              {/* ── BLOK 1: Greeting + beschikbaar ── */}
              <div className="rounded-2xl p-6 text-white"
                style={{ backgroundColor: 'var(--brand)' }}>
                <p className="text-sm opacity-70 mb-3">Hoi {firstName} 👋</p>
                <p className="text-xs opacity-60 mb-1">Vrij te besteden deze maand</p>
                <p className="text-5xl font-bold mb-1">
                  €{stats.beschikbaar.toFixed(0)}
                </p>
                <p className="text-xs opacity-50 mb-5">
                  na saldo (€{stats.totalBalance.toFixed(0)}) min nog te betalen (€{stats.nogTeBetalen.toFixed(0)})
                </p>

                {/* Rekeningen */}
                <div className="border-t border-white/10 pt-4 space-y-2">
                  {[...accounts]
                    .sort((a, b) => {
                      // Betaalrekeningen eerst, spaarrekeningen onderaan
                      if (a.account_type === 'SAVINGS') return 1
                      if (b.account_type === 'SAVINGS') return -1
                      return 0
                    })
                    .map(account => (
                      <div key={account.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: account.account_type === 'SAVINGS' ? '#60a5fa' : '#4ade80' }} />
                          <p className="text-sm opacity-80">{account.account_name}</p>
                        </div>
                        {account.balance != null && (
                          <p className="text-sm font-semibold">
                            €{Number(account.balance).toFixed(0)}
                          </p>
                        )}
                      </div>
                    ))}
                  <button
                    onClick={() => setShowBankModal(true)}
                    className="w-full mt-2 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                    + Extra rekening koppelen
                  </button>
                </div>
              </div>

              {/* ── BLOK 2: Fynn zegt (briefing) ── */}
              {isPro ? (
                <div className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-4 flex items-center justify-between border-b"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>✦ Fynn zegt</span>
                      {briefing && (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          · {new Date(briefing.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                        </span>
                      )}
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
                        <AFMDisclaimer />
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>
                        Genereer je eerste briefing — Fynn analyseert je uitgaven en geeft je een persoonlijk overzicht.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="text-2xl">📬</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text)' }}>
                      Wekelijkse briefing van Fynn
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Elke maandag een persoonlijk overzicht — Pro only.
                    </p>
                  </div>
                  <button className="text-xs px-3 py-2 rounded-xl text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand)' }}>
                    Pro
                  </button>
                </div>
              )}

              {/* ── BLOK 3: Score ── */}
              <HealthScore />

            </TabPanel>
          )}

          {/* ANALYSE TAB */}
          {hasData && (
            <TabPanel id="analyse">
              <FinancialRadar />
              <CategoryBreakdown
                sortedCategories={sortedCategories}
                totalUitgaven={stats.totalUitgaven}
              />
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

          {hasData && (
            <TabPanel id="kalender">
              <VasteLastenKalender />
            </TabPanel>
          )}

          {hasData && isPro && (
            <TabPanel id="sparen">
              <SpaargoalCoach />
            </TabPanel>
          )}

          {hasData && isPro && (
            <TabPanel id="budget">
              <BudgetPlanner />
              <AFMDisclaimer />
            </TabPanel>
          )}

        </main>

        {hasData && <CoachModal isPro={isPro} />}

        {showBankModal && (
          <BankConnectModal onClose={() => setShowBankModal(false)} />
        )}

      </div>
    </TabProvider>
  )
}