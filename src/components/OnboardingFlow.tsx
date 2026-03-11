'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PlaidLinkButton from '@/components/plaid/PlaidLinkButton'

const BANKING_PROVIDER = process.env.NEXT_PUBLIC_BANKING_PROVIDER ?? 'plaid'

interface Props {
  userId: string
  isPro: boolean
}

const BANKS = [
  { name: 'Rabobank', country: 'NL', logo: '🏦' },
  { name: 'ING', country: 'NL', logo: '🏦' },
  { name: 'ABN AMRO', country: 'NL', logo: '🏦' },
  { name: 'SNS Bank', country: 'NL', logo: '🏦' },
  { name: 'Bunq', country: 'NL', logo: '🏦' },
  { name: 'Triodos Bank', country: 'NL', logo: '🏦' },
  { name: 'KBC', country: 'BE', logo: '🏦' },
  { name: 'BNP Paribas Fortis', country: 'BE', logo: '🏦' },
  { name: 'Belfius', country: 'BE', logo: '🏦' },
  { name: 'ING', country: 'BE', logo: '🏦' },
  { name: 'Handelsbanken', country: 'NL' },
  { name: 'Mock ASPSP', country: 'NL' },
]

const PRO_FEATURES = [
  { icon: '📬', title: 'Wekelijkse briefing', desc: 'Elke maandag een persoonlijk financieel overzicht' },
  { icon: '💬', title: 'Coach op elk moment', desc: 'Stel Fynn alles — "Kan ik me dit veroorloven?"' },
  { icon: '🎯', title: 'Persoonlijk budget', desc: 'AI genereert een budget op basis van jouw uitgaven' },
  { icon: '⚡', title: 'Uitgave check', desc: 'Real-time check voordat je iets koopt' },
  { icon: '📱', title: 'Abonnementenbeheer', desc: 'Zie precies wat je maandelijks betaalt' },
  { icon: '📡', title: 'Cashflow radar', desc: 'Voorspelling van je financiën de komende weken' },
]

function BankSelector({ onSelect }: { onSelect: (bank: typeof BANKS[0]) => void }) {
  const [selected, setSelected] = useState<typeof BANKS[0] | null>(null)
  const [filter, setFilter] = useState<'NL' | 'BE'>('NL')

  const filtered = BANKS.filter(b => b.country === filter)

  if (BANKING_PROVIDER === 'plaid') {
    return (
      <PlaidLinkButton
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ backgroundColor: 'white', color: 'var(--brand)' }}
      >
        🏦 Bank koppelen
      </PlaidLinkButton>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
        {(['NL', 'BE'] as const).map(country => (
          <button
            key={country}
            onClick={() => { setFilter(country); setSelected(null) }}
            className="flex-1 py-2 text-sm font-medium transition-all"
            style={{
              backgroundColor: filter === country ? 'white' : 'transparent',
              color: filter === country ? 'var(--brand)' : 'rgba(255,255,255,0.8)',
            }}
          >
            {country === 'NL' ? '🇳🇱 Nederland' : '🇧🇪 België'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map(bank => (
          <button
            key={`${bank.name}-${bank.country}`}
            onClick={() => setSelected(bank)}
            className="p-3 rounded-xl text-left text-sm font-medium transition-all"
            style={{
              backgroundColor: selected?.name === bank.name ? 'white' : 'rgba(255,255,255,0.15)',
              color: selected?.name === bank.name ? 'var(--brand)' : 'white',
            }}
          >
            {bank.logo} {bank.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
        style={{ backgroundColor: 'white', color: 'var(--brand)' }}
      >
        {selected ? `🏦 Verbinden met ${selected.name}` : 'Selecteer je bank'}
      </button>
    </div>
  )
}

export default function OnboardingFlow({ userId, isPro }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  // Na bank connect: refresh server data en verwijder param uit URL
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      router.replace('/dashboard') // verwijder ?connected=true
      router.refresh()             // forceert server component re-fetch
    }
  }, [searchParams, router])
  function handleConnect(bank?: typeof BANKS[0]) {
    setLoading(true)
    const selectedBank = bank ?? { name: 'Rabobank', country: 'NL' }
    // GET redirect — geen fetch nodig, gewoon navigeren
    window.location.href = `/api/enablebanking/connect?bank=${encodeURIComponent(selectedBank.name)}&country=${selectedBank.country}`
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
            { n: 1, title: 'Bankrekening koppelen', desc: 'Veilig via PSD2 — alleen leestoegang' },
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
        <div className="px-6 pb-6 space-y-3">
          {BANKING_PROVIDER === 'plaid' ? (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Koppel je bank</p>
              <PlaidLinkButton
                className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--brand)', color: 'white' }}
              >
                🏦 Bank koppelen
              </PlaidLinkButton>
            </>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Selecteer je bank</p>
              <div className="grid grid-cols-2 gap-2">
                {BANKS.filter(b => b.country === 'NL').map(bank => (
                  <button
                    key={bank.name}
                    onClick={() => handleConnect(bank)}
                    disabled={loading}
                    className="py-2 px-3 rounded-xl text-sm font-medium text-left disabled:opacity-50 transition-all"
                    style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    {bank.logo} {bank.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
            🔒 PSD2 beveiligd · Alleen leestoegang · Nooit schrijftoegang
          </p>
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

          {/* Stap 1 — bank selectie */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 1 — Bankrekening koppelen</h2>
              <p className="text-sm opacity-80 mb-5">
                Selecteer je bank. Fynn verbindt via PSD2 — veilig en alleen leestoegang.
              </p>
              {loading ? (
                <div className="text-center py-4 opacity-80 text-sm">Verbinden met je bank...</div>
              ) : (
                <BankSelector onSelect={handleConnect} />
              )}
              <p className="text-xs opacity-60 text-center mt-3">
                🔒 Alleen leestoegang · Nooit schrijftoegang · Nooit toegang tot je geld
              </p>
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
                Selecteer je bank en Fynn doet de rest automatisch.
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
              {loading ? (
                <div className="text-center py-4 opacity-80 text-sm">Verbinden met je bank...</div>
              ) : (
                <BankSelector onSelect={handleConnect} />
              )}
            </div>
          )}
        </div>

        {/* Skip naar features (stap 1 only) */}
        {step === 1 && !loading && (
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