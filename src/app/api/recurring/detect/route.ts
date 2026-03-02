// src/app/api/recurring/detect/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransaction } from '@/lib/categorize-engine'
import { cleanDescription } from '@/lib/clean-description'

// ─── INTERNE TRANSFER DETECTIE ───────────────────────────────────────────────
// Overboekingen tussen eigen rekeningen zijn geen inkomen.
// Herkenbaar aan: SEPA Overboeking/Periodieke overb. + eigen IBAN of eigen naam.

const INTERNAL_TRANSFER_SIGNALS = [
  'salarisrekening',        // ABN AMRO interne overboeking label
  'spaarrekening',          // overboeking naar/van spaarrekening
  'maandelijks spaargeld',
  'zakgeld',
  'boodschappen',           // eigen budgetrekening
  'gezamenlijke',
  'kindertoekomst',
  'jongerengroeirekening',
  'eigen rekening',
]

function isInternalTransfer(description: string): boolean {
  const d = description.toLowerCase()
  // Periodieke overboekingen zijn bijna altijd intern
  if (d.includes('sepa periodieke overb')) return true
  // Check op bekende interne labels
  return INTERNAL_TRANSFER_SIGNALS.some(signal => d.includes(signal))
}

// ─── SALARIS CLUSTERING ──────────────────────────────────────────────────────
// Groepeert transacties die waarschijnlijk hetzelfde salaris zijn:
// - Bedrag binnen 10% van elkaar
// - Dag van de maand binnen 7 dagen van elkaar
// - Altijd positief (inkomst)

function clusterSalary(
  groups: Map<string, { amount: number; date: string }[]>
): { amount: number; date: string }[][] {
  const allGroups = Array.from(groups.values()).filter(g => g.length >= 2)
  const clusters: { amount: number; date: string }[][] = []
  const used = new Set<number>()

  for (let i = 0; i < allGroups.length; i++) {
    if (used.has(i)) continue

    const cluster = [...allGroups[i]]
    const avgAmount = cluster.reduce((s, t) => s + t.amount, 0) / cluster.length

    // Zoek vergelijkbare groepen om samen te voegen
    for (let j = i + 1; j < allGroups.length; j++) {
      if (used.has(j)) continue
      const other = allGroups[j]
      const otherAvg = other.reduce((s, t) => s + t.amount, 0) / other.length

      // Binnen 10% bedrag EN binnen 7 dagen
      const amountSimilar = Math.abs(avgAmount - otherAvg) / avgAmount < 0.10
      const avgDay = (d: { date: string }[]) =>
        d.reduce((s, t) => s + parseInt(t.date.split('-')[2]), 0) / d.length
      const daySimilar = Math.abs(avgDay(cluster) - avgDay(other)) <= 7

      if (amountSimilar && daySimilar) {
        cluster.push(...other)
        used.add(j)
      }
    }

    used.add(i)
    clusters.push(cluster)
  }

  return clusters
}

// ─── MAIN ROUTE ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal transacties op van afgelopen 6 maanden
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
      return NextResponse.json({ message: 'Geen transacties', detected: 0 })
    }

    // ── STAP 1: Groepeer uitgaven op genormaliseerde description ─────
    const expenseGroups = new Map<string, typeof transactions>()

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount)
      if (amount >= 0) continue   // alleen uitgaven hier

      const key = tx.description
        ?.toLowerCase()
        .replace(/\d{6,}/g, '#')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) ?? ''

      if (!expenseGroups.has(key)) expenseGroups.set(key, [])
      expenseGroups.get(key)!.push(tx)
    }

    // ── STAP 2: Groepeer inkomsten apart ─────────────────────────────
    // Voor inkomen gebruiken we ruimere matching — bedrag mag ±15% afwijken
    const incomeRaw = transactions.filter(tx => parseFloat(tx.amount) > 0)

    // Groepeer inkomen op genormaliseerde description (zelfde logica)
    const incomeGroups = new Map<string, { amount: number; date: string }[]>()

    for (const tx of incomeRaw) {
      const amount = parseFloat(tx.amount)

      // Skip interne transfers
      if (isInternalTransfer(tx.description ?? '')) continue

      const key = tx.description
        ?.toLowerCase()
        .replace(/\d{6,}/g, '#')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) ?? ''

      if (!incomeGroups.has(key)) incomeGroups.set(key, [])
      incomeGroups.get(key)!.push({ amount, date: tx.transaction_date })
    }

    // ── STAP 3: Cluster salaris (zelfde bron, wisselend bedrag/dag) ──
    const incomeClusters = clusterSalary(incomeGroups)

    // ── STAP 4: Bouw recurring items ─────────────────────────────────
    const recurringItems: {
      user_id: string
      description: string
      amount: number
      category: string
      day_of_month: number
      confidence: number
      last_seen: string
    }[] = []

    // Vaste UITGAVEN
    for (const [, txs] of expenseGroups) {
      if (txs.length < 2) continue

      const amounts = txs.map(t => Math.abs(parseFloat(t.amount)))
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const consistent = amounts.every(a => Math.abs(a - avg) / avg < 0.15)
      if (!consistent) continue

      const sortedDates = txs.map(t => t.transaction_date).sort()
      const lastDate = sortedDates[sortedDates.length - 1]
      const dayOfMonth = parseInt(lastDate.split('-')[2])

      recurringItems.push({
        user_id: user.id,
        description: cleanDescription(txs[txs.length - 1].description ?? '').slice(0, 255),
        amount: -(Math.round(avg * 100) / 100),
        category: txs[txs.length - 1].category
          ?? categorizeTransaction(txs[txs.length - 1].description ?? '', -avg),
        day_of_month: dayOfMonth,
        confidence: txs.length >= 6 ? 0.99 : txs.length >= 4 ? 0.95 : txs.length === 3 ? 0.85 : 0.70,
        last_seen: lastDate,
      })
    }

    // Vaste INKOMSTEN (geclusterd)
    for (const cluster of incomeClusters) {
      if (cluster.length < 2) continue

      const amounts = cluster.map(t => t.amount)
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length

      // Mediane dag — robuuster dan gemiddelde bij weekend-verschuivingen
      const days = cluster.map(t => parseInt(t.date.split('-')[2])).sort((a, b) => a - b)
      const medianDay = days[Math.floor(days.length / 2)]

      const sortedDates = cluster.map(t => t.date).sort()
      const lastDate = sortedDates[sortedDates.length - 1]

      // Gebruik de meest recente description uit de cluster
      const lastTx = transactions
        .filter(tx => parseFloat(tx.amount) > 0)
        .filter(tx => !isInternalTransfer(tx.description ?? ''))
        .find(tx => tx.transaction_date === lastDate)

      recurringItems.push({
        user_id: user.id,
        description: lastTx ? cleanDescription(lastTx.description ?? '').slice(0, 255) : 'Inkomen',
        amount: Math.round(avg * 100) / 100,
        category: 'inkomen',
        day_of_month: medianDay,
        confidence: cluster.length >= 6 ? 0.99 : cluster.length >= 4 ? 0.95 : cluster.length === 3 ? 0.85 : 0.70,
        last_seen: lastDate,
      })
    }

    // ── STAP 5: Opslaan ──────────────────────────────────────────────
    await supabase.from('recurring_items').delete().eq('user_id', user.id)

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