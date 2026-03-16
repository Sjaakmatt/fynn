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
  category: string
  isActive: boolean
  canCancel: boolean
  cancelMethod: string | null
  cancelDifficulty: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  'abonnementen': '📱',
  'wonen': '🏠',
  'transport': '🚗',
  'gezondheid': '💊',
  'entertainment': '🎮',
  'eten & drinken': '🍽️',
  'boodschappen': '🛒',
  'kleding': '👗',
  'overig': '📦',
}

const DIFFICULTY_DOT: Record<string, string> = {
  EASY: '#4ade80',
  MEDIUM: '#facc15',
  HARD: '#f97316',
  NIGHTMARE: '#ef4444',
}

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [vasteLasten, setVasteLasten] = useState<Subscription[]>([])
  const [totaalAbonnementen, setTotaalAbonnementen] = useState(0)
  const [totaalVasteLasten, setTotaalVasteLasten] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null)
  const [showVasteLasten, setShowVasteLasten] = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(data => {
        setSubscriptions(data.subscriptions ?? [])
        setVasteLasten(data.vasteLasten ?? [])
        setTotaalAbonnementen(data.totaalAbonnementen ?? 0)
        setTotaalVasteLasten(data.totaalVasteLasten ?? 0)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="space-y-3">
      <div className="rounded-2xl p-5 animate-pulse"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--tab-bg)' }} />
        <div className="h-3 w-48 rounded" style={{ backgroundColor: 'var(--tab-bg)' }} />
      </div>
    </div>
  )

  if (subscriptions.length === 0 && vasteLasten.length === 0) return null

  return (
    <>
      {cancelTarget && (
        <SubscriptionCancelModal
          subscription={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <div className="space-y-3">
        {/* ── Opzegbare Abonnementen ────────────────────────────── */}
        {subscriptions.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    Abonnementen
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    <span className="tabular-nums">€{totaalAbonnementen.toFixed(0)}</span>/maand · {subscriptions.length} gevonden
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)', color: 'var(--brand)' }}>
                  Opzegbaar
                </div>
              </div>
            </div>

            <div>
              {subscriptions.map((sub, i) => (
                <button
                  key={`sub-${sub.name}-${i}`}
                  onClick={() => setCancelTarget(sub)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
                  style={{
                    borderBottom: i < subscriptions.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--tab-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--tab-bg)' }}
                    >
                      <span className="text-sm">
                        {CATEGORY_ICONS[sub.category] ?? '📦'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{sub.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {sub.cadence}
                        </p>
                        {sub.cancelDifficulty && (
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: DIFFICULTY_DOT[sub.cancelDifficulty] ?? 'var(--muted)' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                      €{sub.amount.toFixed(2)}
                    </p>
                    {sub.cadence !== 'maandelijks' && (
                      <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                        €{sub.monthlyAmount.toFixed(2)}/mnd
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
        )}

        {/* ── Overige Vaste Lasten ──────────────────────────────── */}
        {vasteLasten.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

            <button
              onClick={() => setShowVasteLasten(!showVasteLasten)}
              className="w-full px-5 py-4 text-left flex items-center justify-between"
            >
              <div>
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  Overige vaste lasten
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  <span className="tabular-nums">€{totaalVasteLasten.toFixed(0)}</span>/maand · {vasteLasten.length} gevonden
                </p>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {showVasteLasten ? '↑' : '↓'}
              </span>
            </button>

            {showVasteLasten && (
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                {vasteLasten.map((item, i) => (
                  <div
                    key={`vl-${item.name}-${i}`}
                    className="px-5 py-3.5 flex items-center justify-between"
                    style={{
                      borderBottom: i < vasteLasten.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--tab-bg)' }}
                      >
                        <span className="text-sm">
                          {CATEGORY_ICONS[item.category] ?? '📦'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {item.cadence} · {item.category}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                        €{item.amount.toFixed(2)}
                      </p>
                      {item.cadence !== 'maandelijks' && (
                        <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                          €{item.monthlyAmount.toFixed(2)}/mnd
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                <div className="px-5 py-3 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tab-bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Contracten en vaste lasten — niet direct opzegbaar via Fynn
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}