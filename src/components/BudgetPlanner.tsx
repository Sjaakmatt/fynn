// src/components/BudgetPlanner.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'

interface BudgetCategory {
  category: string
  budget: number
  icon: string
  tip: string
}

interface BudgetData {
  categories: BudgetCategory[]
  updated_at: string
}

const AVAILABLE_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'beleggen': '📈', 'overig': '📦', 'vakantie': '✈️',
  'sport': '🏋️', 'kinderen': '👶', 'huisdieren': '🐾',
  'cadeau': '🎁', 'opleiding': '📚',
}

export default function BudgetPlanner() {
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [uitgaven, setUitgaven] = useState<Record<string, number>>({})
  const [totalInkomen, setTotalInkomen] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBudget = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/budget')
      if (!res.ok) throw new Error('Kon budget niet laden')
      const data = await res.json()
      if (data.budget) setBudget(data.budget)
      if (data.uitgavenDezeMaand) setUitgaven(data.uitgavenDezeMaand)
      const inkomen = Number(data.totalInkomen ?? 0)
      setTotalInkomen(Number.isFinite(inkomen) ? inkomen : 0)
    } catch {
      setError('Kon budget niet laden. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBudget() }, [loadBudget])

  useEffect(() => {
    const handler = () => loadBudget()
    window.addEventListener('transactionUpdated', handler)
    return () => window.removeEventListener('transactionUpdated', handler)
  }, [loadBudget])

  async function generateBudget() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/budget', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kon budget niet genereren'); return }
      if (data.categories) {
        setBudget({ categories: data.categories, updated_at: new Date().toISOString() })
        const inkomen = Number(data.totalInkomen ?? 0)
        if (Number.isFinite(inkomen)) setTotalInkomen(inkomen)
      }
    } catch {
      setError('Kon budget niet genereren. Probeer het opnieuw.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveBudget(categories: BudgetCategory[]) {
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categories }),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch {
      setError('Wijziging kon niet opgeslagen worden.')
    } finally {
      setSaving(false)
    }
  }

  async function updateBudgetAmount(category: string, newAmount: number) {
    if (!budget || !Number.isFinite(newAmount) || newAmount < 0) {
      setEditingId(null)
      return
    }
    const updated = budget.categories.map(c =>
      c.category === category ? { ...c, budget: Math.round(newAmount) } : c
    )
    setBudget({ ...budget, categories: updated })
    setEditingId(null)
    await saveBudget(updated)
  }

  async function removeCategory(category: string) {
    if (!budget) return
    const updated = budget.categories.filter(c => c.category !== category)
    setBudget({ ...budget, categories: updated })
    await saveBudget(updated)
  }

  async function addCategory() {
    if (!newCategory.trim() || !newBudget || !budget) return
    const cat = newCategory.toLowerCase().trim()
    if (budget.categories.some(c => c.category === cat)) {
      setError(`"${cat}" bestaat al in je budget.`)
      return
    }
    const amount = Number(newBudget)
    if (!Number.isFinite(amount) || amount <= 0) return
    const updated = [...budget.categories, {
      category: cat,
      budget: Math.round(amount),
      icon: AVAILABLE_ICONS[cat] ?? '📦',
      tip: '',
    }]
    setBudget({ ...budget, categories: updated })
    setNewCategory('')
    setNewBudget('')
    setShowAddCategory(false)
    await saveBudget(updated)
  }

  const totalBudget = budget?.categories.reduce((sum, c) => sum + c.budget, 0) ?? 0
  const totalUitgegeven = Object.values(uitgaven).reduce((sum, v) => sum + v, 0)
  const resterend = totalBudget - totalUitgegeven

  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayProgress = today.getDate() / daysInMonth
  const monthLabel = today.toLocaleDateString('nl-NL', { month: 'long' })

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="rounded-2xl p-8 flex items-center justify-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
    </div>
  )

  // ─── Empty state ────────────────────────────────────────────────────
  if (!budget) return (
    <div className="rounded-2xl p-8 text-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'var(--tab-bg)' }}
      >
        <span className="text-xl">📊</span>
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
        Nog geen budget
      </p>
      <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
        Fynn maakt een budget op basis van je transactiehistorie, inkomen en een spaarquote van minimaal 10%.
      </p>
      {error && (
        <p className="text-xs rounded-xl p-3 mb-4 text-left"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
          {error}
        </p>
      )}
      <button
        onClick={generateBudget}
        disabled={generating}
        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-opacity"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {generating ? 'Genereren...' : 'Genereer mijn budget'}
      </button>
    </div>
  )

  // ─── Budget view ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-xl p-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
          <button onClick={() => setError(null)} className="text-sm leading-none ml-3" style={{ color: '#EF4444' }}>×</button>
        </div>
      )}

      {/* Eén card: header → summary → categorieën → footer */}
      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* ── Header ── */}
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
              Budget {monthLabel}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {saving ? 'Opslaan...' : `Dag ${today.getDate()} van ${daysInMonth}`}
            </p>
          </div>
          <button
            onClick={generateBudget}
            disabled={generating}
            className="px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-30 transition-opacity"
            style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
          >
            {generating ? '...' : '↻ Opnieuw'}
          </button>
        </div>

        {/* ── Summary strip ── */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                €{totalUitgegeven.toFixed(0)}
              </span>
              <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
                / €{totalBudget.toFixed(0)}
              </span>
            </div>
            <span className="text-sm font-semibold" style={{
              color: resterend < 0 ? '#EF4444' : resterend < 200 ? '#F59E0B' : '#4ade80'
            }}>
              {resterend >= 0 ? `€${resterend.toFixed(0)} over` : `€${Math.abs(resterend).toFixed(0)} over budget`}
            </span>
          </div>

          {/* Total progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((totalUitgegeven / totalBudget) * 100, 100)}%`,
                backgroundColor: resterend < 0 ? '#EF4444' : resterend < 200 ? '#F59E0B' : 'var(--brand)',
              }}
            />
          </div>

          {/* Tempo indicator — alleen als relevant */}
          {resterend >= 0 && (totalUitgegeven / totalBudget) > dayProgress + 0.1 && (
            <p className="text-xs mt-2" style={{ color: '#F59E0B' }}>
              Je zit iets voor op tempo — houd het in de gaten
            </p>
          )}

          {/* Budget > inkomen */}
          {totalBudget > totalInkomen && (
            <p className="text-xs mt-2" style={{ color: '#EF4444' }}>
              Budget (€{totalBudget.toFixed(0)}) is hoger dan inkomen (€{totalInkomen.toFixed(0)})
            </p>
          )}
        </div>

        {/* ── Categorie rijen ── */}
        {budget.categories.map((cat, i) => {
          const spent = uitgaven[cat.category] ?? 0
          const pct = cat.budget > 0 ? Math.min((spent / cat.budget) * 100, 100) : 0
          const overBudget = spent > cat.budget
          const almostOver = !overBudget && pct > 80
          const isEditing = editingId === cat.category
          const barColor = overBudget ? '#EF4444' : almostOver ? '#F59E0B' : '#4ade80'

          return (
            <div key={cat.category} className="px-5 py-3.5 group"
              style={{ borderBottom: i < budget.categories.length - 1 ? '1px solid var(--border)' : 'none' }}>

              {/* Row: icon + name + amounts */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-base shrink-0">{cat.icon}</span>
                  <p className="text-sm capitalize truncate" style={{ color: 'var(--text)' }}>
                    {cat.category}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs tabular-nums" style={{ color: overBudget ? '#EF4444' : 'var(--muted)' }}>
                    €{spent.toFixed(0)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--border)' }}>/</span>
                  {isEditing ? (
                    <input
                      type="number"
                      defaultValue={cat.budget}
                      autoFocus
                      min={0}
                      onBlur={e => updateBudgetAmount(cat.category, Number(e.target.value))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateBudgetAmount(cat.category, Number((e.target as HTMLInputElement).value))
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-16 text-right text-xs font-medium rounded-lg px-2 py-1 outline-none tabular-nums"
                      style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingId(cat.category)}
                      className="text-xs font-medium tabular-nums"
                      style={{ color: 'var(--text)' }}
                      title="Klik om aan te passen"
                    >
                      €{cat.budget.toFixed(0)}
                    </button>
                  )}
                  <button
                    onClick={() => removeCategory(cat.category)}
                    className="w-5 h-5 rounded-full flex items-center justify-center
                               opacity-0 group-hover:opacity-60 hover:!opacity-100
                               sm:opacity-0 max-sm:opacity-40
                               transition-opacity"
                    style={{ color: 'var(--muted)' }}
                    title="Verwijder"
                  >
                    <span className="text-xs leading-none">×</span>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden ml-7"
                style={{ backgroundColor: 'var(--tab-bg)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>

              {/* Status — alleen bij problemen */}
              {overBudget && (
                <p className="text-xs mt-1.5 ml-7" style={{ color: '#EF4444' }}>
                  €{(spent - cat.budget).toFixed(0)} over budget
                </p>
              )}
              {almostOver && (
                <p className="text-xs mt-1.5 ml-7" style={{ color: '#F59E0B' }}>
                  Nog €{(cat.budget - spent).toFixed(0)} over
                </p>
              )}
            </div>
          )
        })}

        {/* ── Categorie toevoegen ── */}
        <div className="px-5 py-3.5 border-t" style={{ borderColor: 'var(--border)' }}>
          {showAddCategory ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Categorie"
                autoFocus
                className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('budget-new-amount')?.focus() }}
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>€</span>
                <input
                  id="budget-new-amount"
                  type="number"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-20 rounded-xl pl-6 pr-3 py-3 text-sm outline-none"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                />
              </div>
              <button onClick={addCategory}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ backgroundColor: 'var(--brand)' }}>
                ✓
              </button>
              <button onClick={() => { setShowAddCategory(false); setNewCategory(''); setNewBudget('') }}
                className="text-sm leading-none" style={{ color: 'var(--muted)' }}>
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--brand)' }}
            >
              + Categorie toevoegen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}