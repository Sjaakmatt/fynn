// src/components/checkout/SubscriptionManager.tsx
'use client'

import { useEffect, useState } from 'react'

interface Subscription {
  name: string
  amount: number
  monthlyAmount: number
  cadence: string
  occurrences: number
  lastDate: string
  isActive: boolean
}

const SUBSCRIPTION_ICONS: Record<string, string> = {
  'netflix': '🎬', 'spotify': '🎵', 'disney': '🏰', 'youtube': '▶️',
  'adobe': '🎨', 'microsoft': '💼', 'apple': '🍎', 'google': '🔍',
  'amazon': '📦', 'canva': '✏️', 'notion': '📝', 'github': '💻',
  'chatgpt': '🤖', 'openai': '🤖', 'vodafone': '📱', 'odido': '📱',
  'kpn': '📱', 't-mobile': '📱', 'tele2': '📱', 'ziggo': '📺',
  'basic-fit': '💪', 'sportschool': '💪',
}

function getIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(SUBSCRIPTION_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '📱'
}

const CADENCE_LABELS: Record<string, string> = {
  'maandelijks': '/maand',
  'kwartaal': '/kwartaal',
  'jaarlijks': '/jaar',
}

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [totaalPerMaand, setTotaalPerMaand] = useState(0)
  const [loading, setLoading] = useState(true)

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
            key={`${sub.name}-${i}`}
            className="px-5 py-4 flex items-center justify-between"
            style={{
              borderBottom: i < subscriptions.length - 1 ? '1px solid var(--border)' : 'none'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ backgroundColor: 'var(--tab-bg)' }}>
                {getIcon(sub.name)}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{sub.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {sub.cadence} · laatste {new Date(sub.lastDate).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'short'
                  })}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                €{sub.amount.toFixed(2)}
              </p>
              {sub.cadence !== 'maandelijks' && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  €{sub.monthlyAmount.toFixed(2)}/maand
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          💡 Vraag Fynn:{' '}
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            "Welk abonnement kan ik het beste opzeggen?"
          </span>
        </p>
      </div>
    </div>
  )
}