// src/app/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mailadres of wachtwoord klopt niet.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Vul je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setLoading(false)
    } else {
      setResetSent(true)
      setLoading(false)
    }
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
            "Ik wist niet waar mijn geld naartoe ging. Nu wel."
          </p>
          <p className="text-sm opacity-60">— Gebruiker uit Amsterdam</p>
        </div>
        <div className="space-y-3">
          {[
            'Bankrekening koppelen in 3 minuten',
            'AI analyseert al je uitgaven',
            'Elke week een persoonlijk advies',
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

          {/* ── Reset password sent ── */}
          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Check je inbox
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                We hebben een link naar <strong style={{ color: 'var(--text)' }}>{email}</strong> gestuurd
                waarmee je je wachtwoord kunt resetten.
              </p>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
                className="text-sm font-medium"
                style={{ color: 'var(--brand, #1A3A2A)' }}
              >
                Terug naar inloggen
              </button>
            </div>
          ) : resetMode ? (
            <>
              <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Wachtwoord vergeten?
              </h1>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                Vul je e-mailadres in en we sturen je een resetlink.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-3">
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                />

                {error && (
                  <p className="text-sm px-1" style={{ color: '#EF4444' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--brand, #1A3A2A)' }}
                >
                  {loading ? 'Versturen...' : 'Resetlink versturen'}
                </button>
              </form>

              <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
                <button
                  onClick={() => { setResetMode(false); setError('') }}
                  className="font-medium"
                  style={{ color: 'var(--brand, #1A3A2A)' }}
                >
                  Terug naar inloggen
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Welkom terug
              </h1>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                Log in om je financieel overzicht te bekijken.
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                />
                <input
                  type="password"
                  placeholder="Wachtwoord"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                />

                {error && (
                  <p className="text-sm px-1" style={{ color: '#EF4444' }}>{error}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setError('') }}
                    className="text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    Wachtwoord vergeten?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--brand, #1A3A2A)' }}
                >
                  {loading ? 'Inloggen...' : 'Inloggen'}
                </button>
              </form>

              <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
                Nog geen account?{' '}
                <a href="/signup" className="font-medium" style={{ color: 'var(--brand, #1A3A2A)' }}>
                  Gratis aanmelden
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}