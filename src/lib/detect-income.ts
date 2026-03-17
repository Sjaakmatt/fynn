// src/lib/detect-income.ts
// Kernlogica voor recurring income detectie.
// Geëxtraheerd uit api/sync/income zodat het direct callable is.

import { SupabaseClient } from '@supabase/supabase-js'

type TxRow = {
  merchant_key: string | null
  merchant_name: string | null
  amount: string | number | null
  transaction_date: string | null
}

export interface IncomeResult {
  income: { merchant_key: string; merchant_name: string; score: number; typical_amount: number; typical_day: number }[]
  updated: number
  deactivated: number
}

function num(x: string | number | null): number {
  const n = Number(x ?? 0)
  return Number.isFinite(n) ? n : 0
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((db - da) / 86400000)
}

function cadenceFit(intervals: number[]): number {
  if (intervals.length === 0) return 0
  const m = median(intervals)
  const within = intervals.filter(d => Math.abs(d - 30) <= 5).length / intervals.length
  const distScore = clamp01(1 - Math.abs(m - 30) / 10)
  return clamp01(0.7 * within + 0.3 * distScore)
}

function amountStability(amounts: number[]): number {
  if (amounts.length < 2) return 0
  const m = median(amounts)
  if (m <= 0) return 0
  const deviations = amounts.map(a => Math.abs(a - m) / m)
  return clamp01(1 - median(deviations) / 0.3)
}

function dayStability(days: number[]): number {
  if (days.length < 2) return 0
  const m = median(days)
  const dev = median(days.map(d => Math.abs(d - m)))
  return clamp01(1 - dev / 7)
}

export async function detectIncome(
  supabase: SupabaseClient,
  userId: string,
): Promise<IncomeResult> {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
    .toISOString()
    .slice(0, 10)

  // 1) Positieve transacties ophalen
  const { data, error } = await supabase
    .from('transactions')
    .select('merchant_key, merchant_name, amount, transaction_date')
    .eq('user_id', userId)
    .gt('amount', 0)
    .gte('transaction_date', from)
    .not('merchant_key', 'is', null)
    .order('transaction_date', { ascending: true })
    .limit(3000)

  if (error) throw new Error(error.message)

  const txs = (data ?? []) as TxRow[]
  if (txs.length === 0) return { income: [], updated: 0, deactivated: 0 }

  // 2) Groepeer per merchant_key
  const byKey = new Map<string, TxRow[]>()
  for (const t of txs) {
    const k = t.merchant_key!
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(t)
  }

  // 3) Detecteer recurring inkomen
  const incomeItems: IncomeResult['income'] = []

  for (const [k, rows] of byKey) {
    if (rows.length < 2) continue

    const dates = rows
      .map(r => r.transaction_date)
      .filter((d): d is string => !!d && d.length >= 10)

    if (dates.length < 2) continue

    const amounts = rows.map(r => Math.abs(num(r.amount)))
    const days = dates.map(d => Number(d.slice(8, 10))).filter(x => x >= 1 && x <= 31)

    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const d = daysBetween(dates[i - 1], dates[i])
      if (d > 0 && d < 400) intervals.push(d)
    }

    const fitScore = cadenceFit(intervals)
    const amtScore = amountStability(amounts)
    const dayScore = dayStability(days)
    const occScore = clamp01((rows.length - 2) / 6)

    const score = clamp01(0.40 * fitScore + 0.35 * amtScore + 0.15 * dayScore + 0.10 * occScore)
    if (score < 0.55) continue

    incomeItems.push({
      merchant_key: k,
      merchant_name: rows[rows.length - 1].merchant_name ?? 'Onbekend',
      score,
      typical_amount: Math.round(median(amounts) * 100) / 100,
      typical_day: Math.round(median(days)) || 1,
    })
  }

  // 4) Schrijf naar merchant_map
  let updated = 0
  if (incomeItems.length > 0) {
    const { error: mmErr } = await supabase
      .from('merchant_map')
      .upsert(
        incomeItems.map(i => ({
          merchant_key: i.merchant_key,
          merchant_name: i.merchant_name,
          income_hint: true,
          confidence: Math.max(0.2, Math.min(0.95, i.score)),
          source: 'income_detector',
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'merchant_key' }
      )

    if (mmErr) throw new Error(mmErr.message)
    updated = incomeItems.length
  }

  // 5) Deactiveer inkomen dat >60 dagen niet meer gezien is
  const activeKeys = new Set(incomeItems.map(i => i.merchant_key))

  const { data: currentIncome } = await supabase
    .from('merchant_map')
    .select('merchant_key')
    .eq('income_hint', true)

  const inactiveKeys = (currentIncome ?? [])
    .map(r => r.merchant_key)
    .filter(k => !activeKeys.has(k))

  let deactivated = 0
  if (inactiveKeys.length > 0) {
    const { data: lastSeenRows } = await supabase
      .from('transactions')
      .select('merchant_key, transaction_date')
      .eq('user_id', userId)
      .in('merchant_key', inactiveKeys)
      .gt('amount', 0)
      .order('transaction_date', { ascending: false })

    const lastSeenByKey = new Map<string, string>()
    for (const row of lastSeenRows ?? []) {
      if (!lastSeenByKey.has(row.merchant_key)) {
        lastSeenByKey.set(row.merchant_key, row.transaction_date)
      }
    }

    const toDeactivate: string[] = []
    const cutoff = now.toISOString().slice(0, 10)
    for (const k of inactiveKeys) {
      const last = lastSeenByKey.get(k)
      if (!last || daysBetween(last, cutoff) > 60) {
        toDeactivate.push(k)
      }
    }

    if (toDeactivate.length > 0) {
      const { data: otherUserTxs } = await supabase
        .from('transactions')
        .select('merchant_key')
        .in('merchant_key', toDeactivate)
        .gt('amount', 0)
        .neq('user_id', userId)
        .gte('transaction_date', from)
        .limit(1)

      const stillActiveElsewhere = new Set(
        (otherUserTxs ?? []).map((r: any) => r.merchant_key)
      )

      const safeToDeactivate = toDeactivate.filter(k => !stillActiveElsewhere.has(k))

      if (safeToDeactivate.length > 0) {
        await supabase
          .from('merchant_map')
          .update({ income_hint: false, updated_at: new Date().toISOString() })
          .in('merchant_key', safeToDeactivate)

        deactivated = safeToDeactivate.length
      }
    }
  }

  incomeItems.sort((a, b) => b.score - a.score)

  return { income: incomeItems, updated, deactivated }
}