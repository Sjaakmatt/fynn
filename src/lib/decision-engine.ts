// src/lib/decision-engine.ts
// Cashflow projection & recurring expense detection
// Gebruikt merchant_map als databron — geen eigen detectie logica
//
// ⚠️  Ontworpen voor duizenden gebruikers met diverse bank- en inkomenspatronen.
//     Geen aannames over specifieke salarisdagen, bedragen of banken.

import { SupabaseClient } from '@supabase/supabase-js'

export interface RecurringItem {
  description: string
  merchant_key: string
  amount: number
  category: string
  dayOfMonth: number
  confidence: number
  lastSeen: string
}

export interface CashflowProjection {
  currentBalance: number
  projectedFreeSpace: number
  salaryExpected: number
  salaryDate: number
  fixedExpensesThisMonth: number
  alreadyPaid: number
  stillToPay: number
  daysUntilSalary: number
  riskLevel: 'safe' | 'caution' | 'danger'
  signals: Signal[]
}

export interface Signal {
  type: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'danger'
  amount?: number
  date?: string
}

// ── RECURRING ITEMS ────────────────────────────────────────────

/**
 * Haal recurring items op uit merchant_map (niet zelf detecteren).
 * Respecteert user overrides (is_variable).
 * Gebruikt mediaan voor bedrag en dag — robuust tegen uitschieters.
 */
export async function detectRecurringItems(
  userId: string,
  supabase: SupabaseClient
): Promise<RecurringItem[]> {
  const threeMonthsAgo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  })()

  // Haal recurring merchants op
  const { data: merchantMap } = await supabase
    .from('merchant_map')
    .select('merchant_key, merchant_name, category')
    .eq('recurring_hint', true)
    .or('is_variable.is.null,is_variable.eq.false')

  if (!merchantMap || merchantMap.length === 0) return []

  // Haal user overrides op (sommige users markeren recurring als variabel)
  const { data: overrides } = await supabase
    .from('merchant_user_overrides')
    .select('merchant_key, is_variable')
    .eq('user_id', userId)

  const variableKeys = new Set(
    (overrides ?? []).filter(o => o.is_variable).map(o => o.merchant_key)
  )

  const recurringKeys = merchantMap
    .map(m => m.merchant_key)
    .filter(k => !variableKeys.has(k))

  if (recurringKeys.length === 0) return []

  // Haal transacties op voor deze merchants
  const { data: txs } = await supabase
    .from('transactions')
    .select('merchant_key, merchant_name, amount, transaction_date, category')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('transaction_date', threeMonthsAgo)
    .in('merchant_key', recurringKeys)
    .order('transaction_date', { ascending: false })

  if (!txs || txs.length === 0) return []

  // Groepeer per merchant_key
  const groups = new Map<string, {
    amounts: number[]
    days: number[]
    dates: string[]
    name: string
    category: string
  }>()

  for (const tx of txs) {
    const k = tx.merchant_key
    if (!k) continue
    if (!groups.has(k)) {
      const mapEntry = merchantMap.find(m => m.merchant_key === k)
      groups.set(k, {
        amounts: [],
        days: [],
        dates: [],
        name: mapEntry?.merchant_name ?? tx.merchant_name ?? k,
        category: mapEntry?.category ?? tx.category ?? 'overig',
      })
    }
    const g = groups.get(k)!
    g.amounts.push(Math.abs(Number(tx.amount)))
    g.days.push(new Date(tx.transaction_date).getDate())
    g.dates.push(tx.transaction_date)
  }

  const result: RecurringItem[] = []

  for (const [key, g] of groups) {
    if (g.amounts.length === 0) continue

    result.push({
      description: g.name,
      merchant_key: key,
      amount: median(g.amounts),
      category: g.category,
      dayOfMonth: median(g.days),
      confidence: 0.8,
      lastSeen: g.dates[0],
    })
  }

  return result.sort((a, b) => b.amount - a.amount)
}

// ── CASHFLOW PROJECTIE ─────────────────────────────────────────

/**
 * Projecteer cashflow voor de huidige maand.
 *
 * Accepteert optioneel pre-fetched recurringItems om N+1 queries te voorkomen
 * wanneer de caller al recurring items heeft opgehaald.
 */
export async function projectCashflow(
  userId: string,
  supabase: SupabaseClient,
  prefetchedRecurring?: RecurringItem[]
): Promise<CashflowProjection> {
  const today = new Date()
  const currentDay = today.getDate()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]

  // 1) Haal echt saldo op (alleen betaalrekeningen)
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('balance, account_type')
    .eq('user_id', userId)

  const currentBalance = (accounts ?? [])
    .filter(a => a.account_type !== 'SAVINGS')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)

  // 2) Detecteer inkomen uit merchant_map
  const { salaryDate, salaryExpected } = await detectIncome(userId, supabase, today)

  // 3) Recurring items — gebruik prefetched of haal op
  const recurringItems = prefetchedRecurring ?? await detectRecurringItems(userId, supabase)

  // 4) Al betaald deze maand (vaste lasten)
  const recurringKeys = recurringItems.map(r => r.merchant_key)

  const paidTx = recurringKeys.length > 0
    ? (await supabase
        .from('transactions')
        .select('merchant_key, amount')
        .eq('user_id', userId)
        .lt('amount', 0)
        .gte('transaction_date', startOfMonth)
        .in('merchant_key', recurringKeys)
      ).data ?? []
    : []

  const alreadyPaid = paidTx
    .reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0)

  const paidKeys = new Set(paidTx.map(tx => tx.merchant_key))

  // 5) Nog te betalen vóór salarisdatum
  //    Items die nog niet betaald zijn EN waarvan de verwachte dag
  //    vóór de salarisdatum valt (of vóór einde maand als salaris al geweest is)
  const effectiveDeadline = salaryDate >= currentDay
    ? salaryDate
    : 32 // einde maand — alle resterende items tellen mee

  const stillToPay = recurringItems
    .filter(r => !paidKeys.has(r.merchant_key) && r.dayOfMonth <= effectiveDeadline)
    .reduce((s, r) => s + r.amount, 0)

  const totalFixed = recurringItems.reduce((s, r) => s + r.amount, 0)

  // 6) Dagen tot salaris
  const daysUntilSalary = calculateDaysUntil(today, salaryDate)

  // 7) Vrije ruimte
  const projectedFreeSpace = currentBalance - stillToPay

  const riskLevel: CashflowProjection['riskLevel'] =
    projectedFreeSpace < 0 ? 'danger'
    : projectedFreeSpace < 200 ? 'caution'
    : 'safe'

  // 8) Signalen
  const signals = generateSignals({
    projectedFreeSpace,
    stillToPay,
    daysUntilSalary,
    recurringItems: recurringItems.filter(r => !paidKeys.has(r.merchant_key)),
    currentDay,
  })

  return {
    currentBalance,
    projectedFreeSpace,
    salaryExpected,
    salaryDate,
    fixedExpensesThisMonth: totalFixed,
    alreadyPaid,
    stillToPay,
    daysUntilSalary,
    riskLevel,
    signals,
  }
}

