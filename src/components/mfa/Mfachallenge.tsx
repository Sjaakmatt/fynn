// src/components/mfa/MFAChallenge.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface MFAChallengeProps {
  onSuccess: () => void
  onCancel?: () => void
}

export default function MFAChallenge({ onSuccess, onCancel }: MFAChallengeProps) {
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleVerify() {
    setError('')
    setLoading(true)

    try {
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors()
      if (factorsError) {
        setError(factorsError.message)
        setLoading(false)
        return
      }

      const totpFactor = factors.totp.find(f => f.status === 'verified')
      if (!totpFactor) {
        setError('Geen actieve MFA factor gevonden.')
        setLoading(false)
        return
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challengeError) {
        setError(challengeError.message)
        setLoading(false)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: verifyCode,
      })
      if (verifyError) {
        setError('Ongeldige code. Probeer opnieuw.')
        setVerifyCode('')
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && verifyCode.length === 6) {
      handleVerify()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Verificatie vereist
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Voer de code in uit je authenticator app
            </p>
          </div>

          {/* Code input */}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={verifyCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setVerifyCode(val)
            }}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-xl outline-none mb-4"
            style={{
              backgroundColor: 'var(--tab-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />

          {error && (
            <div
              className="rounded-xl p-3 mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={verifyCode.length !== 6 || loading}
            className="w-full py-3.5 text-sm font-semibold text-white rounded-xl transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {loading ? 'Verifiëren…' : 'Verifiëren'}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full mt-2 py-3 text-sm rounded-xl transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              Uitloggen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}