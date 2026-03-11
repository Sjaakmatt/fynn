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

      // Gebruik de eerste verified TOTP factor
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F7F5F2' }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: '#E8F5E9' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A3A2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Verificatie vereist
            </h2>
            <p className="text-sm text-gray-500 mt-1">
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
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3A2A]/20 focus:border-[#1A3A2A] mb-4"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={verifyCode.length !== 6 || loading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#1A3A2A' }}
          >
            {loading ? 'Verifiëren...' : 'Verifiëren'}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full mt-2 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Uitloggen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}