'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  'wonen', 'boodschappen', 'eten & drinken', 'transport',
  'abonnementen', 'kleding', 'gezondheid', 'entertainment',
  'sparen', 'inkomen', 'overig',
]

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'inkomen': '💵', 'overig': '📦',
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

export default function CategoryBreakdown({ sortedCategories, totalUitgaven }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const router = useRouter()

  async function toggleCategory(cat: string) {
    if (expanded === cat) {
      setExpanded(null)
      return
    }

    setExpanded(cat)

    // Fetch transactions voor deze categorie als nog niet geladen
    if (!transactions[cat]) {
      setLoading(cat)
      const res = await fetch(`/api/transactions?category=${encodeURIComponent(cat)}`)
      const data = await res.json()
      setTransactions(prev => ({ ...prev, [cat]: data.transactions ?? [] }))
      setLoading(null)
    }
  }

  async function updateCategory(transactionId: string, newCategory: string, oldCategory: string) {
    setUpdating(transactionId)

    const res = await fetch('/api/categorize/override', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, category: newCategory }),
    })

    if (res.ok) {
      // Update lokale state
      setTransactions(prev => {
        const updated = { ...prev }

        // Verwijder uit oude categorie
        if (updated[oldCategory]) {
          updated[oldCategory] = updated[oldCategory].filter(t => t.id !== transactionId)
        }

        // Voeg toe aan nieuwe categorie (als die al geladen is)
        if (updated[newCategory]) {
          const tx = prev[oldCategory]?.find(t => t.id === transactionId)
          if (tx) {
            updated[newCategory] = [...updated[newCategory], { ...tx, category: newCategory }]
              .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
          }
        }

        return updated
      })
    }

    setUpdating(null)
    router.refresh()
    sessionStorage.setItem('budgetNeedsRefresh', 'true')
    window.dispatchEvent(new CustomEvent('transactionUpdated'))
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Uitgaven per categorie
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          Klik op een categorie om transacties te zien en aan te passen
        </p>
      </div>

      <div>
        {sortedCategories.map(([cat, data]) => {
          const pct = totalUitgaven > 0 ? (data.total / totalUitgaven) * 100 : 0
          const isExpanded = expanded === cat
          const catTransactions = transactions[cat] ?? []
          const isLoading = loading === cat

          return (
            <div key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Categorie rij */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full px-5 py-4 text-left transition-colors"
                style={{ backgroundColor: isExpanded ? 'var(--tab-bg)' : 'transparent' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{CATEGORY_ICONS[cat] ?? '📦'}</span>
                    <div>
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {cat}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {data.count} transacties
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      €{data.total.toFixed(0)}
                    </p>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden ml-8"
                  style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: 'var(--brand)' }} />
                </div>
              </button>

              {/* Uitklapbare transacties */}
              {isExpanded && (
                <div style={{ backgroundColor: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                  {isLoading ? (
                    <div className="px-5 py-6 text-center">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand)' }} />
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
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                            {tx.description}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            {new Date(tx.transaction_date).toLocaleDateString('nl-NL', {
                              day: 'numeric', month: 'short'
                            })}
                          </p>
                        </div>

                        <p className="text-sm font-medium flex-shrink-0"
                          style={{ color: tx.amount < 0 ? 'var(--text)' : '#4ADE80' }}>
                          {tx.amount < 0 ? '-' : '+'}€{Math.abs(tx.amount).toFixed(2)}
                        </p>

                        {/* Categorie dropdown */}
                        <select
                          value={tx.category}
                          disabled={updating === tx.id}
                          onChange={(e) => updateCategory(tx.id, e.target.value, cat)}
                          className="text-xs rounded-lg px-2 py-1.5 flex-shrink-0"
                          style={{
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            fontFamily: 'inherit',
                            opacity: updating === tx.id ? 0.5 : 1,
                            cursor: updating === tx.id ? 'not-allowed' : 'pointer',
                            maxWidth: 130,
                          }}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
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
    </div>
  )
}