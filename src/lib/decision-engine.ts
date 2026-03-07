// src/lib/decision-engine.ts
// Gebruikt merchant_map als databron — geen eigen detectie logica

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

// Haal recurring items op uit merchant_map (niet zelf detecteren)
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

  // Haal overrides op
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
  const groups = new Map<string, { amounts: number[]; days: number[]; dates: string[]; name: string; category: string }>()

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

    const sorted = [...g.amounts].sort((a, b) => a - b)
    const amount = sorted[Math.floor(sorted.length / 2)] // mediaan

    const sortedDays = [...g.days].sort((a, b) => a - b)
    const dayOfMonth = sortedDays[Math.floor(sortedDays.length / 2)]

    result.push({
      description: g.name,
      merchant_key: key,
      amount,
      category: g.category,
      dayOfMonth,
      confidence: 0.8,
      lastSeen: g.dates[0],
    })
  }

  return result.sort((a, b) => b.amount - a.amount)
}

// Projecteer cashflow
export async function projectCashflow(
  userId: string,
  supabase: SupabaseClient
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

  // 2) Haal inkomen op uit merchant_map income_hint
  const { data: incomeMap } = await supabase
    .from('merchant_map')
    .select('merchant_key')
    .eq('income_hint', true)

  let salaryDate = 25
  let salaryExpected = 0

  if (incomeMap && incomeMap.length > 0) {
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
      .toISOString().slice(0, 10)

    const { data: incomeTx } = await supabase
      .from('transactions')
      .select('merchant_key, amount, transaction_date')
      .eq('user_id', userId)
      .gt('amount', 0)
      .gte('transaction_date', threeMonthsAgo)
      .in('merchant_key', incomeMap.map(i => i.merchant_key))

    if (incomeTx && incomeTx.length > 0) {
      // Groepeer per merchant, bereken mediaan dag en mediaan bedrag
      const incomeGroups = new Map<string, { amounts: number[]; days: number[] }>()
      for (const tx of incomeTx) {
        if (!incomeGroups.has(tx.merchant_key)) incomeGroups.set(tx.merchant_key, { amounts: [], days: [] })
        incomeGroups.get(tx.merchant_key)!.amounts.push(Number(tx.amount))
        incomeGroups.get(tx.merchant_key)!.days.push(new Date(tx.transaction_date).getDate())
      }

      const incomeSources = Array.from(incomeGroups.values()).map(g => {
        const sortedAmounts = [...g.amounts].sort((a, b) => a - b)
        const sortedDays = [...g.days].sort((a, b) => a - b)
        return {
          amount: sortedAmounts[Math.floor(sortedAmounts.length / 2)],
          day: sortedDays[Math.floor(sortedDays.length / 2)],
        }
      })

      salaryDate = Math.min(...incomeSources.map(s => s.day))
      salaryExpected = incomeSources.reduce((s, i) => s + i.amount, 0)
    }
  }

  // 3) Recurring items uit merchant_map
  const recurringItems = await detectRecurringItems(userId, supabase)

  // 4) Al betaald deze maand (vaste lasten)
  const recurringKeys = new Set(recurringItems.map(r => r.merchant_key))

  const { data: paidTx } = await supabase
    .from('transactions')
    .select('merchant_key, amount')
    .eq('user_id', userId)
    .lt('amount', 0)
    .gte('transaction_date', startOfMonth)
    .in('merchant_key', [...recurringKeys])

  const alreadyPaid = (paidTx ?? [])
    .reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0)

  // 5) Nog te betalen (vóór salarisdatum)
  const stillToPay = recurringItems
    .filter(r => !isPaidThisMonth(r.merchant_key, paidTx ?? []) && r.dayOfMonth < salaryDate)
    .reduce((s, r) => s + r.amount, 0)

  const totalFixed = recurringItems.reduce((s, r) => s + r.amount, 0)

  const daysUntilSalary = salaryDate >= currentDay
    ? salaryDate - currentDay
    : (new Date(today.getFullYear(), today.getMonth() + 1, salaryDate).getDate())

  // 6) Vrije ruimte
  const projectedFreeSpace = currentBalance - stillToPay

  const riskLevel = projectedFreeSpace < 0 ? 'danger'
    : projectedFreeSpace < 200 ? 'caution'
    : 'safe'

  // 7) Signalen
  const signals = generateSignals({
    projectedFreeSpace,
    stillToPay,
    daysUntilSalary,
    recurringItems,
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

function isPaidThisMonth(
  merchantKey: string,
  paidTx: { merchant_key: string | null }[]
): boolean {
  return paidTx.some(tx => tx.merchant_key === merchantKey)
}

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
  const soonLarge = data.recurringItems.find(r =>
    r.amount > 100 &&
    r.dayOfMonth > data.currentDay &&
    r.dayOfMonth - data.currentDay <= 3
  )
  if (soonLarge) {
    signals.push({
      type: 'upcoming_large_expense',
      title: `${soonLarge.description} over ${soonLarge.dayOfMonth - data.currentDay} dag(en)`,
      description: `€${soonLarge.amount.toFixed(0)} wordt binnenkort afgeschreven.`,
      severity: 'info',
      amount: soonLarge.amount,
    })
  }

  return signals
}

function emptyProjection(): CashflowProjection {
  return {
    currentBalance: 0,
    projectedFreeSpace: 0,
    salaryExpected: 0,
    salaryDate: 25,
    fixedExpensesThisMonth: 0,
    alreadyPaid: 0,
    stillToPay: 0,
    daysUntilSalary: 0,
    riskLevel: 'safe',
    signals: [],
  }
}