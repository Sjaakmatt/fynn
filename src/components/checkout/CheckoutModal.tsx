// src/components/checkout/CheckoutModal.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  isOpen: boolean
  onClose: () => void
}

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function CheckoutModal({ isOpen, onClose }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentType, setIntentType] = useState<'payment_intent' | 'setup_intent'>('setup_intent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const isDark = useIsDark()

  // Escape handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    setClientSecret(null)

    fetch('/api/stripe/create-payment-intent', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setClientSecret(data.clientSecret)
          setIntentType(data.intentType)
          setSubscriptionId(data.subscriptionId)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Er ging iets mis. Probeer opnieuw.')
        setLoading(false)
      })
  }, [isOpen])

  if (!isOpen) return null

  // Stripe Elements verwacht hex kleuren, geen CSS variables
  const stripeAppearance = {
    theme: 'flat' as const,
    variables: {
      colorPrimary: '#1A3A2A',
      colorBackground: isDark ? '#1A1A1A' : '#FFFFFF',
      colorText: isDark ? '#F9FAFB' : '#111827',
      colorTextSecondary: isDark ? '#6B7280' : '#9CA3AF',
      colorDanger: '#EF4444',
      fontFamily: 'Sora, sans-serif',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        backgroundColor: isDark ? '#252525' : '#FFFFFF',
        borderColor: isDark ? '#2A2A2A' : '#E5E7EB',
        color: isDark ? '#F9FAFB' : '#111827',
      },
      '.Input:focus': {
        borderColor: '#1A3A2A',
        boxShadow: '0 0 0 1px #1A3A2A',
      },
      '.Tab': {
        backgroundColor: isDark ? '#252525' : '#F0EDE8',
        borderColor: isDark ? '#2A2A2A' : '#E5E7EB',
        color: isDark ? '#9CA3AF' : '#6B7280',
      },
      '.Tab--selected': {
        backgroundColor: isDark ? '#2D2D2D' : '#FFFFFF',
        borderColor: '#1A3A2A',
        color: isDark ? '#F9FAFB' : '#111827',
      },
      '.Label': {
        color: isDark ? '#9CA3AF' : '#6B7280',
      },
    },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Start Fynn Pro
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              14 dagen gratis · daarna €12,99/maand
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
            style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>

        {/* Wat je krijgt */}
        <div
          className="rounded-2xl p-4 mb-5 space-y-2"
          style={{ backgroundColor: 'var(--tab-bg)' }}
        >
          {[
            '✓ Automatische bankrekening koppeling',
            '✓ Wekelijkse persoonlijke briefing',
            '✓ AI Coach — stel alles wat je wil',
            '✓ Cashflow Radar & signalen',
            '✓ Budget planner & gezondheidscore',
          ].map(item => (
            <p key={item} className="text-xs" style={{ color: 'var(--text)' }}>{item}</p>
          ))}
        </div>

        {/* Stripe form */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }}
            />
          </div>
        )}

        {error && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
          >
            {error}
          </div>
        )}

        {clientSecret && !loading && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: stripeAppearance,
            }}
          >
            <PaymentForm
              intentType={intentType}
              subscriptionId={subscriptionId}
              onSuccess={onClose}
            />
          </Elements>
        )}

        {/* Trust */}
        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          🔒 Beveiligd via Stripe · Altijd opzegbaar
        </p>
      </div>
    </div>
  )
}

function PaymentForm({
  intentType,
  subscriptionId,
  onSuccess,
}: {
  intentType: 'payment_intent' | 'setup_intent'
  subscriptionId: string | null
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const returnUrl = `${window.location.origin}/dashboard?success=true`

    const result = intentType === 'setup_intent'
      ? await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        })
      : await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        })

    if (result.error) {
      setError(result.error.message ?? 'Betaling mislukt. Probeer opnieuw.')
      setSubmitting(false)
      return
    }

    // Direct status updaten — niet wachten op webhook
    if (subscriptionId) {
      await fetch('/api/stripe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })
    }

    setSuccess(true)
    setSubmitting(false)
    setTimeout(() => {
      window.location.href = '/dashboard?success=true'
    }, 1500)
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">🎉</div>
        <p className="font-semibold" style={{ color: 'var(--text)' }}>
          Welkom bij Fynn Pro!
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Je trial is gestart. Je wordt doorgestuurd...
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['ideal', 'card'],
        }}
      />

      {error && (
        <p className="text-sm px-1" style={{ color: '#EF4444' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 rounded-2xl font-semibold text-sm text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {submitting ? 'Verwerken...' : 'Start 14 dagen gratis →'}
      </button>
    </form>
  )
}