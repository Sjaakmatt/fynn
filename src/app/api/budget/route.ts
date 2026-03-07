// src/app/api/ai/budget/route.ts
// Budget API — deterministisch voor cijfers, AI alleen voor tips
// Fix: recurring merchants als floor zodat hypotheek/energie niet te laag uitvalt

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

const CATEGORY_ICONS: Record<string, string> = {
  'wonen': '🏠', 'boodschappen': '🛒', 'eten & drinken': '🍽️',
  'transport': '🚆', 'abonnementen': '📱', 'kleding': '👕',
  'gezondheid': '💊', 'entertainment': '🎬', 'sparen': '💰',
  'beleggen': '📈', 'overig': '📦',
}

const MAX_MONTHS_DATA = 6
const MIN_SAVINGS_RATE = 0.10

// ─── HELPERS ──────────────────────────────────────────────

/** Bereken maandelijks inkomen via merchant_map income_hint (zelfde als decision engine) */
async function getMonthlyIncome(userId: string, supabase: any): Promise<{ amount: number; salaryDay: number }> {
  const { data: incomeMap } = await supabase
    .from('merchant_map')
    .select('merchant_key')
    .eq('income_hint', true)

  if (!incomeMap || incomeMap.length === 0) return { amount: 0, salaryDay: 25 }

  const cutoff = monthsAgo(MAX_MONTHS_DATA)

  const { data: incomeTx } = await supabase
    .from('transactions')
    .select('merchant_key, amount, transaction_date')
    .eq('user_id', userId)
    .gt('amount', 0)
    .gte('transaction_date', cutoff)
    .in('merchant_key', incomeMap.map((i: any) => i.merchant_key))

  if (!incomeTx || incomeTx.length === 0) return { amount: 0, salaryDay: 25 }

  const groups = new Map<string, { amounts: number[]; days: number[] }>()
  for (const tx of incomeTx) {
    if (!groups.has(tx.merchant_key)) groups.set(tx.merchant_key, { amounts: [], days: [] })
    const g = groups.get(tx.merchant_key)!
    g.amounts.push(Number(tx.amount))
    g.days.push(new Date(tx.transaction_date).getDate())
  }

  let totalMonthly = 0
  let earliestDay = 31

  for (const g of groups.values()) {
    const sortedAmounts = [...g.amounts].sort((a, b) => a - b)
    const sortedDays = [...g.days].sort((a, b) => a - b)
    totalMonthly += sortedAmounts[Math.floor(sortedAmounts.length / 2)]
    const day = sortedDays[Math.floor(sortedDays.length / 2)]
    if (day < earliestDay) earliestDay = day
  }

  return { amount: totalMonthly, salaryDay: earliestDay }
}

/**
 * Bereken recurring floor per categorie.
 * = som van mediaan bedragen van alle recurring merchants in die categorie.
 * Dit is het minimum dat je budget moet zijn voor die categorie.
 */
