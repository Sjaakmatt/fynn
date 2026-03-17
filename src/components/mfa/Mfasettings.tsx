// src/components/mfa/MFASettings.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import MFAEnroll from './Mfaenroll'

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
        className="rounded-2xl p-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--tab-bg)' }} />
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
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: hasMFA
                ? 'color-mix(in srgb, var(--brand) 10%, transparent)'
                : 'var(--tab-bg)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasMFA ? 'var(--brand)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="min-w-0">
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

        <div className="flex items-center gap-2 shrink-0 ml-13 sm:ml-0">
          {hasMFA ? (
            <>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(74,222,128,0.08)',
                  color: '#4ade80',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
                Actief
              </span>
              <button
                onClick={handleUnenroll}
                disabled={unenrolling}
                className="px-3 py-1.5 text-xs rounded-xl transition-opacity disabled:opacity-30"
                style={{ color: '#EF4444' }}
              >
                {unenrolling ? 'Bezig…' : 'Uitschakelen'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowEnroll(true)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              Inschakelen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
        </div>
      )}

      {success && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{ backgroundColor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}
        >
          <p className="text-xs" style={{ color: '#4ade80' }}>{success}</p>
        </div>
      )}
    </div>
  )
}