'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ConnectBankProps {
  userId: string
  label?: string
  compact?: boolean
  onSuccess?: () => void
}

export default function ConnectBank({
  userId,
  label = 'Bankrekening koppelen',
  compact = false,
  onSuccess,
}: ConnectBankProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)

    try {
      // 1. Maak een Financial Connections session aan
      const sessionRes = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const { clientSecret, sessionId, error: sessionError } = await sessionRes.json()

      if (sessionError || !clientSecret) {
        setError('Kon verbinding niet starten. Probeer opnieuw.')
        setLoading(false)
        return
      }

      // 2. Open de Stripe Financial Connections modal
      const stripe = await stripePromise
      if (!stripe) {
        setError('Stripe kon niet worden geladen.')
        setLoading(false)
        return
      }

      const { financialConnectionsSession, error: stripeError } =
        await stripe.collectFinancialConnectionsAccounts({ clientSecret })

      if (stripeError) {
        setError(stripeError.message ?? 'Er ging iets mis.')
        setLoading(false)
        return
      }

      if (!financialConnectionsSession?.accounts?.length) {
        // Gebruiker heeft de modal gesloten zonder te koppelen
        setLoading(false)
        return
      }

      // 3. Stuur session ID naar backend om accounts + transacties op te slaan
      const callbackRes = await fetch('/api/stripe/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const callbackData = await callbackRes.json()

      if (!callbackData.success) {
        setError('Rekening gekoppeld, maar gegevens ophalen mislukt. Probeer opnieuw.')
        setLoading(false)
        return
      }

      // 4. Klaar — refresh de pagina zodat nieuwe data zichtbaar is
      onSuccess?.()
      window.location.reload()

    } catch (err) {
      console.error('[ConnectBank]', err)
      setError('Er ging iets mis. Probeer opnieuw.')
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          {loading ? '⟳ Verbinden...' : label}
        </button>
        {error && (
          <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="px-6 py-3 rounded-xl font-medium text-sm text-white disabled:opacity-50 transition-all hover:opacity-90"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⟳</span>
            Verbinden...
          </span>
        ) : label}
      </button>
      {error && (
        <p className="text-xs px-1" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  )
}