// src/components/OnboardingFlow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PlaidLinkButton from '@/components/plaid/PlaidLinkButton'
import TransactionUpload from './TransactionUpload'

interface Props {
  userId: string
  isPro: boolean
}

const PRO_FEATURES = [
  { icon: '📬', title: 'Wekelijkse briefing', desc: 'Elke maandag een persoonlijk financieel overzicht' },
  { icon: '💬', title: 'Coach op elk moment', desc: 'Stel Fynn alles — "Kan ik me dit veroorloven?"' },
  { icon: '🎯', title: 'Persoonlijk budget', desc: 'AI genereert een budget op basis van jouw uitgaven' },
  { icon: '⚡', title: 'Uitgave check', desc: 'Real-time check voordat je iets koopt' },
  { icon: '📱', title: 'Abonnementenbeheer', desc: 'Zie precies wat je maandelijks betaalt' },
  { icon: '📡', title: 'Cashflow radar', desc: 'Voorspelling van je financiën de komende weken' },
]

// ─── Method Toggle ───────────────────────────────────────────────────────────

function MethodToggle({
  method,
  onChange,
  variant = 'light',
}: {
  method: 'plaid' | 'upload'
  onChange: (m: 'plaid' | 'upload') => void
  variant?: 'light' | 'dark'
}) {
  const isLight = variant === 'light'
  return (
    <div className="flex rounded-xl overflow-hidden"
      style={{
        backgroundColor: isLight ? 'var(--tab-bg)' : 'rgba(255,255,255,0.12)',
      }}>
      <button
        onClick={() => onChange('plaid')}
        className="flex-1 py-2 text-xs font-medium transition-all"
        style={{
          backgroundColor: method === 'plaid'
            ? (isLight ? 'var(--tab-active)' : 'white')
            : 'transparent',
          color: method === 'plaid'
            ? (isLight ? 'var(--tab-active-text)' : 'var(--brand)')
            : (isLight ? 'var(--muted)' : 'rgba(255,255,255,0.6)'),
        }}
      >
        🔗 Automatisch koppelen
      </button>
      <button
        onClick={() => onChange('upload')}
        className="flex-1 py-2 text-xs font-medium transition-all"
        style={{
          backgroundColor: method === 'upload'
            ? (isLight ? 'var(--tab-active)' : 'white')
            : 'transparent',
          color: method === 'upload'
            ? (isLight ? 'var(--tab-active-text)' : 'var(--brand)')
            : (isLight ? 'var(--muted)' : 'rgba(255,255,255,0.6)'),
        }}
      >
        📄 Upload CSV
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OnboardingFlow({ userId, isPro }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [activeFeature, setActiveFeature] = useState(0)
  const [method, setMethod] = useState<'plaid' | 'upload'>('plaid')

  // Na bank connect: refresh server data en verwijder param uit URL
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      router.replace('/dashboard')
      router.refresh()
    }
  }, [searchParams, router])

  function handleUploadComplete() {
    router.push('/sync?provider=manual')
  }

  // ── FREE ONBOARDING ──────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'var(--brand)' }}>
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
            Welkom bij Fynn
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Koppel je bankrekening om te beginnen. Fynn analyseert alles automatisch.
          </p>
        </div>

        {/* Stappen */}
        <div className="px-6 py-5 space-y-3">
          {[
            { n: 1, title: 'Bankrekening koppelen', desc: 'Automatisch via Plaid of upload je bankexport' },
            { n: 2, title: 'Automatische analyse', desc: 'Fynn categoriseert al je transacties' },
            { n: 3, title: 'Inzicht in je financiën', desc: 'Zie direct waar je geld naartoe gaat' },
          ].map(item => (
            <div key={item.n} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--brand)', border: '2px solid var(--brand)' }}>
                {item.n}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bank selectie */}
        <div className="px-6 pb-6 space-y-4">
          <MethodToggle method={method} onChange={setMethod} variant="light" />

          {method === 'plaid' && (
            <div className="space-y-3">
              <PlaidLinkButton
                className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all text-center"
                style={{ backgroundColor: 'var(--brand)', color: 'white' }}
              >
                🏦 Bank koppelen
              </PlaidLinkButton>
              <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
                🔒 Beveiligd via Plaid · Alleen leestoegang · Nooit schrijftoegang
              </p>
            </div>
          )}

          {method === 'upload' && (
            <TransactionUpload
              compact
              onComplete={handleUploadComplete}
            />
          )}
        </div>

        {/* Upgrade nudge */}
        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Wil je briefings, een AI coach en budgetplanner?{' '}
            <a href="/upgrade" className="font-medium" style={{ color: 'var(--brand)' }}>
              Upgrade naar Pro →
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── PRO ONBOARDING ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden text-white" style={{ backgroundColor: 'var(--brand)' }}>
        <div className="px-6 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold">F</span>
            </div>
            <div>
              <p className="font-semibold">Welkom bij Fynn Pro</p>
              <p className="text-xs opacity-70">Jouw persoonlijke financiële coach</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= n ? 'bg-white text-green-900' : 'bg-white/20 text-white'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                {n < 3 && (
                  <div className="h-0.5 w-8 rounded-full transition-all"
                    style={{ backgroundColor: step > n ? 'white' : 'rgba(255,255,255,0.2)' }} />
                )}
              </div>
            ))}
          </div>

          {/* Stap 1 — bank koppelen */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 1 — Bankrekening koppelen</h2>
              <p className="text-sm opacity-80 mb-5">
                Kies hoe je wilt beginnen. Automatisch via Plaid of door je transacties te uploaden.
              </p>

              <MethodToggle method={method} onChange={setMethod} variant="dark" />

              <div className="mt-4">
                {method === 'plaid' && (
                  <div className="space-y-3">
                    <PlaidLinkButton
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all text-center"
                      style={{ backgroundColor: 'white', color: 'var(--brand)' }}
                    >
                      🏦 Bank koppelen
                    </PlaidLinkButton>
                    <p className="text-xs opacity-60 text-center">
                      🔒 Alleen leestoegang · Nooit schrijftoegang · Nooit toegang tot je geld
                    </p>
                  </div>
                )}

                {method === 'upload' && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <TransactionUpload
                      compact
                      onComplete={handleUploadComplete}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stap 2 — features */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 2 — Wat kan Fynn voor jou doen?</h2>
              <p className="text-sm opacity-80 mb-4">Ontdek wat er allemaal voor je klaarstaat.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PRO_FEATURES.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: activeFeature === i ? 'white' : 'rgba(255,255,255,0.15)',
                      color: activeFeature === i ? 'var(--brand)' : 'white',
                    }}
                  >
                    <p className="text-lg mb-1">{f.icon}</p>
                    <p className="text-xs font-semibold leading-tight">{f.title}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <p className="text-sm font-medium">{PRO_FEATURES[activeFeature].icon} {PRO_FEATURES[activeFeature].title}</p>
                <p className="text-xs opacity-80 mt-1">{PRO_FEATURES[activeFeature].desc}</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: 'white', color: 'var(--brand)' }}
              >
                Verder →
              </button>
            </div>
          )}

          {/* Stap 3 — activeren */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 3 — Klaar om te beginnen</h2>
              <p className="text-sm opacity-80 mb-5">
                Koppel je bank en Fynn doet de rest automatisch.
              </p>
              <div className="space-y-2 mb-5">
                {[
                  '✓ Transacties worden automatisch gecategoriseerd',
                  '✓ Je eerste briefing staat binnen enkele minuten klaar',
                  '✓ Coach is direct beschikbaar voor al je vragen',
                  '✓ Budget wordt gegenereerd op basis van jouw patroon',
                ].map((item, i) => (
                  <p key={i} className="text-sm opacity-90">{item}</p>
                ))}
              </div>

              <MethodToggle method={method} onChange={setMethod} variant="dark" />

              <div className="mt-4">
                {method === 'plaid' && (
                  <PlaidLinkButton
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all text-center"
                    style={{ backgroundColor: 'white', color: 'var(--brand)' }}
                  >
                    🏦 Bank koppelen
                  </PlaidLinkButton>
                )}

                {method === 'upload' && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <TransactionUpload
                      compact
                      onComplete={handleUploadComplete}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Skip naar features (stap 1 only) */}
        {step === 1 && (
          <div className="px-6 pb-4 flex justify-end">
            <button onClick={() => setStep(2)}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity">
              Eerst features bekijken →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}