// ── INKOMEN DETECTIE ───────────────────────────────────────────

async function detectIncome(
  userId: string,
  supabase: SupabaseClient,
  today: Date
): Promise<{ salaryDate: number; salaryExpected: number }> {
  const { data: incomeMap } = await supabase
    .from('merchant_map')
    .select('merchant_key')
    .eq('income_hint', true)

  if (!incomeMap || incomeMap.length === 0) {
    return { salaryDate: 25, salaryExpected: 0 }
  }

  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    .toISOString().slice(0, 10)

  const incomeKeys = incomeMap.map(i => i.merchant_key)

  const { data: incomeTx } = await supabase
    .from('transactions')
    .select('merchant_key, amount, transaction_date')
    .eq('user_id', userId)
    .gt('amount', 0)
    .gte('transaction_date', threeMonthsAgo)
    .in('merchant_key', incomeKeys)

  if (!incomeTx || incomeTx.length === 0) {
    return { salaryDate: 25, salaryExpected: 0 }
  }

  // Groepeer per merchant, bereken mediaan dag en mediaan bedrag
  const incomeGroups = new Map<string, { amounts: number[]; days: number[] }>()
  for (const tx of incomeTx) {
    if (!incomeGroups.has(tx.merchant_key)) {
      incomeGroups.set(tx.merchant_key, { amounts: [], days: [] })
    }
    const g = incomeGroups.get(tx.merchant_key)!
    g.amounts.push(Number(tx.amount))
    g.days.push(new Date(tx.transaction_date).getDate())
  }

  const incomeSources = Array.from(incomeGroups.values()).map(g => ({
    amount: median(g.amounts),
    day: median(g.days),
  }))

  // Vroegste salarisdatum als "volgende salaris" referentie
  const salaryDate = Math.min(...incomeSources.map(s => s.day))
  const salaryExpected = incomeSources.reduce((s, i) => s + i.amount, 0)

  return { salaryDate, salaryExpected }
}

// ── SIGNALEN ───────────────────────────────────────────────────

function generateSignals(data: {
  projectedFreeSpace: number
  stillToPay: number
  daysUntilSalary: number
  recurringItems: RecurringItem[]
  currentDay: number
}): Signal[] {
  const signals: Signal[] = []

  if (data.projectedFreeSpace < 0) {
    signals.push({
      type: 'cashflow_negative',
      title: 'Saldo dekt vaste lasten niet',
      description: `Je hebt €${Math.abs(data.projectedFreeSpace).toFixed(0)} tekort voor vaste lasten vóór je salaris.`,
      severity: 'danger',
      amount: data.projectedFreeSpace,
    })
  } else if (data.projectedFreeSpace < 200) {
    signals.push({
      type: 'cashflow_low',
      title: 'Weinig buffer tot salaris',
      description: `Na vaste lasten blijft er €${data.projectedFreeSpace.toFixed(0)} over. Houd uitgaven in de gaten.`,
      severity: 'warning',
      amount: data.projectedFreeSpace,
    })
  }

  // Grote last in de komende 3 dagen
  const upcoming = data.recurringItems
    .filter(r =>
      r.amount > 100 &&
      r.dayOfMonth > data.currentDay &&
      r.dayOfMonth - data.currentDay <= 3
    )
    .sort((a, b) => b.amount - a.amount)

  if (upcoming.length > 0) {
    const item = upcoming[0]
    signals.push({
      type: 'upcoming_large_expense',
      title: `${item.description} over ${item.dayOfMonth - data.currentDay} dag(en)`,
      description: `€${item.amount.toFixed(0)} wordt binnenkort afgeschreven.`,
      severity: 'info',
      amount: item.amount,
    })
  }

  return signals
}

// ── HELPERS ────────────────────────────────────────────────────

/**
 * Bereken dagen tot een bepaalde dag in de maand.
 * Als die dag al geweest is, bereken tot die dag volgende maand.
 */
function calculateDaysUntil(today: Date, targetDay: number): number {
  const currentDay = today.getDate()

  if (targetDay >= currentDay) {
    return targetDay - currentDay
  }

  // Dag is al geweest → bereken tot volgende maand
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, targetDay)
  const diffMs = nextMonth.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Bereken mediaan van een array getallen.
 * Retourneert 0 bij lege array.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}