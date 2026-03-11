// src/components/mfa/MFAEnroll.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

interface MFAEnrollProps {
  onComplete: () => void
  onCancel: () => void
}

export default function MFAEnroll({ onComplete, onCancel }: MFAEnrollProps) {
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      // 1) Ruim ALLE unverified factors op vóór enrollment
      await cleanupUnverifiedFactors()

      // 2) Enroll nieuwe factor
      const res = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Fynn ${Date.now()}`,
      })

      if (res.error) {
        setError(res.error.message)
        return
      }

      setQr(res.data.totp.qr_code)
      setSecret(res.data.totp.secret)
      setFactorId(res.data.id)
    })()
  }, [])

  async function cleanupUnverifiedFactors() {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    if (!factors) return

    const all = [...(factors.totp ?? []), ...(factors.phone ?? [])]
    for (const f of all) {
      if ((f.status as string) !== 'verified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
      }
    }
  }

  async function handleVerify() {
    setError('')
    setLoading(true)

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode,
      })
      if (verifyError) {
        setError('Ongeldige code. Probeer opnieuw.')
        setLoading(false)
        return
      }

      onComplete()
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
      setLoading(false)
    }
  }

  async function handleCancel() {
    // Ruim de net-aangemaakte unverified factor op
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
    }
    onCancel()
  }

  return (
    <div className="max-w-md mx-auto">
      <div
        className="rounded-2xl border p-6 transition-colors"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--tab-bg)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Tweestapsverificatie instellen
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Beveilig je account met een authenticator app
            </p>
          </div>
        </div>

        {/* Step 1: QR Code */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text)' }}>Stap 1:</span>{' '}
              Scan de QR-code met je authenticator app (bijv. Google Authenticator, Authy of 1Password).
            </p>
            {qr ? (
              <div className="flex justify-center">
                <div
                  className="p-3 rounded-lg border"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--border)' }}
                >
                  <img
                    src={qr}
                    alt="QR Code voor MFA"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-48 h-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--tab-bg)' }} />
              </div>
            )}

            {/* Manual secret fallback */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-xs underline"
                style={{ color: 'var(--muted)' }}
              >
                Kan je niet scannen? Voer de code handmatig in
              </button>
              {showSecret && secret && (
                <div
                  className="mt-2 border rounded-lg p-2"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <code className="text-xs break-all select-all" style={{ color: 'var(--text)' }}>
                    {secret}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Verify */}
          <div>
            <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text)' }}>Stap 2:</span>{' '}
              Voer de 6-cijferige code in uit je authenticator app.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setVerifyCode(val)
              }}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#1A3A2A]/20"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
              style={{
                backgroundColor: 'var(--tab-bg)',
                color: 'var(--text)',
              }}
            >
              Annuleren
            </button>
            <button
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#1A3A2A' }}
            >
              {loading ? 'Verifiëren...' : 'Activeren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}