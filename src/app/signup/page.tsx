// src/app/signup/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

function SignupForm() {
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [tos, setTos] = useState(false)
  const [marketing, setMarketing] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const isBeta = searchParams.get('ref') === 'beta'

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('Wachtwoorden komen niet overeen.')
      return
    }
    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens zijn.')
      return
    }
    if (!tos) {
      setError('Je moet akkoord gaan met de voorwaarden.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${voornaam} ${achternaam}`.trim(),
          marketing_opt_in: marketing,
          is_beta: isBeta,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--tab-bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Links — brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-96 p-10 text-white"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">F</span>
          </div>
          <span className="font-semibold">Fynn</span>
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug mb-4">
            {isBeta
              ? 'Welkom bij de Fynn bèta.'
              : 'Grip op je geld begint met inzicht.'}
          </p>
          <p className="text-sm opacity-60">
            {isBeta
              ? '3 maanden gratis. Daarna €4,99/maand — voor altijd.'
              : 'Fynn analyseert je bankrekening en vertelt je precies wat je moet doen.'}
          </p>
        </div>
        <div className="space-y-3">
          {(isBeta
            ? [
                '3 maanden gratis testen',
                'Daarna €4,99/maand — voor altijd',
                'Directe lijn met de founder',
              ]
            : [
                '14 dagen gratis proberen',
                'Geen creditcard nodig',
                'Koppel je bank in 3 minuten',
              ]
          ).map(item => (
            <div key={item} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(74,222,128,0.2)' }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm opacity-80">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rechts — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">

        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              <span className="text-white text-xs font-semibold">F</span>
            </div>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Fynn</span>
          </div>

          {/* Beta badge */}
          {isBeta && (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                Bèta toegang
              </span>
            </div>
          )}

          <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {isBeta ? 'Claim je bèta plek' : 'Start gratis'}
          </h1>
          <p className="text-xs mb-8" style={{ color: 'var(--muted)' }}>
            {isBeta
              ? '3 maanden gratis. Daarna €4,99/maand — voor altijd.'
              : '14 dagen gratis. Daarna €12,99/maand. Altijd opzegbaar.'}
          </p>

          <form onSubmit={handleSignup} className="space-y-3">

            {/* Naam */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Voornaam"
                value={voornaam}
                onChange={e => setVoornaam(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
                required
              />
              <input
                type="text"
                placeholder="Achternaam"
                value={achternaam}
                onChange={e => setAchternaam(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
                required
              />
            </div>

            {/* Email */}
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
              required
            />

            {/* Wachtwoord */}
            <input
              type="password"
              placeholder="Wachtwoord (min. 8 tekens)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
              required
            />
            <input
              type="password"
              placeholder="Wachtwoord bevestigen"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                ...inputStyle,
                borderColor: passwordConfirm && password !== passwordConfirm
                  ? '#EF4444'
                  : 'var(--border)',
              }}
              required
            />

            {/* Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tos}
                  onChange={e => setTos(e.target.checked)}
                  className="mt-0.5 rounded"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Ik ga akkoord met de{' '}
                  <a href="/voorwaarden" className="underline" style={{ color: 'var(--brand)' }}>
                    algemene voorwaarden
                  </a>{' '}
                  en het{' '}
                  <a href="/privacy" className="underline" style={{ color: 'var(--brand)' }}>
                    privacybeleid
                  </a>
                  . *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={e => setMarketing(e.target.checked)}
                  className="mt-0.5 rounded"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Stuur mij wekelijkse financiële tips en productnieuws. Je kunt je altijd afmelden.
                </span>
              </label>
            </div>

            {error && (
              <p className="text-xs px-1" style={{ color: '#EF4444' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-30 transition-opacity"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {loading
                ? 'Account aanmaken…'
                : isBeta
                  ? 'Bèta plek claimen'
                  : 'Gratis starten'}
            </button>
          </form>

          <p className="text-xs text-center mt-5" style={{ color: 'var(--muted)' }}>
            Al een account?{' '}
            <a href="/login" className="font-semibold" style={{ color: 'var(--brand)' }}>
              Inloggen
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}