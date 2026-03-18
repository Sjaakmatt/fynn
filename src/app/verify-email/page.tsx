// src/app/verify-email/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleResend() {
    if (!emailParam || countdown > 0) return
    setResending(true)
    setError('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailParam,
    })

    if (error) {
      setError('Kon de e-mail niet opnieuw versturen. Probeer het later nog eens.')
    } else {
      setResent(true)
      setCountdown(60)
    }
    setResending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm text-center">

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>
          Check je inbox
        </h1>

        <p className="text-sm mb-6" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          We hebben een bevestigingslink gestuurd naar
          {emailParam ? (
            <> <span className="font-semibold" style={{ color: 'var(--text)' }}>{emailParam}</span></>
          ) : (
            <> je e-mailadres</>
          )}
          . Klik op de link om je account te activeren.
        </p>

        {/* Tips */}
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{ backgroundColor: 'var(--tab-bg)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Geen e-mail ontvangen?
          </p>
          <ul className="space-y-1.5">
            {[
              'Check je spam of ongewenste e-mail map',
              'Controleer of je het juiste e-mailadres hebt gebruikt',
              'Wacht een paar minuten — het kan even duren',
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2">
                <span className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>•</span>
                <span className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Resend button */}
        {emailParam && (
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: 'var(--tab-bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {resending
              ? 'Versturen…'
              : countdown > 0
                ? `Opnieuw versturen (${countdown}s)`
                : resent
                  ? 'Nogmaals versturen'
                  : 'Verificatie-e-mail opnieuw versturen'}
          </button>
        )}

        {resent && !error && (
          <p className="text-xs mt-3" style={{ color: '#4ade80' }}>
            E-mail opnieuw verstuurd. Check je inbox.
          </p>
        )}

        {error && (
          <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{error}</p>
        )}

        {/* Back to login */}
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Al bevestigd?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'var(--brand)' }}>
              Inloggen
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}