// src/app/api/savings/detect/route.ts
// Detecteert periodieke overboekingen naar spaarrekeningen vanuit transactiehistorie.
// Geeft terug: welke IBANs, namen en maandbedragen.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// IBANs van bekende spaarproducten (ABN AMRO, Rabobank, etc.)
// We detecteren ook op beschrijving
const SAVINGS_KEYWORDS = [
  'spaarrekening', 'spaargeld', 'sparen', 'direct sparen',
  'groeirekening', 'kindertoekomst', 'jongerengroei',
  'deposito', 'vermogen',
]

interface SavingsTransfer {
  iban: string
  name: string
  amounts: number[]
  dates: string[]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal 6 maanden transacties op
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, description, transaction_date')
      .eq('user_id', user.id)
      .lt('amount', 0)  // alleen uitgaven
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ savings: [] })
    }

    // Filter op spaar-gerelateerde transacties
    const savingsTransactions = transactions.filter(tx => {
      const desc = tx.description?.toLowerCase() ?? ''
      return SAVINGS_KEYWORDS.some(kw => desc.includes(kw))
    })

    // Groepeer op IBAN (uit de beschrijving halen) of op genormaliseerde omschrijving
    const groups = new Map<string, SavingsTransfer>()

    for (const tx of savingsTransactions) {
      const desc = tx.description ?? ''
      const amount = Math.abs(Number(tx.amount ?? 0));
      if (!Number.isFinite(amount) || amount <= 0) continue;

      // Probeer IBAN te extraheren uit beschrijving
      const ibanMatch = desc.match(/\b(NL\d{2}[A-Z]{4}\d{10})\b/i)
      const iban = ibanMatch ? ibanMatch[1].toUpperCase() : ''

      // Naam bepalen: zoek "Naam:" of gebruik een fallback
      const nameMatch = desc.match(/naam:\s*([^\n]+)/i)
      const remiMatch = desc.match(/remi\/([^/]+)/i)
      let name = nameMatch?.[1]?.trim() ?? remiMatch?.[1]?.trim() ?? ''

      // Schoon de naam op
      name = name.replace(/\s+/g, ' ').trim().slice(0, 40)
      if (!name) {
        // Gebruik keyword als naam fallback
        const keyword = SAVINGS_KEYWORDS.find(kw => desc.toLowerCase().includes(kw))
        name = keyword ? keyword.charAt(0).toUpperCase() + keyword.slice(1) : 'Spaarrekening'
      }

      const key = iban || name.toLowerCase().slice(0, 20)

      if (!groups.has(key)) {
        groups.set(key, { iban, name, amounts: [], dates: [] })
      }
      groups.get(key)!.amounts.push(amount)
      groups.get(key)!.dates.push(tx.transaction_date)
    }

    // Filter: minimaal 2x voorkomen = recurring
    const result = Array.from(groups.values())
      .filter(g => g.amounts.length >= 2)
      .map(g => {
        const avgAmount = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length
        return {
          iban: g.iban,
          name: g.name,
          monthlyAmount: Math.round(avgAmount * 100) / 100,
          occurrences: g.amounts.length,
        }
      })
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)

    return NextResponse.json({ savings: result })

  } catch (error) {
    console.error('Savings detect error:', error)
    return NextResponse.json({ savings: [] })  // non-blocking: lege array bij fout
  }
}