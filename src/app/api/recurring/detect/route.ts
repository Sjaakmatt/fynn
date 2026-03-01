// src/app/api/recurring/detect/route.ts
//
// Detecteert vaste lasten en inkomen op basis van transactiehistorie.
// Wordt aangeroepen na elke bank sync (in de callback route).
// Werkt voor Enable Banking én toekomstige providers — puur op transactiedata.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransaction } from '@/lib/categorize-engine'

// Minimale variantie om als "consistent" te gelden (15%)
const VARIANCE_THRESHOLD = 0.15

// Minimaal 2x voorkomen om als recurring te tellen
const MIN_OCCURRENCES = 2

function normalizeKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\d{6,}/g, '#')        // lange nummers → placeholder (referenties, klantnummers)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal alle transacties op van de afgelopen 6 maanden
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, description, amount, transaction_date, category')
      .eq('user_id', user.id)
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('transaction_date', { ascending: true })

    if (error) throw error
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'Geen transacties gevonden', detected: 0 })
    }

    // Groepeer op genormaliseerde description
    // Aparte groepen voor inkomsten (positief) en uitgaven (negatief)
    const groups = new Map<string, typeof transactions>()

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount)
      const direction = amount > 0 ? 'in' : 'out'
      const key = `${direction}::${normalizeKey(tx.description ?? '')}`

      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(tx)
    }

    // Detecteer recurring patronen
    const recurringItems: {
      user_id: string
      description: string
      amount: number
      category: string
      day_of_month: number
      confidence: number
      last_seen: string
    }[] = []

    for (const [, txs] of groups) {
      if (txs.length < MIN_OCCURRENCES) continue

      const amounts = txs.map(t => Math.abs(parseFloat(t.amount)))
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length

      // Check of bedragen consistent zijn
      const isConsistent = amounts.every(a => Math.abs(a - avg) / avg < VARIANCE_THRESHOLD)
      if (!isConsistent) continue

      const isIncome = parseFloat(txs[0].amount) > 0
      const sortedDates = txs.map(t => t.transaction_date).sort()
      const lastDate = sortedDates[sortedDates.length - 1]
      const dayOfMonth = parseInt(lastDate.split('-')[2])

      // Confidence op basis van aantal keer gezien
      const confidence = txs.length >= 6 ? 0.99
        : txs.length >= 4 ? 0.95
        : txs.length === 3 ? 0.85
        : 0.70

      const finalAmount = Math.round(avg * 100) / 100

      recurringItems.push({
        user_id: user.id,
        description: txs[txs.length - 1].description?.slice(0, 255) ?? '',
        amount: isIncome ? finalAmount : -finalAmount,
        category: isIncome
          ? 'inkomen'
          : (txs[txs.length - 1].category ?? categorizeTransaction(txs[txs.length - 1].description ?? '', -finalAmount)),
        day_of_month: dayOfMonth,
        confidence,
        last_seen: lastDate,
      })
    }

    // Vervang alle recurring items voor deze user
    await supabase
      .from('recurring_items')
      .delete()
      .eq('user_id', user.id)

    if (recurringItems.length > 0) {
      const { error: insertError } = await supabase
        .from('recurring_items')
        .insert(recurringItems)

      if (insertError) throw insertError
    }

    const incomeCount = recurringItems.filter(r => r.amount > 0).length
    const expenseCount = recurringItems.filter(r => r.amount < 0).length

    return NextResponse.json({
      success: true,
      detected: recurringItems.length,
      income: incomeCount,
      expenses: expenseCount,
    })

  } catch (error) {
    console.error('Recurring detect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}