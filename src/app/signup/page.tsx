// src/app/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailNotConfirmed(false)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Supabase returns "Email not confirmed" when user hasn't verified
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setEmailNotConfirmed(true)
        setError('')
      } else {
        setError('E-mailadres of wachtwoord klopt niet.')
      }
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
            &ldquo;Ik wist niet waar mijn geld naartoe ging. Nu wel.&rdquo;
          </p>
          <p className="text-sm opacity-60">— Gebruiker uit Amsterdam</p>
        </div>
        <div className="space-y-3">
          {[
            'Bankrekening koppelen in 3 minuten',
            'AI analyseert al je uitgaven',
            'Elke week persoonlijke inzichten',
          ].map(item => (
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

          {/* ── Reset password sent ── */}
          {resetSent ? (
            <div className="text-center space-y-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                Check je inbox
              </h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                We hebben een link naar <span style={{ color: 'var(--text)' }}>{email}</span> gestuurd
                waarmee je je wachtwoord kunt resetten.
              </p>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
                className="text-sm font-semibold"
                style={{ color: 'var(--brand)' }}
              >
                Terug naar inloggen
              </button>
            </div>
          ) : resetMode ? (
            <>
              <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Wachtwoord vergeten?
              </h1>
              <p className="text-xs mb-8" style={{ color: 'var(--muted)' }}>
                Vul je e-mailadres in en we sturen je een resetlink.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-3">
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                />

                {error && (
                  <p className="text-xs px-1" style={{ color: '#EF4444' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  {loading ? 'Versturen…' : 'Resetlink versturen'}
                </button>
              </form>

              <p className="text-xs text-center mt-6" style={{ color: 'var(--muted)' }}>
                <button
                  onClick={() => { setResetMode(false); setError('') }}
                  className="font-semibold"
                  style={{ color: 'var(--brand)' }}
                >
                  Terug naar inloggen
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Welkom terug
              </h1>
              <p className="text-xs mb-8" style={{ color: 'var(--muted)' }}>
                Log in om je financieel overzicht te bekijken.
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
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
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                />

                {error && (
                  <p className="text-xs px-1" style={{ color: '#EF4444' }}>{error}</p>
                )}

                {/* Email not confirmed banner */}
                {emailNotConfirmed && (
                  <div
                    className="rounded-xl p-4 space-y-2"
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                      E-mailadres nog niet bevestigd
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                      We hebben een bevestigingslink gestuurd naar <span className="font-semibold" style={{ color: 'var(--text)' }}>{email}</span>. 
                      Klik op de link in de e-mail om je account te activeren.
                    </p>
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(email)}`}
                      className="inline-block text-xs font-semibold mt-1"
                      style={{ color: 'var(--brand)' }}
                    >
                      Verificatie-e-mail opnieuw versturen →
                    </Link>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setError(''); setEmailNotConfirmed(false) }}
                    className="text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    Wachtwoord vergeten?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  {loading ? 'Inloggen…' : 'Inloggen'}
                </button>
              </form>

              <p className="text-xs text-center mt-6" style={{ color: 'var(--muted)' }}>
                Nog geen account?{' '}
                <a href="/signup" className="font-semibold" style={{ color: 'var(--brand)' }}>
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