async function getRecurringFloorByCategory(userId: string, supabase: any): Promise<Record<string, number>> {
  const { data: merchantMap } = await supabase
    .from('merchant_map')
    .select('merchant_key, merchant_name, category')
    .eq('recurring_hint', true)
    .or('is_variable.is.null,is_variable.eq.false')

  if (!merchantMap || merchantMap.length === 0) return {}

  const { data: overrides } = await supabase
    .from('merchant_user_overrides')
    .select('merchant_key, category, is_variable')
    .eq('user_id', userId)

  const overrideMap = new Map<string, { category?: string; is_variable?: boolean }>()
  for (const o of overrides ?? []) {
    overrideMap.set(o.merchant_key, o)
  }

  const recurringKeys = merchantMap
    .filter((m: any) => !overrideMap.get(m.merchant_key)?.is_variable)
    .map((m: any) => m.merchant_key)

  if (recurringKeys.length === 0) return {}

  const cutoff = monthsAgo(MAX_MONTHS_DATA)

  const { data: txs } = await supabase
    .from('transactions')
    .select('merchant_key, amount, category')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('transaction_date', cutoff)
    .in('merchant_key', recurringKeys)

  if (!txs || txs.length === 0) return {}

  const merchantAmounts = new Map<string, number[]>()
  for (const tx of txs) {
    if (!tx.merchant_key) continue
    if (!merchantAmounts.has(tx.merchant_key)) merchantAmounts.set(tx.merchant_key, [])
    merchantAmounts.get(tx.merchant_key)!.push(Math.abs(Number(tx.amount)))
  }

  const result: Record<string, number> = {}
  for (const [key, amounts] of merchantAmounts) {
    const sorted = [...amounts].sort((a, b) => a - b)
    const medianAmount = sorted[Math.floor(sorted.length / 2)]

    const override = overrideMap.get(key)
    const mapEntry = merchantMap.find((m: any) => m.merchant_key === key)
    const category = override?.category ?? mapEntry?.category ?? 'overig'

    if (category === 'inkomen') continue
    result[category] = (result[category] ?? 0) + medianAmount
  }

  return result
}

/** Bereken mediaan uitgaven per categorie per maand over de laatste N maanden */
async function getMedianSpendingByCategory(userId: string, supabase: any): Promise<Record<string, number>> {
  const cutoff = monthsAgo(MAX_MONTHS_DATA)

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, category, transaction_date')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('transaction_date', cutoff)
    .not('category', 'is', null)
    .not('category', 'eq', 'inkomen')

  if (!txs || txs.length === 0) return {}

  const monthlyByCategory = new Map<string, Map<string, number>>()
  for (const tx of txs) {
    const cat = tx.category ?? 'overig'
    const monthKey = tx.transaction_date.slice(0, 7)
    if (!monthlyByCategory.has(cat)) monthlyByCategory.set(cat, new Map())
    const catMap = monthlyByCategory.get(cat)!
    catMap.set(monthKey, (catMap.get(monthKey) ?? 0) + Math.abs(Number(tx.amount)))
  }

  const result: Record<string, number> = {}
  for (const [cat, monthMap] of monthlyByCategory) {
    const monthlyTotals = [...monthMap.values()].sort((a, b) => a - b)
    if (monthlyTotals.length === 0) continue
    result[cat] = monthlyTotals[Math.floor(monthlyTotals.length / 2)]
  }

  return result
}

/** Haal uitgaven huidige maand op */
async function getCurrentMonthSpending(userId: string, supabase: any): Promise<Record<string, number>> {
  const now = new Date()
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, category')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('transaction_date', startOfMonth)
    .not('category', 'is', null)

  const result: Record<string, number> = {}
  for (const tx of txs ?? []) {
    const cat = tx.category ?? 'overig'
    result[cat] = (result[cat] ?? 0) + Math.abs(Number(tx.amount))
  }
  return result
}

function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

