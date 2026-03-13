// src/components/OnboardingFlow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PlaidLinkButton from '@/components/plaid/PlaidLinkButton'

const BANKING_PROVIDER = process.env.NEXT_PUBLIC_BANKING_PROVIDER ?? 'plaid'

interface Props {
  userId: string
  isPro: boolean
}

interface Bank {
  name: string
  country: 'NL' | 'BE'
}

const BANKS: Bank[] = [
  { name: 'ABN AMRO', country: 'NL' },
  { name: 'ING', country: 'NL' },
  { name: 'Rabobank', country: 'NL' },
  { name: 'SNS Bank', country: 'NL' },
  { name: 'ASN Bank', country: 'NL' },
  { name: 'RegioBank', country: 'NL' },
  { name: 'Triodos Bank', country: 'NL' },
  { name: 'Knab', country: 'NL' },
  { name: 'Bunq', country: 'NL' },
  { name: 'KBC', country: 'BE' },
  { name: 'BNP Paribas Fortis', country: 'BE' },
  { name: 'ING', country: 'BE' },
  { name: 'Belfius', country: 'BE' },
]

export default function OnboardingFlow({ userId, isPro }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'NL' | 'BE'>('NL')

  // Na bank connect: refresh en clean URL
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      router.replace('/dashboard')
      router.refresh()
    }
  }, [searchParams, router])

  function connectEB(bank: Bank) {
    setLoading(bank.name)
    window.location.href = `/api/enablebanking/connect?bank=${encodeURIComponent(bank.name)}&country=${bank.country}`
  }

  const filtered = BANKS.filter(b => b.country === filter)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: isPro ? 'var(--brand)' : 'var(--surface)', border: isPro ? 'none' : '1px solid var(--border)' }}>

      {/* ── Header ── */}
      <div className={`px-6 pt-8 pb-6 text-center ${isPro ? '' : 'border-b'}`}
        style={isPro ? {} : { borderColor: 'var(--border)' }}>
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: isPro ? 'rgba(255,255,255,0.15)' : 'var(--brand)' }}
        >
          <span className="text-white font-bold text-xl">F</span>
        </div>
        <h2
          className="text-xl font-semibold mb-1"
          style={{ color: isPro ? 'white' : 'var(--text)' }}
        >
          {isPro ? 'Welkom bij Fynn Pro' : 'Welkom bij Fynn'}
        </h2>
        <p
          className="text-sm"
          style={{ color: isPro ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}
        >
          Koppel je bankrekening om te beginnen. Fynn analyseert alles automatisch.
        </p>
      </div>

      {/* ── Pro: wat je krijgt ── */}
      {isPro && (
        <div className="px-6 pb-5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '📬', label: 'Wekelijkse briefing' },
              { icon: '💬', label: 'AI Coach' },
              { icon: '🎯', label: 'Persoonlijk budget' },
              { icon: '📡', label: 'Cashflow radar' },
            ].map(f => (
              <div
                key={f.label}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <span className="text-base">{f.icon}</span>
                <span className="text-xs font-medium text-white/80">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Free: stappen ── */}
      {!isPro && (
        <div className="px-6 py-5 space-y-3">
          {[
            { n: 1, title: 'Bankrekening koppelen', desc: 'Veilig via PSD2 — alleen leestoegang' },
            { n: 2, title: 'Automatische analyse', desc: 'Fynn categoriseert al je transacties' },
            { n: 3, title: 'Inzicht in je financiën', desc: 'Zie direct waar je geld naartoe gaat' },
          ].map(item => (
            <div key={item.n} className="flex items-center gap-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--brand)', border: '2px solid var(--brand)' }}
              >
                {item.n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bank koppelen ── */}
      <div className="px-6 pb-6 space-y-3">
        <p
          className="text-sm font-medium"
          style={{ color: isPro ? 'rgba(255,255,255,0.9)' : 'var(--text)' }}
        >
          {BANKING_PROVIDER === 'plaid' ? 'Koppel je bank' : 'Selecteer je bank'}
        </p>

        {BANKING_PROVIDER === 'plaid' ? (
          <PlaidLinkButton
            className="w-full py-3 rounded-xl text-sm font-medium transition-all"
            style={isPro
              ? { backgroundColor: 'white', color: 'var(--brand)' }
              : { backgroundColor: 'var(--brand)', color: 'white' }
            }
          >
            🏦 Bank koppelen
          </PlaidLinkButton>
        ) : (
          <>
            {/* Land toggle */}
            <div
              className="flex p-1 rounded-xl"
              style={{ backgroundColor: isPro ? 'rgba(255,255,255,0.12)' : 'var(--tab-bg)' }}
            >
              {(['NL', 'BE'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={isPro
                    ? {
                        backgroundColor: filter === c ? 'white' : 'transparent',
                        color: filter === c ? 'var(--brand)' : 'rgba(255,255,255,0.7)',
                      }
                    : {
                        backgroundColor: filter === c ? 'var(--tab-active)' : 'transparent',
                        color: filter === c ? 'var(--tab-active-text)' : 'var(--muted)',
                      }
                  }
                >
                  {c === 'NL' ? '🇳🇱 Nederland' : '🇧🇪 België'}
                </button>
              ))}
            </div>

            {/* Bank grid */}
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(bank => {
                const isLoading = loading === bank.name
                const isDisabled = loading !== null
                return (
                  <button
                    key={`${bank.name}-${bank.country}`}
                    onClick={() => connectEB(bank)}
                    disabled={isDisabled}
                    className="py-2.5 px-3 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between"
                    style={isPro
                      ? {
                          backgroundColor: isLoading ? 'white' : 'rgba(255,255,255,0.12)',
                          color: isLoading ? 'var(--brand)' : 'white',
                          opacity: isDisabled && !isLoading ? 0.4 : 1,
                        }
                      : {
                          backgroundColor: isLoading ? 'var(--brand)' : 'var(--tab-bg)',
                          color: isLoading ? 'white' : 'var(--text)',
                          border: '1px solid var(--border)',
                          opacity: isDisabled && !isLoading ? 0.4 : 1,
                        }
                    }
                  >
                    <span className="truncate">🏦 {bank.name}</span>
                    {isLoading && (
                      <span className="text-xs shrink-0 ml-1">...</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <p
          className="text-center text-xs"
          style={{ color: isPro ? 'rgba(255,255,255,0.5)' : 'var(--muted)' }}
        >
          🔒 PSD2 beveiligd · Alleen leestoegang · Nooit schrijftoegang
        </p>
      </div>

      {/* ── Free: upgrade nudge ── */}
      {!isPro && (
        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Wil je briefings, een AI coach en budgetplanner?{' '}
            <a href="/pricing" className="font-medium" style={{ color: 'var(--brand)' }}>
              Upgrade naar Pro →
            </a>
          </p>
        </div>
      )}
    </div>
  )
}