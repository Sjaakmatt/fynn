// src/components/checkout/SubscriptionManager.tsx
'use client'

import { useEffect, useState } from 'react'
import SubscriptionCancelModal from '@/components/SubscriptionCancelModal'

interface RecurringItem {
  name: string
  amount: number
  monthlyAmount: number
  cadence: string
  occurrences: number
  lastDate: string
  category: string
  type: 'abonnement' | 'contract' | 'vast'
  canCancel: boolean
  cancelMethod: string | null
  cancelDifficulty: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  'abonnementen': '📱',
  'wonen': '🏠',
  'transport': '🚗',
  'gezondheid': '💪',
  'entertainment': '🎮',
  'eten & drinken': '🍽️',
  'boodschappen': '🛒',
  'kleding': '👗',
  'verzekering': '🛡️',
  'kinderopvang': '👶',
  'schulden': '📋',
  'overig': '📦',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: '#4ade80',
  MEDIUM: '#facc15',
  HARD: '#f97316',
  NIGHTMARE: '#ef4444',
}

export default function SubscriptionManager() {
  const [items, setItems] = useState<RecurringItem[]>([])
  const [totaalPerMaand, setTotaalPerMaand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<RecurringItem | null>(null)
  const [showContracten, setShowContracten] = useState(false)
  const [showVast, setShowVast] = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(data => {
        setItems(data.items ?? [])
        setTotaalPerMaand(data.totaalPerMaand ?? 0)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="rounded-2xl p-5 animate-pulse"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="h-4 w-28 rounded-lg mb-3" style={{ backgroundColor: 'var(--tab-bg)' }} />
          <div className="h-3 w-44 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }} />
        </div>
      ))}
    </div>
  )

  if (items.length === 0) return null

  const abonnementen = items.filter(i => i.type === 'abonnement')
  const contracten = items.filter(i => i.type === 'contract')
  const vast = items.filter(i => i.type === 'vast')

  const totaalAbo = abonnementen.reduce((s, i) => s + i.monthlyAmount, 0)
  const totaalContract = contracten.reduce((s, i) => s + i.monthlyAmount, 0)
  const totaalVast = vast.reduce((s, i) => s + i.monthlyAmount, 0)

  return (
    <>
      {cancelTarget && (
        <SubscriptionCancelModal
          subscription={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <div className="space-y-3">
        {/* ── Abonnementen (altijd open, opzeg-acties) ──────────── */}
        {abonnementen.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    Abonnementen
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      color: 'var(--brand)',
                      backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                    }}>
                    {abonnementen.length} actief
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  <span className="tabular-nums">€{totaalAbo.toFixed(0)}</span>/maand ·{' '}
                  <span className="font-medium" style={{ color: 'var(--brand)' }}>
                    €{(totaalAbo * 12).toFixed(0)}/jaar
                  </span>
                </p>
              </div>
            </div>

            {/* Items */}
            <div>
              {abonnementen.map((item, i) => (
                <button
                  key={`abo-${item.name}-${i}`}
                  onClick={() => setCancelTarget(item)}
                  className="w-full text-left px-5 py-4 flex items-center gap-3 transition-colors"
                  style={{
                    borderBottom: i < abonnementen.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--tab-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--tab-bg)' }}>
                    <span className="text-base">
                      {CATEGORY_ICONS[item.category] ?? '📦'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {item.name}
                      </p>
                      {item.cancelDifficulty && (
                        <div className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: DIFFICULTY_COLORS[item.cancelDifficulty] ?? 'var(--muted)' }} />
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {item.cadence}
                      {item.cadence !== 'maandelijks' && ` · €${item.monthlyAmount.toFixed(2)}/mnd`}
                    </p>
                  </div>

                  {/* Amount + action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                        €{item.amount.toFixed(2)}
                      </p>
                      <p className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
                        /mnd
                      </p>
                    </div>
                    <div className="w-px h-8" style={{ backgroundColor: 'var(--border)' }} />
                    <span className="text-xs font-medium whitespace-nowrap"
                      style={{ color: '#EF4444' }}>
                      Opzeggen →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t" style={{
              borderColor: 'var(--border)',
              backgroundColor: 'color-mix(in srgb, var(--brand) 4%, transparent)',
            }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Tik om direct op te zeggen via Fynn — per e-mail, link of telefoon
              </p>
            </div>
          </div>
        )}

        {/* ── Contracten & verzekeringen ────────────────────────── */}
        {contracten.length > 0 && (
          <CompactSection
            title="Contracten & verzekeringen"
            count={contracten.length}
            total={totaalContract}
            items={contracten}
            isOpen={showContracten}
            onToggle={() => setShowContracten(!showContracten)}
          />
        )}

        {/* ── Overige vaste kosten ──────────────────────────────── */}
        {vast.length > 0 && (
          <CompactSection
            title="Overige vaste kosten"
            count={vast.length}
            total={totaalVast}
            items={vast}
            isOpen={showVast}
            onToggle={() => setShowVast(!showVast)}
          />
        )}
      </div>
    </>
  )
}

/* ── Compact collapsible section ───────────────────────────────────────────── */

function CompactSection({ title, count, total, items, isOpen, onToggle }: {
  title: string
  count: number
  total: number
  items: RecurringItem[]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left flex items-center justify-between transition-colors"
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--tab-bg)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--muted)',
                backgroundColor: 'color-mix(in srgb, var(--muted) 10%, transparent)',
              }}>
              {count}
            </span>
          </div>
          <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--muted)' }}>
            €{total.toFixed(0)}/maand
          </p>
        </div>
        <span className="text-xs transition-transform duration-200"
          style={{
            color: 'var(--muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {items.map((item, i) => (
            <div
              key={`${title}-${item.name}-${i}`}
              className="px-5 py-3.5 flex items-center gap-3"
              style={{
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--tab-bg)' }}>
                <span className="text-base">
                  {CATEGORY_ICONS[item.category] ?? '📦'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                  {item.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {item.cadence} · {item.category}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                  €{item.amount.toFixed(2)}
                </p>
                {item.cadence !== 'maandelijks' && (
                  <p className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
                    €{item.monthlyAmount.toFixed(2)}/mnd
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}