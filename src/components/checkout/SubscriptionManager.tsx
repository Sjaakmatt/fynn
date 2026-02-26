'use client'

import { useEffect, useState } from 'react'

interface Subscription {
  name: string
  amount: number
  occurrences: number
  lastDate: string
}

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(data => {
        setSubscriptions(data.subscriptions ?? [])
        setLoading(false)
      })
  }, [])

  const totaalPerMaand = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  if (loading || subscriptions.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Abonnementen</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          €{totaalPerMaand.toFixed(2)}/maand · {subscriptions.length} actief
        </p>
      </div>

      <div>
        {subscriptions.map((sub, i) => (
          <div
            key={sub.name}
            className="px-5 py-4 flex items-center justify-between"
            style={{ 
              borderBottom: i < subscriptions.length - 1 ? '1px solid var(--border)' : 'none'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ backgroundColor: 'var(--tab-bg)' }}>
                📱
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{sub.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Laatste betaling {new Date(sub.lastDate).toLocaleDateString('nl-NL')}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              €{sub.amount.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          💡 Vraag Fynn: <span className="font-medium cursor-pointer" style={{ color: 'var(--text)' }}>"Welk abonnement kan ik het beste opzeggen?"</span>
        </p>
      </div>
    </div>
  )
}
