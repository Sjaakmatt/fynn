// src/components/mfa/MFASettings.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import MFAEnroll from './Mfaenroll'

/**
 * MFA instellingen component voor het dashboard/settings.
 * Toont of MFA aan/uit staat en biedt enrollment/unenroll flow.
 */
export default function MFASettings() {
  const [hasMFA, setHasMFA] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [showEnroll, setShowEnroll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unenrolling, setUnenrolling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    checkMFAStatus()
  }, [])

  async function checkMFAStatus() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setLoading(false)
      return
    }

    const verifiedFactor = data.totp.find(f => f.status === 'verified')
    if (verifiedFactor) {
      setHasMFA(true)
      setFactorId(verifiedFactor.id)
    } else {
      setHasMFA(false)
      setFactorId(null)
    }
    setLoading(false)
  }

  async function handleUnenroll() {
    if (!factorId) return
    setError('')
    setUnenrolling(true)

    // Verwijder ALLE factors (verified + unverified)
    const { data: factors } = await supabase.auth.mfa.listFactors()
    if (factors) {
      const all = [...(factors.totp ?? []), ...(factors.phone ?? [])]
      for (const f of all) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
      }
    }

    setHasMFA(false)
    setFactorId(null)
    setSuccess('Tweestapsverificatie is uitgeschakeld.')
    setUnenrolling(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  function handleEnrollComplete() {
    setShowEnroll(false)
    setHasMFA(true)
    setSuccess('Tweestapsverificatie is ingeschakeld!')
    checkMFAStatus()
    setTimeout(() => setSuccess(''), 3000)
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-6 transition-colors"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg)' }} />
      </div>
    )
  }

  if (showEnroll) {
    return (
      <MFAEnroll
        onComplete={handleEnrollComplete}
        onCancel={() => setShowEnroll(false)}
      />
    )
  }

  return (
    <div
      className="rounded-2xl border p-5 transition-colors"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: hasMFA ? '#E8F5E9' : 'var(--tab-bg)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasMFA ? '#1A3A2A' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Tweestapsverificatie (2FA)
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {hasMFA
                ? 'Actief — je account is extra beveiligd'
                : 'Niet actief — voeg een extra beveiligingslaag toe'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMFA ? (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Actief
              </span>
              <button
                onClick={handleUnenroll}
                disabled={unenrolling}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                {unenrolling ? 'Bezig...' : 'Uitschakelen'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowEnroll(true)}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors hover:opacity-90"
              style={{ backgroundColor: '#1A3A2A' }}
            >
              Inschakelen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
    </div>
  )
}