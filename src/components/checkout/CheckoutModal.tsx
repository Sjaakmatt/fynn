// src/components/checkout/CheckoutModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { createClient } from '@/lib/supabase/client'

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
  const [mounted, setMounted] = useState(false)
  const [isBeta, setIsBeta] = useState(false)
  const isDark = useIsDark()

  useEffect(() => { setMounted(true) }, [])

  // Fetch beta status
  useEffect(() => {
    if (!isOpen) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('is_beta')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_beta) setIsBeta(true)
        })
    })
  }, [isOpen])

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Fetch payment intent
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

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ backgroundColor: 'var(--bg)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle — mobiel only */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              {isBeta ? 'Bèta' : 'Upgrade'}
            </p>
            <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text)' }}>
              {isBeta ? 'Activeer je bèta plek' : 'Start Fynn Pro'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--brand)' }}>
              {isBeta
                ? '3 maanden gratis · daarna €4,99/maand — voor altijd'
                : '14 dagen gratis · daarna €12,99/maand'}
            </p>
          </div>
          <button onClick={onClose} className="mt-1 text-lg leading-none" style={{ color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">

            {/* Beta badge */}
            {isBeta && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  backgroundColor: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#F59E0B' }} />
                <p className="text-xs" style={{ color: '#F59E0B' }}>
                  Bèta deal — na de gratis periode betaal je voor altijd €4,99/maand i.p.v. €12,99
                </p>
              </div>
            )}

            {/* Wat je krijgt */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <div className="space-y-2">
                {[
                  'Automatische bankrekening koppeling',
                  'Wekelijkse persoonlijke briefing',
                  'AI Coach — stel alles wat je wil',
                  'Cashflow Radar & signalen',
                  'Budget planner & gezondheidscore',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--brand)' }}>✓</span>
                    <p className="text-xs" style={{ color: 'var(--text)' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stripe form */}
            {loading && (
              <div className="py-10 text-center">
                <div
                  className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
                  style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
                />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
              </div>
            )}

            {error && (
              <p className="text-xs rounded-xl p-3"
                style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                {error}
              </p>
            )}

            {clientSecret && !loading && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'flat',
                    variables: {
                      colorPrimary: '#1A3A2A',
                      colorBackground: isDark ? '#1A1A1A' : '#FFFFFF',
                      colorText: isDark ? '#F9FAFB' : '#111827',
                      colorTextSecondary: isDark ? '#6B7280' : '#9CA3AF',
                      colorDanger: '#EF4444',
                      fontFamily: 'Sora, sans-serif',
                      borderRadius: '12px',
                    },
                  },
                }}
              >
                <CardForm
                  intentType={intentType}
                  clientSecret={clientSecret}
                  subscriptionId={subscriptionId}
                  isBeta={isBeta}
                  isDark={isDark}
                />
              </Elements>
            )}

            {/* Trust */}
            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
              🔒 Beveiligd via Stripe · Altijd opzegbaar
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Card Form ───────────────────────────────────────────────────

function CardForm({
  intentType,
  clientSecret,
  subscriptionId,
  isBeta,
  isDark,
}: {
  intentType: 'payment_intent' | 'setup_intent'
  clientSecret: string
  subscriptionId: string | null
  isBeta: boolean
  isDark: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cardReady, setCardReady] = useState(false)

  async function handleSubmit() {
    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Kaartformulier niet geladen. Ververs de pagina.')
      return
    }

    setSubmitting(true)
    setError(null)

    let result

    if (intentType === 'setup_intent') {
      result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      })
    } else {
      result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })
    }

    if (result.error) {
      setError(result.error.message ?? 'Betaling mislukt. Probeer opnieuw.')
      setSubmitting(false)
      return
    }

    // Bevestig subscription in backend
    if (subscriptionId) {
      try {
        await fetch('/api/stripe/confirm-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId }),
        })
      } catch {
        // Non-blocking — webhook vangt het ook op
      }
    }

    setSuccess(true)
    setSubmitting(false)
    setTimeout(() => {
      window.location.href = '/dashboard?success=true'
    }, 1500)
  }

  if (success) {
    return (
      <div className="py-12 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
        >
          <span className="text-xl" style={{ color: 'var(--brand)' }}>✓</span>
        </div>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>
          {isBeta ? 'Welkom bij de Fynn bèta!' : 'Welkom bij Fynn Pro!'}
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {isBeta
            ? 'Je 3 maanden gratis trial is gestart. Je wordt doorgestuurd...'
            : 'Je trial is gestart. Je wordt doorgestuurd...'}
        </p>
      </div>
    )
  }

  const cardStyle = {
    base: {
      fontSize: '15px',
      fontFamily: 'Sora, system-ui, sans-serif',
      color: isDark ? '#F9FAFB' : '#111827',
      '::placeholder': { color: isDark ? '#6B7280' : '#9CA3AF' },
    },
    invalid: {
      color: '#EF4444',
      iconColor: '#EF4444',
    },
  }

  return (
    <div className="space-y-4">
      {/* Card label */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
          Kaartgegevens
        </label>
        <div
          className="rounded-xl px-4 py-3.5"
          style={{
            backgroundColor: isDark ? '#252525' : '#FFFFFF',
            border: `1px solid ${isDark ? '#2A2A2A' : '#E5E7EB'}`,
          }}
        >
          <CardElement
            options={{ style: cardStyle, hidePostalCode: true }}
            onReady={() => setCardReady(true)}
            onChange={(e) => {
              if (e.error) setError(e.error.message)
              else setError(null)
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs rounded-xl p-3"
          style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || !cardReady || submitting}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30"
        style={{ backgroundColor: 'var(--brand)', color: 'white' }}
      >
        {submitting
          ? 'Verwerken...'
          : isBeta
            ? 'Start 3 maanden gratis →'
            : 'Start 14 dagen gratis →'}
      </button>
    </div>
  )
}