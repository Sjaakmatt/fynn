import { SupabaseClient } from '@supabase/supabase-js'

export interface RecurringItem {
  description: string
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

// Detecteer terugkerende transacties op basis van patronen
export async function detectRecurringItems(
  userId: string,
  supabase: SupabaseClient
): Promise<RecurringItem[]> {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('description, amount, transaction_date, category')
    .eq('user_id', userId)
    .lt('amount', 0)
    .order('transaction_date', { ascending: false })
    .limit(200)

  if (!transactions || transactions.length === 0) return []

  // Groepeer op beschrijving (genormaliseerd)
  const groups: Record<string, { amounts: number[]; dates: string[]; category: string }> = {}

  transactions.forEach(tx => {
    const key = normalizeDescription(tx.description)
    const amount = Math.abs(parseFloat(tx.amount))
    if (!groups[key]) {
      groups[key] = { amounts: [], dates: [], category: tx.category ?? 'overig' }
    }
    groups[key].amounts.push(amount)
    groups[key].dates.push(tx.transaction_date)
  })

  const recurring: RecurringItem[] = []

  for (const [desc, data] of Object.entries(groups)) {
    if (data.amounts.length < 2) continue

    const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
    
    if (avgAmount < 10) continue // ← nu ná de declaratie

    const variance = data.amounts.map(a => Math.abs(a - avgAmount) / avgAmount)
    const avgVariance = variance.reduce((a, b) => a + b, 0) / variance.length

    if (avgVariance > 0.1) continue

    const days = data.dates.map(d => new Date(d).getDate())
    const avgDay = Math.round(days.reduce((a, b) => a + b, 0) / days.length)

    const confidence = Math.min(0.6 + (data.amounts.length * 0.1), 1.0)

    recurring.push({
      description: desc,
      amount: avgAmount,
      category: data.category,
      dayOfMonth: avgDay,
      confidence,
      lastSeen: data.dates[0],
    })
  }

  return recurring.sort((a, b) => b.amount - a.amount)
}

// Projecteer cashflow voor de komende 30 dagen
export async function projectCashflow(
  userId: string,
  supabase: SupabaseClient
): Promise<CashflowProjection> {
  const today = new Date()
  const currentDay = today.getDate()

  // Haal transacties op
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, category, transaction_date, description')
    .eq('user_id', userId)
    .not('category', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(200)

  if (!transactions || transactions.length === 0) {
    return emptyProjection()
  }

  // Bereken maandinkomen (gemiddelde over afgelopen 3 maanden)
  const incomeTransactions = transactions.filter(tx => parseFloat(tx.amount) > 0)
  const totalIncome = incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
  const dates = transactions.map(tx => tx.transaction_date)
  const oldest = new Date(dates[dates.length - 1])
  const newest = new Date(dates[0])
  const monthsOfData = Math.max(1, Math.round(
    (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30)
  ))
  const monthlyIncome = monthsOfData <= 1 ? totalIncome : totalIncome / monthsOfData

  // Detecteer salaris dag (grootste terugkerende inkomst)
  const salaryDay = detectSalaryDay(incomeTransactions)

  // Detecteer vaste lasten
  const recurringItems = await detectRecurringItems(userId, supabase)
  const fixedExpenses = recurringItems.filter(r => r.confidence >= 0.8)

  // Wat is al betaald deze maand?
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const paidThisMonth = transactions
    .filter(tx => tx.transaction_date >= startOfMonth && parseFloat(tx.amount) < 0)
    .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0)

  // Welke vaste lasten moeten nog betaald worden deze maand?
  const stillToPay = fixedExpenses
    .filter(item => item.dayOfMonth > currentDay)
    .reduce((sum, item) => sum + item.amount, 0)

  const totalFixedThisMonth = fixedExpenses.reduce((sum, item) => sum + item.amount, 0)

  // Dagen tot salaris
  const daysUntilSalary = salaryDay >= currentDay
    ? salaryDay - currentDay
    : (30 - currentDay) + salaryDay

  // Vrije ruimte = inkomen - vaste lasten - al gespaard
  const savedThisMonth = transactions
    .filter(tx => tx.transaction_date >= startOfMonth && tx.category === 'sparen')
    .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0)

  const projectedFreeSpace = monthlyIncome - totalFixedThisMonth - savedThisMonth
  const remainingFreeSpace = projectedFreeSpace - paidThisMonth + totalFixedThisMonth - stillToPay

  // Risk level
  const riskLevel = remainingFreeSpace < 0 ? 'danger'
    : remainingFreeSpace < 200 ? 'caution'
    : 'safe'

