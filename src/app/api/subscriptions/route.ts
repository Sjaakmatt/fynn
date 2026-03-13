// src/app/api/subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const from = sixMonthsAgo.toISOString().slice(0, 10)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('merchant_key, merchant_name, amount, transaction_date')
      .eq('user_id', user.id)
      .eq('category', 'abonnementen')
      .lt('amount', 0)
      .gte('transaction_date', from)
      .order('transaction_date', { ascending: false })
      .limit(2000)


    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ subscriptions: [], totaalPerMaand: 0 })
    }

    // Groepeer per merchant_key
    const grouped = new Map<string, { name: string; amounts: number[]; dates: string[] }>()

    for (const tx of transactions) {
      const key = tx.merchant_key ?? tx.merchant_name ?? 'onbekend'
      if (!grouped.has(key)) {
        grouped.set(key, { name: tx.merchant_name ?? key, amounts: [], dates: [] })
      }
      const g = grouped.get(key)!
      g.amounts.push(Math.abs(Number(tx.amount)))
      g.dates.push(tx.transaction_date)
    }

    // Split merchants die meerdere keren per maand betaald worden
    const splitGrouped = new Map<string, {
      name: string; amounts: number[]; dates: string[]; isSplit: boolean
    }>()

    for (const [key, g] of grouped) {
      // Groepeer per maand, sorteer per maand op datum
      const byMonth = new Map<string, { amount: number; date: string }[]>()
      for (let i = 0; i < g.dates.length; i++) {
        const month = g.dates[i].slice(0, 7)
        if (!byMonth.has(month)) byMonth.set(month, [])
        byMonth.get(month)!.push({ amount: g.amounts[i], date: g.dates[i] })
      }

      // Sorteer elke maand op datum
      for (const m of byMonth.values()) {
        m.sort((a, b) => a.date.localeCompare(b.date))
      }

      const maxPerMonth = Math.max(...Array.from(byMonth.values()).map(m => m.length))

      if (maxPerMonth <= 1) {
        splitGrouped.set(key, { ...g, isSplit: false })
      } else {
        // Split op positie: 1e betaling per maand vs 2e betaling per maand
        const first: { amount: number; date: string }[] = []
        const second: { amount: number; date: string }[] = []

        for (const month of byMonth.values()) {
          if (month[0]) first.push(month[0])
          if (month[1]) second.push(month[1])
        }

        if (first.length > 0 && second.length > 0) {
          // Sorteer descending op datum
          first.sort((a, b) => b.date.localeCompare(a.date))
          second.sort((a, b) => b.date.localeCompare(a.date))

          splitGrouped.set(`${key}_1`, {
            name: g.name,
            amounts: first.map(t => t.amount),
            dates: first.map(t => t.date),
            isSplit: true,
          })
          splitGrouped.set(`${key}_2`, {
            name: g.name,
            amounts: second.map(t => t.amount),
            dates: second.map(t => t.date),
            isSplit: true,
          })
        } else {
          splitGrouped.set(key, { ...g, isSplit: false })
        }
      }
    }

    // Bereken mediaan + cadans per abonnement
    const subscriptions = Array.from(splitGrouped.entries())
      .map(([key, g]) => {
        const sorted = [...g.amounts].sort((a, b) => a - b)
        const amount = sorted[Math.floor(sorted.length / 2)]
        const cadence = g.dates.length >= 2 ? detectCadence(g.dates) : 'maandelijks'
        const monthlyAmount = cadence === 'jaarlijks' ? amount / 12
          : cadence === 'kwartaal' ? amount / 3
          : amount

        return {
          key,
          name: g.name,
          amount,
          monthlyAmount,
          cadence,
          occurrences: g.dates.length,
          lastDate: g.dates[0],
          isSplit: g.isSplit,
          isActive: isActiveSubscription(g.dates, cadence),
        }
      })
      .filter(s => s.isActive && s.monthlyAmount >= 1)

    // Dedupliceer op naam — maar NOOIT gesplitste entries samenvoegen
    const deduped = new Map<string, typeof subscriptions[0]>()
    for (const sub of subscriptions) {
      const dedupKey = sub.isSplit ? sub.key : sub.name
      const existing = deduped.get(sub.name)

      if (sub.isSplit || !existing) {
        deduped.set(dedupKey, sub)
      } else {
        const diff = Math.abs(sub.monthlyAmount - existing.monthlyAmount) / existing.monthlyAmount
        if (diff > 0.10) {
          deduped.set(`${sub.name}_alt`, sub)
        } else if (sub.monthlyAmount > existing.monthlyAmount) {
          deduped.set(sub.name, sub)
        }
      }
    }

    const finalSubscriptions = Array.from(deduped.values())
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
      .map(({ key, isSplit, ...rest }) => rest)

    const totaalPerMaand = finalSubscriptions.reduce((s, sub) => s + sub.monthlyAmount, 0)

    return NextResponse.json({ subscriptions: finalSubscriptions, totaalPerMaand })

  } catch (error) {
    console.error('Subscriptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function detectCadence(dates: string[]): 'maandelijks' | 'kwartaal' | 'jaarlijks' {
  if (dates.length < 2) return 'maandelijks'
  const sorted = [...dates].sort()
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round(
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
    )
    intervals.push(days)
  }
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  if (avg > 300) return 'jaarlijks'
  if (avg > 60) return 'kwartaal'
  return 'maandelijks'
}

function isActiveSubscription(
  dates: string[],
  cadence: 'maandelijks' | 'kwartaal' | 'jaarlijks'
): boolean {
  if (dates.length === 0) return false
  const last = new Date(dates[0])
  const daysSince = Math.round((Date.now() - last.getTime()) / 86400000)
  const threshold = cadence === 'jaarlijks' ? 400
    : cadence === 'kwartaal' ? 110
    : 45
  return daysSince <= threshold
}