// src/app/api/analyse/route.ts
// Geeft uitgaven per categorie terug voor een opgegeven maand
// Category wordt LIVE berekend via resolveCategory (merchant_map + overrides + rule engine)
// NOOIT via tx.category — dat is een stale cache.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveCategory, buildCategoryMaps } from '@/lib/resolve-category'

const HIDDEN_EXPENSE_CATEGORIES = ['interne_overboeking', 'inkomen', 'toeslagen']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')

    const today = new Date()
    let year: number
    let month: number

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split('-').map(Number)
      month -= 1
    } else {
      year = today.getFullYear()
      month = today.getMonth()
    }

    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    const [{ data: txs, error }, { data: merchantMapRows }, { data: userOverrideRows }, { data: userAccounts }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, description, merchant_key, merchant_name, amount, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', startOfMonth)
        .lte('transaction_date', endOfMonth)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('merchant_map')
        .select('merchant_key, category')
        .not('category', 'is', null),
      supabase
        .from('merchant_user_overrides')
        .select('merchant_key, category')
        .eq('user_id', user.id)
        .not('category', 'is', null),
      supabase
        .from('bank_accounts')
        .select('iban')
        .eq('user_id', user.id)
        .not('iban', 'is', null),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userIbans = (userAccounts ?? []).map(a => a.iban).filter(Boolean)
    const maps = buildCategoryMaps(merchantMapRows, userOverrideRows, userIbans)

    const byCategory: Record<string, { total: number; count: number }> = {}
    let totalUitgaven = 0
    let totalInkomen = 0

    for (const tx of txs ?? []) {
      const amount = Number(tx.amount ?? 0)
      if (!Number.isFinite(amount)) continue
      const cat = resolveCategory(tx, maps)

      if (amount < 0) {
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