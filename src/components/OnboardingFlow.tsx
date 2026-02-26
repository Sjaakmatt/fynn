'use client'

import { useState } from 'react'

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

export default function OnboardingFlow({ userId, isPro }: Props) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  async function handleConnect() {
    setLoading(true)
    try {
      const response = await fetch('/api/tink/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error(error)
      setLoading(false)
    }
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
            { n: 1, title: 'Bankrekening koppelen', desc: 'Veilig via PSD2 — alleen leestoegang', done: false },
            { n: 2, title: 'Automatische analyse', desc: 'Fynn categoriseert al je transacties', done: false },
            { n: 3, title: 'Inzicht in je financiën', desc: 'Zie direct waar je geld naartoe gaat', done: false },
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

        {/* CTA */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 rounded-xl font-medium text-sm text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {loading ? 'Laden...' : '🏦 Bankrekening koppelen'}
          </button>
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

      {/* Welkom card */}
      <div className="rounded-2xl overflow-hidden text-white"
        style={{ backgroundColor: 'var(--brand)' }}>
        <div className="px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold">F</span>
            </div>
            <div>
              <p className="font-semibold">Welkom bij Fynn Pro</p>
              <p className="text-xs opacity-70">Jouw persoonlijke financiële coach</p>
            </div>
          </div>

          {/* Progress steps */}
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

          {/* Step content */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 1 — Bankrekening koppelen</h2>
              <p className="text-sm opacity-80 mb-6">
                Fynn heeft toegang nodig tot je transacties om je te kunnen coachen. 
                Dit werkt via PSD2 — de Europese bankstandaard. Veilig en read-only.
              </p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                style={{ backgroundColor: 'white', color: 'var(--brand)' }}
              >
                {loading ? 'Verbinden...' : '🏦 Bankrekening koppelen'}
              </button>
              <p className="text-xs opacity-60 text-center mt-3">
                🔒 Alleen leestoegang · Nooit schrijftoegang · Nooit toegang tot je geld
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 2 — Wat kan Fynn voor jou doen?</h2>
              <p className="text-sm opacity-80 mb-4">
                Ontdek wat er allemaal voor je klaarstaat.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6">
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
              {/* Feature detail */}
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

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Stap 3 — Klaar om te beginnen</h2>
              <p className="text-sm opacity-80 mb-6">
                Zodra je bankrekening gekoppeld is, analyseert Fynn automatisch al je transacties 
                en staat alles voor je klaar.
              </p>
              <div className="space-y-2 mb-6">
                {[
                  '✓ Transacties worden automatisch gecategoriseerd',
                  '✓ Je eerste briefing staat binnen enkele minuten klaar',
                  '✓ Coach is direct beschikbaar voor al je vragen',
                  '✓ Budget wordt gegenereerd op basis van jouw patroon',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm opacity-90">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: 'white', color: 'var(--brand)' }}
              >
                {loading ? 'Verbinden...' : '🚀 Fynn activeren'}
              </button>
            </div>
          )}
        </div>

        {/* Step navigation voor stap 1 */}
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