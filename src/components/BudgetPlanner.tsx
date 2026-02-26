'use client'

import { useEffect, useState } from 'react'

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

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // Check bij mount of refresh nodig is
    if (sessionStorage.getItem('budgetNeedsRefresh') === 'true') {
      sessionStorage.removeItem('budgetNeedsRefresh')
      loadBudget()
      return
    }
    loadBudget()
  }, [refreshKey])

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1)
    window.addEventListener('transactionUpdated', handler)
    return () => window.removeEventListener('transactionUpdated', handler)
  }, [])

  async function loadBudget() {
    setLoading(true)
    const res = await fetch('/api/ai/budget')
    const data = await res.json()
    if (data.budget) setBudget(data.budget)
    if (data.uitgavenDezeMaand) setUitgaven(data.uitgavenDezeMaand)
    if (data.totalInkomen) setTotalInkomen(data.totalInkomen)
    setLoading(false)
  }

  async function generateBudget() {
    setGenerating(true)
    const res = await fetch('/api/ai/budget', { method: 'POST' })
    const data = await res.json()
    if (data.categories) {
      setBudget({ categories: data.categories, updated_at: new Date().toISOString() })
      if (data.totalInkomen) setTotalInkomen(data.totalInkomen)
    }
    setGenerating(false)
  }

  async function saveBudget(categories: BudgetCategory[]) {
    setSaving(true)
    try {
        await fetch('/api/ai/budget', {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ categories })
        })
    } catch (error) {
        console.error('Save error:', error)
    }
    setSaving(false)
    }

  async function updateBudgetAmount(category: string, newAmount: number) {
    if (!budget) return
    const updated = budget.categories.map(c =>
      c.category === category ? { ...c, budget: newAmount } : c
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
    const updated = [...budget.categories, {
      category: cat,
      budget: parseFloat(newBudget),
      icon: AVAILABLE_ICONS[cat] ?? '📦',
      tip: ''
    }]
    setBudget({ ...budget, categories: updated })
    setNewCategory('')
    setNewBudget('')
    setShowAddCategory(false)
    await saveBudget(updated)
  }

  const totalBudget = budget?.categories.reduce((sum, c) => sum + c.budget, 0) ?? 0
  const totalUitgegeven = Object.values(uitgaven).reduce((sum, v) => sum + v, 0)
  const resterendBudget = totalBudget - totalUitgegeven
  const resterendInkomen = totalInkomen - totalBudget

  if (loading) return (
    <div className="rounded-2xl p-8 flex items-center justify-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
    </div>
  )

  if (!budget) return (
    <div className="rounded-2xl p-10 text-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-4xl mb-4">📊</p>
      <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Nog geen budget
      </h3>
      <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
        Fynn analyseert je transactiehistorie en maakt een persoonlijk budget.
      </p>
      <p className="text-xs mb-6 px-6" style={{ color: 'var(--muted)' }}>
        Gebaseerd op: je gemiddelde uitgaven per categorie, je inkomen, en een gezonde spaarquote van minimaal 10%.
      </p>
      <button
        onClick={generateBudget}
        disabled={generating}
        className="px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        {generating ? '✨ Budget genereren...' : '✨ Genereer mijn budget'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Overzicht header */}
      <div className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Maandbudget {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Gebaseerd op je transactiehistorie · Klik op een bedrag om aan te passen
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <p className="text-xs" style={{ color: 'var(--muted)' }}>Opslaan...</p>}
            <button
              onClick={generateBudget}
              disabled={generating}
              className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {generating ? '...' : '↻ Hergeneer'}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Inkomen</p>
            <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              €{totalInkomen.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Ingepland</p>
            <p className="text-lg font-bold" style={{
              color: totalBudget > totalInkomen ? '#EF4444' : 'var(--text)'
            }}>
              €{totalBudget.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
              {resterendInkomen >= 0 ? 'Vrij te besteden' : 'Over budget'}
            </p>
            <p className="text-lg font-bold" style={{
              color: resterendInkomen < 0 ? '#EF4444' : resterendInkomen < 100 ? '#F59E0B' : '#1A3A2A'
            }}>
              €{Math.abs(resterendInkomen).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Waarschuwing als budget hoger dan inkomen */}
        {totalBudget > totalInkomen && (
          <div className="mt-3 rounded-xl p-3 text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ Je budget (€{totalBudget.toFixed(0)}) is hoger dan je inkomen (€{totalInkomen.toFixed(0)}). Pas de bedragen aan.
          </div>
        )}
      </div>

      {/* Maand voortgang */}
      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                Voortgang deze maand
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                €{totalUitgegeven.toFixed(0)} uitgegeven van €{totalBudget.toFixed(0)} budget
              </p>
            </div>
            <p className="text-sm font-semibold" style={{
              color: resterendBudget < 0 ? '#EF4444' : resterendBudget < 200 ? '#F59E0B' : '#1A3A2A'
            }}>
              {resterendBudget >= 0 ? `€${resterendBudget.toFixed(0)} over` : `€${Math.abs(resterendBudget).toFixed(0)} te veel`}
            </p>
          </div>
        </div>

        {/* Categorieën */}
        <div>
          {budget.categories.map((cat, i) => {
            const spent = uitgaven[cat.category] ?? 0
            const pct = cat.budget > 0 ? Math.min((spent / cat.budget) * 100, 100) : 0
            const overBudget = spent > cat.budget
            const almostOver = !overBudget && pct > 80
            const isEditing = editingId === cat.category

            return (
              <div key={cat.category} className="px-5 py-4 group"
                style={{ borderBottom: i < budget.categories.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-lg">{cat.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {cat.category}
                      </p>
                      {overBudget && (
                        <p className="text-xs font-medium" style={{ color: '#EF4444' }}>
                          ⚠️ €{(spent - cat.budget).toFixed(0)} over budget
                        </p>
                      )}
                      {almostOver && (
                        <p className="text-xs" style={{ color: '#F59E0B' }}>
                          Bijna op — nog €{(cat.budget - spent).toFixed(0)}
                        </p>
                      )}
                      {cat.tip && !overBudget && !almostOver && (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {cat.tip}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        €{spent.toFixed(0)} /&nbsp;
                      </span>
                      {isEditing ? (
                        <input
                          type="number"
                          defaultValue={cat.budget ?? 0}
                          autoFocus
                          onBlur={e => updateBudgetAmount(cat.category, parseFloat(e.target.value) || cat.budget)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateBudgetAmount(cat.category, parseFloat((e.target as HTMLInputElement).value) || cat.budget)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className="w-20 text-right text-sm font-semibold rounded-lg px-2 py-1 outline-none"
                          style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--brand)' }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingId(cat.category)}
                          className="text-sm font-semibold hover:underline underline-offset-2"
                          style={{ color: 'var(--text)' }}
                          title="Klik om aan te passen"
                        >
                          €{(cat.budget ?? 0).toFixed(0)}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => removeCategory(cat.category)}
                      className="opacity-0 group-hover:opacity-100 text-xs w-5 h-5 rounded-full flex items-center justify-center transition-opacity"
                      style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }}
                      title="Verwijder categorie"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="h-1.5 rounded-full overflow-hidden ml-7"
                  style={{ backgroundColor: 'var(--tab-bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: overBudget ? '#EF4444' : almostOver ? '#F59E0B' : '#1A3A2A'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Categorie toevoegen */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {showAddCategory ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Categorie (bijv. vakantie)"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>€</span>
                <input
                  type="number"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-xl pl-6 pr-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <button
                onClick={addCategory}
                className="px-3 py-2 rounded-xl text-sm text-white"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                ✓
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="text-sm flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--brand)' }}
            >
              <span className="text-lg leading-none">+</span>
              <span>Categorie toevoegen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}