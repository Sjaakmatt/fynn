// src/components/DashboardShell.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabProvider, TabBar, TabPanel } from './TabNav'
import ThemeToggle from './ThemeToggle'
import SavingsSetup from './SavingsSetup'
import SubscriptionManager from './SubscriptionManager'
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

const CATEGORY_LABELS: Record<string, string> = {
  'boodschappen': 'Boodschappen',
  'transport': 'Transport',
  'eten & drinken': 'Eten & drinken',
  'kleding': 'Kleding',
}

interface Props {
  user: { id: string; email?: string; firstName?: string }
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
    variabelReservering: number
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
  variabelPerCategorie?: Record<string, { budget: number; gespendeerd: number; resterend: number }>
}

export default function DashboardShell({
  user, accounts, stats, sortedCategories, briefing,
  transactionCount, subscriptionStatus, trialEndsAt, isPro,
  activeMonthLabel, isHistoricData, variabelPerCategorie,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showSavingsSetup, setShowSavingsSetup] = useState(false)
  const [showBankModal, setShowBankModal] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const [isJustConnected, setIsJustConnected] = useState(
    searchParams.get('connected') === 'true'
  )

  useEffect(() => {
    if (isJustConnected) {
      router.replace('/dashboard')
      const timer = setTimeout(() => {
        router.refresh()
        setIsJustConnected(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isJustConnected, router])

  // Escape handler for breakdown modal
  useEffect(() => {
    if (!showBreakdown) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBreakdown(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showBreakdown])

  const firstName = user.firstName ?? user.email?.split('@')[0] ?? 'daar'
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
              <button
                onClick={() => router.push('/account')}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </button>
            </div>
          </div>
          {hasData && (
            <div className="max-w-2xl mx-auto px-4 pb-3">
              <TabBar />
            </div>
          )}
        </nav>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {showSavingsSetup && (
            <SavingsSetup
              onComplete={() => {
                setShowSavingsSetup(false)
                router.refresh()
              }}
            />
          )}

          {!hasData && !showSavingsSetup && !isJustConnected && (
            <OnboardingFlow userId={user.id} isPro={isPro} />
          )}

          {isJustConnected && !hasData && (
            <div className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4"
                style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Dashboard wordt geladen...
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Je gegevens worden verwerkt
              </p>
            </div>
          )}

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
                <p className="text-5xl font-bold mb-1"
                  style={{ color: stats.beschikbaar < 0 ? '#FCA5A5' : 'white' }}>
                  €{Math.abs(stats.beschikbaar).toFixed(0)}
                  {stats.beschikbaar < 0 && <span className="text-2xl ml-2 opacity-80">tekort</span>}
                </p>

                {/* Subtitel met breakdown knop */}
                <button
                  onClick={() => setShowBreakdown(true)}
                  className="text-xs opacity-50 mb-5 flex items-center gap-1 hover:opacity-80 transition-opacity"
                >
                  <span>
                    saldo €{stats.totalBalance.toFixed(0)}
                    {stats.nogTeBetalen > 0 && ` − €${stats.nogTeBetalen.toFixed(0)} vaste lasten`}
                    {stats.variabelReservering > 0 && ` − €${stats.variabelReservering.toFixed(0)} variabel`}
                  </span>
                  <span className="opacity-60">ⓘ</span>
                </button>

                {/* Rekeningen */}
                <div className="border-t border-white/10 pt-4 space-y-2">
                  {[...accounts]
                    .sort((a, b) => {
                      if (a.account_type === 'SAVINGS') return 1
                      if (b.account_type === 'SAVINGS') return -1
                      return 0
                    })
                    .map(account => (
                      <div key={account.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: account.account_type === 'SAVINGS' ? '#60a5fa' : '#4ade80' }} />
                          <p className="text-sm opacity-80 truncate">{account.account_name}</p>
                        </div>
                        {account.balance != null && (
                          <p className="text-sm font-semibold tabular-nums shrink-0 ml-3">
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text)' }}>
                      Wekelijkse briefing van Fynn
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Elke maandag een persoonlijk overzicht — Pro only.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs px-3 py-2 rounded-xl text-white shrink-0"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
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
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs px-4 py-2 rounded-xl text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    Upgrade naar Pro
                  </button>
                </div>
              )}
            </TabPanel>
          )}

          {/* KALENDER TAB — TabPanel handles pro gate */}
          {hasData && (
            <TabPanel id="kalender">
              <VasteLastenKalender />
            </TabPanel>
          )}

          {/* SPAREN TAB — TabPanel handles pro gate */}
          {hasData && (
            <TabPanel id="sparen">
              <SpaargoalCoach />
            </TabPanel>
          )}

          {/* BUDGET TAB — TabPanel handles pro gate */}
          {hasData && (
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

        {/* ── Breakdown Modal ── */}
        {showBreakdown && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowBreakdown(false)}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl p-6 pb-10 space-y-5"
              style={{ backgroundColor: 'var(--surface)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                  Hoe is dit berekend?
                </h2>
                <button
                  onClick={() => setShowBreakdown(false)}
                  className="text-xl leading-none"
                  style={{ color: 'var(--muted)' }}>
                  ✕
                </button>
              </div>

              {/* Regel: saldo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Huidig saldo</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Betaalrekening(en)</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>
                    + €{stats.totalBalance.toFixed(0)}
                  </p>
                </div>

                {/* Vaste lasten */}
                {stats.nogTeBetalen > 0 && (
                  <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Nog te betalen vaste lasten</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Vóór je volgende salaris</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                      − €{stats.nogTeBetalen.toFixed(0)}
                    </p>
                  </div>
                )}

                {/* Variabele budgetten */}
                {variabelPerCategorie && Object.keys(variabelPerCategorie).length > 0 && (
                  <div className="py-3 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Variabele budgetten</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                      Reservering op basis van je gemiddelde uitgaven — wat je nog niet hebt uitgegeven
                    </p>
                    {Object.entries(variabelPerCategorie).map(([cat, v]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{CATEGORY_ICONS[cat] ?? '📦'}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                              {CATEGORY_LABELS[cat] ?? cat}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              €{v.gespendeerd} van €{v.budget} budget al uitgegeven
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold shrink-0 ml-3" style={{ color: '#FCA5A5' }}>
                          − €{v.resterend}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Eindtotaal */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Vrij te besteden</p>
                  <p className="text-lg font-bold" style={{ color: stats.beschikbaar < 0 ? '#FCA5A5' : '#4ade80' }}>
                    €{Math.abs(stats.beschikbaar).toFixed(0)}
                    {stats.beschikbaar < 0 && ' tekort'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                Lasten ná je salaris tellen niet mee — die betaal je als het geld er is.
              </p>
            </div>
          </div>
        )}

      </div>
    </TabProvider>
  )
}