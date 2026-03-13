// src/components/checkout/SubscriptionManager.tsx
'use client'

import { useEffect, useState } from 'react'
import SubscriptionCancelModal from '@/components/SubscriptionCancelModal'

interface Subscription {
  name: string
  amount: number
  monthlyAmount: number
  cadence: string
  occurrences: number
  lastDate: string
  isActive: boolean
}

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [totaalPerMaand, setTotaalPerMaand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null)

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(data => {
        setSubscriptions(data.subscriptions ?? [])
        setTotaalPerMaand(data.totaalPerMaand ?? 0)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="rounded-2xl p-5 animate-pulse"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--tab-bg)' }} />
      <div className="h-3 w-48 rounded" style={{ backgroundColor: 'var(--tab-bg)' }} />
    </div>
  )

  if (subscriptions.length === 0) return null

  return (
    <>
      {cancelTarget && (
        <SubscriptionCancelModal
          subscription={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Abonnementen</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>€{totaalPerMaand.toFixed(2)}</span>/maand · {subscriptions.length} actief
          </p>
        </div>

        <div>
          {subscriptions.map((sub, i) => (
            <button
              key={`${sub.name}-${i}`}
              onClick={() => setCancelTarget(sub)}
              className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
              style={{
                borderBottom: i < subscriptions.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--tab-bg)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--tab-bg)' }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                    {sub.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{sub.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {sub.cadence} · laatste {new Date(sub.lastDate).toLocaleDateString('nl-NL', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  €{sub.amount.toFixed(2)}
                </p>
                {sub.cadence !== 'maandelijks' && (
                  <p className="text-xs" style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    €{sub.monthlyAmount.toFixed(2)}/maand
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Tik op een abonnement om op te zeggen
          </p>
        </div>
      </div>
    </>
  )
}