// ─── GET — Budget + voortgang ophalen ──────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [budgetResult, income, spending] = await Promise.all([
      supabase.from('budgets').select('*').eq('user_id', user.id).single(),
      getMonthlyIncome(user.id, supabase),
      getCurrentMonthSpending(user.id, supabase),
    ])

    return NextResponse.json({
      budget: budgetResult.data,
      uitgavenDezeMaand: spending,
      totalInkomen: income.amount,
      salaryDay: income.salaryDay,
    })
  } catch (error) {
    console.error('Budget GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST — Budget genereren (deterministisch + AI tips) ───

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [income, medianSpending, recurringFloor] = await Promise.all([
      getMonthlyIncome(user.id, supabase),
      getMedianSpendingByCategory(user.id, supabase),
      getRecurringFloorByCategory(user.id, supabase),
    ])

    if (income.amount === 0) {
      return NextResponse.json({
        error: 'Geen inkomen gedetecteerd. Controleer of je salarisbetaling correct is gecategoriseerd.',
      }, { status: 400 })
    }

    // Bouw budget per categorie: max(mediaan, recurring floor)
    const allCategories = new Set([
      ...Object.keys(medianSpending),
      ...Object.keys(recurringFloor),
    ])

    const categories: Array<{ category: string; budget: number; icon: string; tip: string }> = []

    for (const cat of allCategories) {
      if (cat === 'inkomen' || cat === 'sparen') continue
      const median = medianSpending[cat] ?? 0
      const floor = recurringFloor[cat] ?? 0
      const budgetAmount = Math.round(Math.max(median, floor))
      if (budgetAmount < 5) continue
      categories.push({
        category: cat,
        budget: budgetAmount,
        icon: CATEGORY_ICONS[cat] ?? '📦',
        tip: '',
      })
    }

    categories.sort((a, b) => b.budget - a.budget)

    // Check totaal vs inkomen — schaal alleen variabele kosten
    const totalBeforeSavings = categories.reduce((s, c) => s + c.budget, 0)
    const minSavings = Math.round(income.amount * MIN_SAVINGS_RATE)
    const maxBudgetExSavings = income.amount - minSavings

    if (totalBeforeSavings > maxBudgetExSavings) {
      const fixedCategories = new Set(Object.keys(recurringFloor))
      const variableTotal = categories
        .filter(c => !fixedCategories.has(c.category))
        .reduce((s, c) => s + c.budget, 0)
      const fixedTotal = categories
        .filter(c => fixedCategories.has(c.category))
        .reduce((s, c) => s + c.budget, 0)

      const variableBudgetAvailable = maxBudgetExSavings - fixedTotal

      if (variableTotal > 0 && variableBudgetAvailable > 0) {
        const scaleFactor = Math.min(1, variableBudgetAvailable / variableTotal)
        for (const cat of categories) {
          if (!fixedCategories.has(cat.category)) {
            cat.budget = Math.round(cat.budget * scaleFactor)
          }
        }
      } else if (variableBudgetAvailable <= 0) {
        // Vaste lasten alleen al meer dan inkomen - sparen
        // Verwijder variabele categorieën, ze passen niet
        const fixed = categories.filter(c => fixedCategories.has(c.category))
        categories.length = 0
        categories.push(...fixed)
      }
    }

    // Voeg sparen toe
    const totalAllocated = categories.reduce((s, c) => s + c.budget, 0)
    const savingsAmount = Math.max(minSavings, income.amount - totalAllocated)

    categories.push({
      category: 'sparen',
      budget: Math.round(savingsAmount),
      icon: '💰',
      tip: '',
    })

    // Genereer tips via AI (mag falen)
    try {
      const budgetSummary = categories
        .map(c => `${c.category}: €${c.budget}`)
        .join(', ')

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Je bent Fynn, een financiële coach. Geef voor elk budget-categorie één korte, praktische tip (max 10 woorden per tip).

Inkomen: €${income.amount.toFixed(0)}/maand
Budget: ${budgetSummary}

Geef je antwoord als JSON object met categorie als key en tip als value. Alleen de JSON, niets anders.
Voorbeeld: {"wonen": "Check je energiecontract jaarlijks", "boodschappen": "Weekmenu bespaart gemiddeld 20%"}`
        }]
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const tips: Record<string, string> = JSON.parse(cleaned)
      for (const cat of categories) {
        if (tips[cat.category]) cat.tip = tips[cat.category]
      }
    } catch {
      // Tips zijn nice-to-have
    }

    // Opslaan
    await supabase.from('budgets').upsert({
      user_id: user.id,
      categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      success: true,
      categories,
      totalInkomen: income.amount,
    })
  } catch (error) {
    console.error('Budget POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH — Budget handmatig aanpassen ─────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { categories } = await request.json()
    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: 'categories moet een array zijn' }, { status: 400 })
    }

    const { error } = await supabase.from('budgets').upsert({
      user_id: user.id,
      categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Budget PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}