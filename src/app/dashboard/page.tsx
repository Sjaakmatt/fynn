import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { Suspense } from 'react'

interface CalendarItem {
  name: string
  amount: number
  thisMonthDate: string
  dayOfMonth: number
  daysUntil: number
  isPast: boolean
  merchantKey: string
}

const VARIABLE_BUDGET_CATEGORIES = ['boodschappen', 'transport']

function median(values: number[]): number {
  if (values.length === 0) return 0
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

function runDecisionEngine(
  totalBalance: number,
  calendarItems: CalendarItem[],
  todayDay: number,
  nextSalaryDay: number = 25,
  variableBudgetReservering: number = 0,
): {
  vrijTeBesteden: number
  nogTeBetalen: number
  reedsBetaald: number
  variabelReservering: number
} {
  const reedsBetaald = calendarItems
    .filter(i => i.isPast)
    .reduce((s, i) => s + i.amount, 0)

  // Alleen vaste lasten vóór eerste salarisdatum
  const nogTeBetalen = calendarItems
    .filter(i => !i.isPast && i.dayOfMonth < nextSalaryDay)
    .reduce((s, i) => s + i.amount, 0)

  const totaalReservering = nogTeBetalen + variableBudgetReservering

  return {
    vrijTeBesteden: totalBalance - totaalReservering,
    nogTeBetalen,
    reedsBetaald,
    variabelReservering: variableBudgetReservering,
  }
}

function parseFirstName(fullName: string | null, email: string | undefined): string {
  if (fullName) return fullName.split(' ')[0]
  if (!email) return 'daar'
  const local = email.split('@')[0]
  const parts = local.split(/[._\-+]/)
  if (parts.length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  }
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const todayDay = today.getDate()

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1)
    .toISOString().split('T')[0]

  const [
    { data: accounts },
    { data: thisMonthTx },
    { data: briefing },
    { data: profile },
    { data: latestTx },
  ] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, account_name, iban, balance, account_type')
      .eq('user_id', user.id),

    supabase
      .from('transactions')
      .select('amount, category, description, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth),

    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, full_name')
      .eq('id', user.id)
      .single(),

    supabase
      .from('transactions')
      .select('transaction_date')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(1)
      .single(),
  ])

  const totalBalance = (accounts ?? [])
    .filter(a => a.account_type !== 'SAVINGS')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)

  // ── Calendar items ────────────────────────────────────────────────
  let calendarItems: CalendarItem[] = []
  try {
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
      .toISOString().split('T')[0]

    const [{ data: merchantMap }, { data: overrides }, { data: recentTx }] = await Promise.all([
      supabase.from('merchant_map').select('merchant_key, merchant_name').eq('recurring_hint', true).or('is_variable.is.null,is_variable.eq.false'),
      supabase.from('merchant_user_overrides').select('merchant_key, is_variable').eq('user_id', user.id),
      supabase.from('transactions').select('merchant_key, merchant_name, amount, transaction_date').eq('user_id', user.id).lt('amount', 0).gte('transaction_date', threeMonthsAgo),
    ])

    const variableKeys = new Set((overrides ?? []).filter(o => o.is_variable).map(o => o.merchant_key))
    const recurringKeys = new Set((merchantMap ?? []).map(m => m.merchant_key))
    const merchantGroups = new Map<string, { amounts: number[]; days: number[]; name: string }>()

    for (const tx of recentTx ?? []) {
      if (!tx.merchant_key) continue
      if (variableKeys.has(tx.merchant_key)) continue
      if (!recurringKeys.has(tx.merchant_key)) continue
      if (!merchantGroups.has(tx.merchant_key)) {
        const mapEntry = (merchantMap ?? []).find(m => m.merchant_key === tx.merchant_key)
        merchantGroups.set(tx.merchant_key, { amounts: [], days: [], name: mapEntry?.merchant_name ?? tx.merchant_name ?? tx.merchant_key })
      }
      merchantGroups.get(tx.merchant_key)!.amounts.push(Math.abs(Number(tx.amount)))
      merchantGroups.get(tx.merchant_key)!.days.push(new Date(tx.transaction_date).getDate())
    }

    calendarItems = Array.from(merchantGroups.entries()).map(([key, g]) => {
      const sorted = [...g.amounts].sort((a, b) => a - b)
      const amount = sorted[Math.floor(sorted.length / 2)]
      const sortedDays = [...g.days].sort((a, b) => a - b)
      const dom = sortedDays[Math.floor(sortedDays.length / 2)]
      const daysUntil = dom - todayDay
      return { name: g.name, amount, thisMonthDate: '', dayOfMonth: dom, daysUntil, isPast: daysUntil < 0, merchantKey: key }
    })
  } catch (e) {
    console.warn('[Dashboard] Calendar items mislukt:', e)
  }

  // ── Inkomen detectie ──────────────────────────────────────────────
  let nextSalaryDay = 25
  try {
    const { data: incomeMap } = await supabase
      .from('merchant_map')
      .select('merchant_key')
      .eq('income_hint', true)
      .or('is_variable.is.null,is_variable.eq.false')

    const { data: incomeTx } = await supabase
      .from('transactions')
      .select('merchant_key, transaction_date')
      .eq('user_id', user.id)
      .gt('amount', 0)
      .gte('transaction_date', new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10))
      .in('merchant_key', (incomeMap ?? []).map(i => i.merchant_key))

    const incomeGroups = new Map<string, number[]>()
    for (const tx of incomeTx ?? []) {
      if (!incomeGroups.has(tx.merchant_key)) incomeGroups.set(tx.merchant_key, [])
      incomeGroups.get(tx.merchant_key)!.push(new Date(tx.transaction_date).getDate())
    }

    const incomeDays = Array.from(incomeGroups.values()).map(days => {
      const sorted = [...days].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    })

    if (incomeDays.length > 0) nextSalaryDay = Math.min(...incomeDays)
  } catch (e) {
    console.warn('[Dashboard] Inkomen detectie mislukt:', e)
  }

  // ── Variabele budget reservering ──────────────────────────────────
  let variableBudgetReservering = 0
  const variabelPerCategorie: Record<string, { budget: number; gespendeerd: number; resterend: number }> = {}
  try {
    // Historische data: 6 maanden terug, gesplitst per maand per categorie
    const { data: historicTx } = await supabase
      .from('transactions')
      .select('amount, category, transaction_date')
      .eq('user_id', user.id)
      .lt('amount', 0)
      .gte('transaction_date', sixMonthsAgo)
      .lt('transaction_date', startOfMonth) // exclusief huidige maand
      .in('category', VARIABLE_BUDGET_CATEGORIES)

    // Groepeer per maand per categorie
    const maandTotalen: Record<string, Record<string, number>> = {}
    for (const tx of historicTx ?? []) {
      const maand = tx.transaction_date.slice(0, 7) // "2025-10"
      const cat = tx.category ?? 'overig'
      if (!maandTotalen[maand]) maandTotalen[maand] = {}
      if (!maandTotalen[maand][cat]) maandTotalen[maand][cat] = 0
      maandTotalen[maand][cat] += Math.abs(Number(tx.amount))
    }

    // Mediaan per categorie over beschikbare maanden
    for (const cat of VARIABLE_BUDGET_CATEGORIES) {
      const maandBedragen = Object.values(maandTotalen)
        .map(m => m[cat] ?? 0)
        .filter(v => v > 0)

      if (maandBedragen.length === 0) continue

      const budgetMediaan = Math.round(median(maandBedragen))

      // Al gespendeerd deze maand in deze categorie
      const alGespendeerd = (thisMonthTx ?? [])
        .filter(tx => tx.category === cat && Number(tx.amount) < 0)
        .reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0)

      const resterend = Math.max(0, budgetMediaan - alGespendeerd)

      variabelPerCategorie[cat] = {
        budget: budgetMediaan,
        gespendeerd: Math.round(alGespendeerd),
        resterend: Math.round(resterend),
      }

      variableBudgetReservering += resterend
    }
  } catch (e) {
    console.warn('[Dashboard] Variabel budget mislukt:', e)
  }

  // ── Decision Engine ───────────────────────────────────────────────
  const engine = runDecisionEngine(
    totalBalance,
    calendarItems,
    todayDay,
    nextSalaryDay,
    Math.round(variableBudgetReservering),
  )

  // ── Analyse: meest recente maand met data ─────────────────────────
  let analyseStart = startOfMonth
  let analyseEnd = endOfMonth
  let isHistoricData = false
  let activeMonthLabel = today.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })

  if (latestTx?.transaction_date) {
    const latest = new Date(latestTx.transaction_date)
    const sameMonth =
      latest.getFullYear() === today.getFullYear() &&
      latest.getMonth() === today.getMonth()

    if (!sameMonth) {
      analyseStart = new Date(latest.getFullYear(), latest.getMonth(), 1)
        .toISOString().split('T')[0]
      analyseEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0)
        .toISOString().split('T')[0]
      isHistoricData = true
      activeMonthLabel = latest.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    }
  }

  const { data: analyseTx } = isHistoricData
    ? await supabase
        .from('transactions')
        .select('amount, category')
        .eq('user_id', user.id)
        .gte('transaction_date', analyseStart)
        .lte('transaction_date', analyseEnd)
    : { data: thisMonthTx }

  // ── Categorie stats ───────────────────────────────────────────────
  const byCategory: Record<string, { total: number; count: number }> = {}
  let totalUitgaven = 0
  let totalInkomen = 0
  let totalGespaard = 0

  ;(analyseTx ?? []).forEach(tx => {
    const cat = tx.category ?? 'overig'
    const amount = parseFloat(tx.amount)

    if (amount < 0) {
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
      byCategory[cat].total += Math.abs(amount)
      byCategory[cat].count += 1
      if (cat === 'sparen') totalGespaard += Math.abs(amount)
      else totalUitgaven += Math.abs(amount)
    } else {
      totalInkomen += amount
    }
  })

  const spaarpct = totalInkomen > 0
    ? ((totalGespaard / totalInkomen) * 100).toFixed(0)
    : '0'

  const sortedCategories = Object.entries(byCategory)
    .filter(([cat]) => cat !== 'sparen')
    .sort((a, b) => b[1].total - a[1].total)

  const isPro =
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing'

  const firstName = parseFirstName(profile?.full_name ?? null, user.email)

  return (
    <Suspense fallback={null}>
      <DashboardShell
        user={{ id: user.id, email: user.email, firstName }}
        accounts={accounts ?? []}
        stats={{
          beschikbaar: engine.vrijTeBesteden,
          nogTeBetalen: engine.nogTeBetalen,
          nogTeOntvangen: 0,
          reedsBetaald: engine.reedsBetaald,
          variabelReservering: engine.variabelReservering,
          totalBalance,
          totalUitgaven,
          totalInkomen,
          totalGespaard,
          spaarpct,
        }}
        variabelPerCategorie={variabelPerCategorie}
        sortedCategories={sortedCategories}
        briefing={briefing}
        transactionCount={analyseTx?.length ?? 0}
        subscriptionStatus={profile?.subscription_status ?? null}
        trialEndsAt={profile?.trial_ends_at ?? null}
        isPro={isPro}
        activeMonthLabel={activeMonthLabel}
        isHistoricData={isHistoricData}
      />
    </Suspense>
  )
}