  // Genereer signalen
  const signals = generateSignals({
    remainingFreeSpace,
    stillToPay,
    daysUntilSalary,
    paidThisMonth,
    monthlyIncome,
    fixedExpenses,
    transactions,
    startOfMonth,
  })

  // Sla signals op in DB
  if (signals.length > 0) {
    await supabase.from('cashflow_events').upsert(
      signals.map(s => ({
        user_id: userId,
        event_type: s.type,
        title: s.title,
        description: s.description,
        severity: s.severity,
        amount: s.amount ?? null,
        projected_date: s.date ?? null,
        is_read: false,
      })),
      { onConflict: 'user_id,event_type' }
    )
  }

  // Sla recurring items op
  await supabase.from('recurring_items').upsert(
    fixedExpenses.map(r => ({
      user_id: userId,
      description: r.description,
      amount: r.amount,
      category: r.category,
      day_of_month: r.dayOfMonth,
      confidence: r.confidence,
      last_seen: r.lastSeen,
    })),
    { onConflict: 'user_id,description' }
  )

  return {
    currentBalance: monthlyIncome - paidThisMonth,
    projectedFreeSpace,
    salaryExpected: monthlyIncome,
    salaryDate: salaryDay,
    fixedExpensesThisMonth: totalFixedThisMonth,
    alreadyPaid: paidThisMonth,
    stillToPay,
    daysUntilSalary,
    riskLevel,
    signals,
  }
}

function generateSignals(data: {
  remainingFreeSpace: number
  stillToPay: number
  daysUntilSalary: number
  paidThisMonth: number
  monthlyIncome: number
  fixedExpenses: RecurringItem[]
  transactions: { amount: string; category: string; transaction_date: string; description: string }[]
  startOfMonth: string
}): Signal[] {
  const signals: Signal[] = []

  // Signaal: vrije ruimte kritiek laag
  if (data.remainingFreeSpace < 0) {
    signals.push({
      type: 'cashflow_negative',
      title: 'Uitgaven overschrijden inkomen',
      description: `Je vrije ruimte is negatief (€${Math.abs(data.remainingFreeSpace).toFixed(0)}). Er komen nog vaste lasten aan van €${data.stillToPay.toFixed(0)}.`,
      severity: 'danger',
      amount: data.remainingFreeSpace,
    })
  } else if (data.remainingFreeSpace < 200) {
    signals.push({
      type: 'cashflow_low',
      title: 'Krap aan het einde van de maand',
      description: `Je hebt nog €${data.remainingFreeSpace.toFixed(0)} vrij na vaste lasten. Houd uitgaven in de gaten.`,
      severity: 'warning',
      amount: data.remainingFreeSpace,
    })
  }

  // Signaal: grote vaste last aankomend
  const upcomingLarge = data.fixedExpenses.filter(r => r.amount > 50 && r.dayOfMonth > new Date().getDate())
  if (upcomingLarge.length > 0) {
    const next = upcomingLarge[0]
    const daysUntil = next.dayOfMonth - new Date().getDate()
    if (daysUntil <= 5) {
      signals.push({
        type: 'upcoming_fixed_expense',
        title: `${next.description} wordt binnenkort afgeschreven`,
        description: `Over ${daysUntil} dag${daysUntil !== 1 ? 'en' : ''} wordt €${next.amount.toFixed(0)} afgeschreven voor ${next.description}.`,
        severity: 'info',
        amount: next.amount,
        date: new Date(new Date().getFullYear(), new Date().getMonth(), next.dayOfMonth).toISOString().split('T')[0],
      })
    }
  }

  // Signaal: eten & drinken boven gemiddelde
  const eetUitgaven = data.transactions
    .filter(tx => tx.transaction_date >= data.startOfMonth && tx.category === 'eten & drinken')
    .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0)

  if (eetUitgaven > 300) {
    signals.push({
      type: 'category_overspend',
      title: 'Eten & drinken loopt op',
      description: `Je hebt al €${eetUitgaven.toFixed(0)} uitgegeven aan eten & drinken deze maand — meer dan gemiddeld.`,
      severity: 'info',
      amount: eetUitgaven,
    })
  }

  return signals
}

function detectSalaryDay(incomeTransactions: { transaction_date: string; amount: string }[]): number {
  if (incomeTransactions.length === 0) return 25
  const days = incomeTransactions.map(tx => new Date(tx.transaction_date).getDate())
  const counts: Record<number, number> = {}
  days.forEach(d => { counts[d] = (counts[d] ?? 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? parseInt(sorted[0][0]) : 25
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase()
    .replace(/\d{6,}/g, '')    // verwijder lange nummers
    .replace(/\d{2}-\d{2}/g, '') // verwijder datums
    .replace(/[^a-z\s]/g, '')   // alleen letters
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 25)
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