// src/components/CategoryBreakdown.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  'wonen', 'boodschappen', 'eten & drinken', 'transport',
  'abonnementen', 'kleding', 'gezondheid', 'entertainment',
  'sparen', 'inkomen', 'toeslagen', 'interne_overboeking', 'overig',
]

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'inkomen': '💵', 'toeslagen': '🏛️', 'interne_overboeking': '🔄',
  'overig': '📦',
}

const CATEGORY_LABELS: Record<string, string> = {
  'wonen': 'Wonen', 'boodschappen': 'Boodschappen',
  'eten & drinken': 'Eten & Drinken', 'transport': 'Transport',
  'abonnementen': 'Abonnementen', 'kleding': 'Kleding',
  'gezondheid': 'Gezondheid', 'entertainment': 'Entertainment',
  'sparen': 'Sparen', 'inkomen': 'Inkomen', 'toeslagen': 'Toeslagen',
  'interne_overboeking': 'Interne overboeking', 'overig': 'Overig',
}

interface Transaction {
  id: string
  description: string
  amount: number
  transaction_date: string
  category: string
}

interface CategoryData {
  total: number
  count: number
}

interface Props {
  sortedCategories: [string, CategoryData][]
  totalUitgaven: number
}

function getMonthOptions(): { value: string; label: string }[] {
  const options = []
  const today = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

export default function CategoryBreakdown({ sortedCategories: initialCategories, totalUitgaven: initialTotal }: Props) {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [categories, setCategories] = useState<[string, CategoryData][]>(initialCategories)
  const [totalUitgaven, setTotalUitgaven] = useState(initialTotal)
  const [loadingMonth, setLoadingMonth] = useState(false)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({})
  const [loadingTx, setLoadingTx] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const router = useRouter()

  const monthOptions = getMonthOptions()

  // Laad data voor geselecteerde maand
  useEffect(() => {
    if (selectedMonth === currentMonth) {
      setCategories(initialCategories)
      setTotalUitgaven(initialTotal)
      return
    }

    setLoadingMonth(true)
    setExpanded(null)
    setTransactions({})

    fetch(`/api/analyse?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => {
        setCategories(data.sortedCategories ?? [])
        setTotalUitgaven(data.totalUitgaven ?? 0)
        setLoadingMonth(false)
      })
      .catch(() => setLoadingMonth(false))
  }, [selectedMonth])

  async function toggleCategory(cat: string) {
    if (expanded === cat) {
      setExpanded(null)
      return
    }
    setExpanded(cat)

    const cacheKey = `${selectedMonth}:${cat}`
    if (!transactions[cacheKey]) {
      setLoadingTx(cat)
      const res = await fetch(`/api/transactions?category=${encodeURIComponent(cat)}&month=${selectedMonth}`)
      const data = await res.json()
      setTransactions(prev => ({ ...prev, [cacheKey]: data.transactions ?? [] }))
      setLoadingTx(null)
    }
  }

  async function updateCategory(transactionId: string, newCategory: string, oldCategory: string) {
    setUpdating(transactionId)
    const cacheKey = `${selectedMonth}:${oldCategory}`
    const newCacheKey = `${selectedMonth}:${newCategory}`

    const res = await fetch('/api/categorize/override', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, category: newCategory }),
    })

    if (res.ok) {
      setTransactions(prev => {
        const updated = { ...prev }
        if (updated[cacheKey]) {
          updated[cacheKey] = updated[cacheKey].filter(t => t.id !== transactionId)
        }
        if (updated[newCacheKey]) {
          const tx = prev[cacheKey]?.find(t => t.id === transactionId)
          if (tx) {
            updated[newCacheKey] = [...updated[newCacheKey], { ...tx, category: newCategory }]
              .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
          }
        }
        return updated
      })
    }

    setUpdating(null)
    router.refresh()
    window.dispatchEvent(new CustomEvent('transactionUpdated'))
  }

  const selectedLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* Header met maand toggle */}
      <div className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Uitgaven per categorie
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Klik op een categorie om transacties te zien
          </p>
        </div>

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-xs rounded-xl px-3 py-1.5"
          style={{
            backgroundColor: 'var(--tab-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          {monthOptions.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loadingMonth ? (
        <div className="px-5 py-8 text-center">
          <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Laden...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Geen uitgaven gevonden voor {selectedLabel}
          </p>
        </div>
      ) : (
        <div>
          {categories.map(([cat, data]) => {
            const pct = totalUitgaven > 0 ? (data.total / totalUitgaven) * 100 : 0
            const isExpanded = expanded === cat
            const cacheKey = `${selectedMonth}:${cat}`
            const catTransactions = transactions[cacheKey] ?? []
            const isLoading = loadingTx === cat
            const label = CATEGORY_LABELS[cat] ?? cat

            return (
              <div key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full px-5 py-4 text-left transition-colors"
                  style={{ backgroundColor: isExpanded ? 'var(--tab-bg)' : 'transparent' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{CATEGORY_ICONS[cat] ?? '📦'}</span>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text)' }}>
                          {label}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {data.count} transacties
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                        €{data.total.toFixed(0)}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {isExpanded ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden ml-7"
                    style={{ backgroundColor: 'var(--tab-bg)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: 'var(--brand)' }} />
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ backgroundColor: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                    {isLoading ? (
                      <div className="px-5 py-6 text-center">
                        <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
                          style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                      </div>
                    ) : catTransactions.length === 0 ? (
                      <p className="px-5 py-4 text-sm" style={{ color: 'var(--muted)' }}>
                        Geen transacties gevonden
                      </p>
                    ) : (
                      catTransactions.map(tx => (
                        <div key={tx.id}
                          className="px-5 py-3 flex items-center justify-between gap-3"
                          style={{ borderBottom: '1px solid var(--border)' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                              {tx.description}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              {new Date(tx.transaction_date).toLocaleDateString('nl-NL', {
                                day: 'numeric', month: 'short'
                              })}
                            </p>
                          </div>
                          <p className="text-sm tabular-nums flex-shrink-0"
                            style={{ color: tx.amount < 0 ? 'var(--text)' : '#4ADE80' }}>
                            {tx.amount < 0 ? '-' : '+'}€{Math.abs(tx.amount).toFixed(2)}
                          </p>
                          <select
                            value={tx.category}
                            disabled={updating === tx.id}
                            onChange={(e) => updateCategory(tx.id, e.target.value, cat)}
                            className="text-xs rounded-xl px-2 py-1.5 flex-shrink-0"
                            style={{
                              backgroundColor: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              fontFamily: 'inherit',
                              opacity: updating === tx.id ? 0.3 : 1,
                              cursor: updating === tx.id ? 'not-allowed' : 'pointer',
                              maxWidth: 130,
                            }}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c] ?? c}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}