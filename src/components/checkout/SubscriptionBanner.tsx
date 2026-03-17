// src/components/checkout/SubscriptionBanner.tsx
'use client'

import { useState } from 'react'
import CheckoutModal from './CheckoutModal'

interface Props {
  status: string | null
  trialEndsAt: string | null
  isBeta?: boolean
}

export default function SubscriptionBanner({ status, trialEndsAt, isBeta = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoading(false)
  }

  // Actief betaald abonnement — geen banner
  if (status === 'active') return null

  // Trial actief
  if (status === 'trialing' && trialEndsAt) {
    const daysLeft = Math.ceil(
      (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return (
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {isBeta ? '🧪' : '✨'} Gratis trial — nog {daysLeft} dag{daysLeft !== 1 ? 'en' : ''}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {isBeta
              ? 'Daarna €4,99/maand — voor altijd. Altijd opzegbaar.'
              : 'Daarna €12,99/maand. Altijd opzegbaar.'}
          </p>
        </div>
        <button
          onClick={openPortal}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg font-medium"
          style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}
        >
          {loading ? '...' : 'Beheer'}
        </button>
      </div>
    )
  }

  // Past due
  if (status === 'past_due') {
    return (
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: '#EF4444' }}>
            ⚠️ Betaling mislukt
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Werk je betaalgegevens bij om toegang te behouden.
          </p>
        </div>
        <button
          onClick={openPortal}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg font-medium text-white"
          style={{ backgroundColor: '#EF4444' }}
        >
          {loading ? '...' : 'Bijwerken'}
        </button>
      </div>
    )
  }

  // Free / geen abonnement — modal
  return (
    <>
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {isBeta
              ? 'Fynn Bèta — €4,99/maand'
              : 'Fynn Pro — €12,99/maand'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {isBeta
              ? '3 maanden gratis. Daarna €4,99 — voor altijd.'
              : '14 dagen gratis proberen. Geen creditcard nodig.'}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="text-xs px-4 py-2 rounded-lg font-medium text-white"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          {isBeta ? 'Activeer bèta →' : 'Start gratis →'}
        </button>
      </div>

      <CheckoutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}