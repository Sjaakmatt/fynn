// src/app/api/subscriptions/route.ts
// Detecteert ALLE terugkerende kosten — één uniforme lijst.
// Gebruikt: transactions.category (cached), merchant_map recurring_hint,
// transactie frequentie-analyse, en merchant_cancellations voor opzegbaarheid.
//
// Geen split meer in "abonnementen vs vaste lasten" — users willen één overzicht.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Categorieën die nooit als vaste last geteld worden
const EXCLUDE_CATEGORIES = ['inkomen', 'interne_overboeking', 'toeslagen', 'sparen']

// Categorieën die als "opzegbaar abonnement" tellen
const SUBSCRIPTION_CATEGORIES = ['abonnementen']

// Categorieën die als "contract/vast" tellen (niet opzegbaar via Fynn)
const CONTRACT_CATEGORIES = ['wonen', 'verzekering', 'schulden', 'kinderopvang']

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const fromDate = twelveMonthsAgo.toISOString().slice(0, 10)

    // 1) Haal alle uitgaande transacties op (12 maanden)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('merchant_key, merchant_name, amount, transaction_date, category')
      .eq('user_id', user.id)
      .lt('amount', 0)
      .gte('transaction_date', fromDate)
      .not('merchant_key', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(5000)

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ items: [], totaalPerMaand: 0 })
    }

    // 2) Haal merchant_map op voor recurring_hint
    const merchantKeys = [...new Set(transactions.map(t => t.merchant_key).filter(Boolean))]
    const recurringHints = new Map<string, boolean>()

    for (let i = 0; i < merchantKeys.length; i += 500) {
      const batch = merchantKeys.slice(i, i + 500)
      const { data: mmRows } = await supabase
        .from('merchant_map')
        .select('merchant_key, recurring_hint')
        .in('merchant_key', batch)
      for (const m of mmRows ?? []) {
        if (m.recurring_hint) recurringHints.set(m.merchant_key, true)
      }
    }

    // 3) Haal merchant_cancellations op
    const { data: cancellations } = await supabase
      .from('merchant_cancellations')
      .select('merchant_key, cancel_method, difficulty')

    const cancelMap = new Map(
      (cancellations ?? []).map(c => [c.merchant_key, c])
    )

    // 4) Groepeer transacties per merchant_key
    const grouped = new Map<string, {
      name: string
      category: string
      amounts: number[]
      dates: string[]
      isRecurringHint: boolean
    }>()

    for (const tx of transactions) {
      const key = tx.merchant_key!
      const cat = tx.category ?? 'overig'

      if (EXCLUDE_CATEGORIES.includes(cat)) continue

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: tx.merchant_name ?? key,
          category: cat,
          amounts: [],
          dates: [],
          isRecurringHint: recurringHints.get(key) === true,
        })
      }
      const g = grouped.get(key)!
      g.amounts.push(Math.abs(Number(tx.amount)))
      g.dates.push(tx.transaction_date)
    }

    // 5) Detecteer recurring patronen
    const allItems: RecurringItem[] = []

    for (const [key, g] of grouped) {
      if (g.amounts.length < 3 && !g.isRecurringHint) continue
      if (g.amounts.length < 2) continue

      const sortedDates = [...g.dates].sort()
      const intervals: number[] = []
      for (let i = 1; i < sortedDates.length; i++) {
        const days = Math.round(
          (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000
        )
        if (days > 0) intervals.push(days)
      }

      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0

      let cadence: 'maandelijks' | 'kwartaal' | 'jaarlijks' | null = null
      if (avgInterval > 0 && avgInterval <= 45) cadence = 'maandelijks'
      else if (avgInterval > 45 && avgInterval <= 120) cadence = 'kwartaal'
      else if (avgInterval > 300 && g.amounts.length >= 2) cadence = 'jaarlijks'

      if (!cadence && !g.isRecurringHint) continue
      if (!cadence && g.isRecurringHint) cadence = 'maandelijks'

      // Bedrag consistentie
      const sorted = [...g.amounts].sort((a, b) => a - b)
      const medianAmount = sorted[Math.floor(sorted.length / 2)]
      const variance = sorted.length > 1
        ? Math.abs(sorted[sorted.length - 1] - sorted[0]) / medianAmount
        : 0

      // Hoge variatie en geen recurring hint → skip
      if (variance > 0.5 && !g.isRecurringHint) continue

      // Interval consistentie check (zonder recurring_hint)
      // Extra check: skip interval consistency voor bekende abonnementen
      if (!g.isRecurringHint && !SUBSCRIPTION_CATEGORIES.includes(g.category) && intervals.length >= 2) {
        const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const stdDev = Math.sqrt(intervals.reduce((sum, i) => sum + (i - avgInt) ** 2, 0) / intervals.length)
        if (avgInt > 0 && stdDev / avgInt > 0.4) continue
      }

      const monthlyAmount = cadence === 'jaarlijks' ? medianAmount / 12
        : cadence === 'kwartaal' ? medianAmount / 3
        : medianAmount

      if (monthlyAmount < 1) continue

      const lastDate = g.dates[0]
      if (!isActive(lastDate, cadence!)) continue

      // Bepaal type
      const cancelInfo = cancelMap.get(key)
      const isSubscription = SUBSCRIPTION_CATEGORIES.includes(g.category) || !!cancelInfo
      const isContract = CONTRACT_CATEGORIES.includes(g.category)

      let type: 'abonnement' | 'contract' | 'vast'
      if (isSubscription) type = 'abonnement'
      else if (isContract) type = 'contract'
      else type = 'vast'

      allItems.push({
        key,
        name: g.name,
        amount: medianAmount,
        monthlyAmount,
        cadence: cadence!,
        occurrences: g.dates.length,
        lastDate,
        category: g.category,
        type,
        canCancel: !!cancelInfo,
        cancelMethod: cancelInfo?.cancel_method ?? null,
        cancelDifficulty: cancelInfo?.difficulty ?? null,
      })
    }

    // 6) Sorteer: abonnementen eerst, dan op maandbedrag
    allItems.sort((a, b) => {
      const typeOrder = { abonnement: 0, contract: 1, vast: 2 }
      const typeDiff = typeOrder[a.type] - typeOrder[b.type]
      if (typeDiff !== 0) return typeDiff
      return b.monthlyAmount - a.monthlyAmount
    })

    const totaalPerMaand = allItems.reduce((s, i) => s + i.monthlyAmount, 0)
    const totaalAbonnementen = allItems.filter(i => i.type === 'abonnement').reduce((s, i) => s + i.monthlyAmount, 0)
    const totaalContracten = allItems.filter(i => i.type === 'contract').reduce((s, i) => s + i.monthlyAmount, 0)
    const totaalOverig = allItems.filter(i => i.type === 'vast').reduce((s, i) => s + i.monthlyAmount, 0)

    return NextResponse.json({
      items: allItems.map(cleanItem),
      totaalPerMaand,
      totaalAbonnementen,
      totaalContracten,
      totaalOverig,
    })

  } catch (error) {
    console.error('Subscriptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface RecurringItem {
  key: string
  name: string
  amount: number
  monthlyAmount: number
  cadence: 'maandelijks' | 'kwartaal' | 'jaarlijks'
  occurrences: number
  lastDate: string
  category: string
  type: 'abonnement' | 'contract' | 'vast'
  canCancel: boolean
  cancelMethod: string | null
  cancelDifficulty: string | null
}

function cleanItem(s: RecurringItem) {
  return {
    name: s.name,
    amount: s.amount,
    monthlyAmount: s.monthlyAmount,
    cadence: s.cadence,
    occurrences: s.occurrences,
    lastDate: s.lastDate,
    category: s.category,
    type: s.type,
    canCancel: s.canCancel,
    cancelMethod: s.cancelMethod,
    cancelDifficulty: s.cancelDifficulty,
  }
}

function isActive(lastDate: string, cadence: string): boolean {
  const last = new Date(lastDate)
  const daysSince = Math.round((Date.now() - last.getTime()) / 86400000)
  const threshold = cadence === 'jaarlijks' ? 400 : cadence === 'kwartaal' ? 130 : 50
  return daysSince <= threshold
}