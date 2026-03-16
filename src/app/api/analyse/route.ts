// src/app/api/analyse/route.ts
// Geeft uitgaven per categorie terug voor een opgegeven maand

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Categories that should never appear in the "Uitgaven per categorie" overview
const HIDDEN_EXPENSE_CATEGORIES = ['interne_overboeking', 'inkomen', 'toeslagen']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') // format: "2026-03"

    const today = new Date()
    let year: number
    let month: number

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split('-').map(Number)
      month -= 1 // JS months 0-indexed
    } else {
      year = today.getFullYear()
      month = today.getMonth()
    }

    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    const { data: txs, error } = await supabase
      .from('transactions')
      .select('id, description, merchant_name, amount, category, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .order('transaction_date', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Groepeer per categorie
    const byCategory: Record<string, { total: number; count: number }> = {}
    let totalUitgaven = 0
    let totalInkomen = 0

    for (const tx of txs ?? []) {
      const amount = Number(tx.amount ?? 0)
      if (!Number.isFinite(amount)) continue
      const cat = tx.category ?? 'overig'

      if (amount < 0) {
        // Skip hidden categories — these are not real expenses
        if (HIDDEN_EXPENSE_CATEGORIES.includes(cat)) continue

        if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
        byCategory[cat].total += Math.abs(amount)
        byCategory[cat].count += 1
        if (cat !== 'sparen') totalUitgaven += Math.abs(amount)
      } else {
        totalInkomen += amount
      }
    }

    const sortedCategories = Object.entries(byCategory)
      .filter(([cat]) => cat !== 'sparen')
      .sort((a, b) => b[1].total - a[1].total)

    return NextResponse.json({
      month: monthParam ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      startOfMonth,
      endOfMonth,
      sortedCategories,
      totalUitgaven,
      totalInkomen,
    })
  } catch (error) {
    console.error('Analyse error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}