// src/app/signup/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function SignupPage() {
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
  const supabase = createClient()

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
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Links — brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-96 p-10 text-white"
        style={{ backgroundColor: 'var(--brand, #1A3A2A)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="font-semibold">Fynn</span>
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug mb-4">
            Grip op je geld begint met inzicht.
          </p>
          <p className="text-sm opacity-60">
            Fynn analyseert je bankrekening en vertelt je precies wat je moet doen.
          </p>
        </div>
        <div className="space-y-3">
          {[
            '14 dagen gratis proberen',
            'Geen creditcard nodig',
            'Koppel je bank in 3 minuten',
          ].map(item => (
            <div key={item} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(74,222,128,0.2)' }}
              >
                <span style={{ color: '#4ADE80', fontSize: 9 }}>✓</span>
              </div>
              <p className="text-sm opacity-80">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rechts — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">

        {/* Theme toggle */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--brand, #1A3A2A)' }}
            >
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Fynn</span>
          </div>

          <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
            Start gratis
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            14 dagen gratis. Daarna €12,99/maand. Altijd opzegbaar.
          </p>

          <form onSubmit={handleSignup} className="space-y-3">

            {/* Naam */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Voornaam"
                value={voornaam}
                onChange={e => setVoornaam(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                style={inputStyle}
                required
              />
              <input
                type="text"
                placeholder="Achternaam"
                value={achternaam}
                onChange={e => setAchternaam(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
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
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
              style={inputStyle}
              required
            />

            {/* Wachtwoord */}
            <input
              type="password"
              placeholder="Wachtwoord (min. 8 tekens)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
              style={inputStyle}
              required
            />
            <input
              type="password"
              placeholder="Wachtwoord bevestigen"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
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
                  style={{ accentColor: 'var(--brand, #1A3A2A)' }}
                />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Ik ga akkoord met de{' '}
                  <a href="/voorwaarden" className="underline" style={{ color: 'var(--brand, #1A3A2A)' }}>
                    algemene voorwaarden
                  </a>{' '}
                  en het{' '}
                  <a href="/privacy" className="underline" style={{ color: 'var(--brand, #1A3A2A)' }}>
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
                  style={{ accentColor: 'var(--brand, #1A3A2A)' }}
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
              className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--brand, #1A3A2A)' }}
            >
              {loading ? 'Account aanmaken...' : 'Gratis starten →'}
            </button>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: 'var(--muted)' }}>
            Al een account?{' '}
            <a href="/login" className="font-medium" style={{ color: 'var(--brand, #1A3A2A)' }}>
              Inloggen
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}