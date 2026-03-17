// src/app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { Suspense } from 'react'
import { resolveCategory, buildCategoryMaps } from '@/lib/resolve-category'
import { readDashboardCache, writeDashboardCache } from '@/lib/dashboard-cache'

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

// Categories that should never appear in the "Uitgaven per categorie" overview
const HIDDEN_EXPENSE_CATEGORIES = ['interne_overboeking', 'inkomen', 'toeslagen']

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
  // Only count expenses that fall BEFORE salary day in the current cycle.
  // Expenses on salary day and after belong to the next salary cycle.
  const currentCycleItems = calendarItems.filter(i => i.dayOfMonth < nextSalaryDay)

  const reedsBetaald = currentCycleItems
    .filter(i => i.isPast)
    .reduce((s, i) => s + i.amount, 0)

  const nogTeBetalen = currentCycleItems
    .filter(i => !i.isPast)
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

  // ── Cache check — skip alle queries als we verse data hebben ──
  const cached = await readDashboardCache(supabase, user.id)

  if (cached) {
    // We hebben nog wél profile + briefing + accounts nodig (kleine queries)
    const [{ data: profile }, { data: briefing }, { data: accounts }] = await Promise.all([
      supabase.from('profiles').select('subscription_status, trial_ends_at, full_name, is_beta').eq('id', user.id).single(),
      supabase.from('briefings').select('*').eq('user_id', user.id).single(),
      supabase.from('bank_accounts').select('id, account_name, iban, balance, account_type, provider').eq('user_id', user.id).neq('provider', 'iban_detected'),
    ])

    const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
    const firstName = parseFirstName(profile?.full_name ?? null, user.email)

    return (
      <Suspense fallback={null}>
        <DashboardShell
          user={{ id: user.id, email: user.email, firstName }}
          accounts={accounts ?? []}
          stats={cached.stats}
          variabelPerCategorie={cached.variabelPerCategorie}
          sortedCategories={cached.sortedCategories}
          briefing={briefing}
          transactionCount={cached.transactionCount}
          subscriptionStatus={profile?.subscription_status ?? null}
          trialEndsAt={profile?.trial_ends_at ?? null}
          isPro={isPro}
          activeMonthLabel={cached.activeMonthLabel}
          isHistoricData={cached.isHistoricData}
          isBeta={profile?.is_beta ?? false}
        />
      </Suspense>
    )
  }

  // ── Geen cache — bestaande logica hieronder blijft ongewijzigd ──

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
      .select('id, account_name, iban, balance, account_type, provider')
      .eq('user_id', user.id)
      .neq('provider', 'iban_detected'),

    supabase
      .from('transactions')
      .select('amount, merchant_key, description, transaction_date')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .limit(3000),

    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, full_name, is_beta')
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
    .filter(a => a.account_type !== 'SAVINGS' && a.provider !== 'iban_detected')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)

  // ── Category resolution maps (single source of truth) ──────────────
  const [{ data: catMapRows }, { data: catOverrideRows }, { data: catIbanRows }] = await Promise.all([
    supabase.from('merchant_map').select('merchant_key, category').not('category', 'is', null),
    supabase.from('merchant_user_overrides').select('merchant_key, category').eq('user_id', user.id).not('category', 'is', null),
    supabase.from('bank_accounts').select('iban').eq('user_id', user.id).not('iban', 'is', null),
  ])
  const userIbans = (catIbanRows ?? []).map(a => a.iban).filter(Boolean)
  const categoryMaps = buildCategoryMaps(catMapRows, catOverrideRows, userIbans)

  // ── Calendar items ────────────────────────────────────────────────
  let calendarItems: CalendarItem[] = []
  try {
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
      .toISOString().split('T')[0]

    const [{ data: merchantMap }, { data: overrides }, { data: recentTx }] = await Promise.all([
      supabase
        .from('merchant_map')
        .select('merchant_key, merchant_name')
        .eq('recurring_hint', true)
        .or('is_variable.is.null,is_variable.eq.false'),
      supabase
        .from('merchant_user_overrides')
        .select('merchant_key, is_variable')
        .eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('merchant_key, merchant_name, amount, transaction_date')
        .eq('user_id', user.id)
        .lt('amount', 0)
        .gte('transaction_date', threeMonthsAgo)
        .limit(3000),
    ])

    const variableKeys = new Set(
      (overrides ?? []).filter(o => o.is_variable).map(o => o.merchant_key)
    )
    const recurringMap = new Map(
      (merchantMap ?? []).map(m => [m.merchant_key, m.merchant_name])
    )
    const merchantGroups = new Map<string, { amounts: number[]; days: number[]; name: string }>()

    for (const tx of recentTx ?? []) {
      if (!tx.merchant_key) continue
      if (variableKeys.has(tx.merchant_key)) continue
      if (!recurringMap.has(tx.merchant_key)) continue

      const amt = Math.abs(Number(tx.amount ?? 0))
      if (!Number.isFinite(amt) || amt <= 0) continue

      if (!merchantGroups.has(tx.merchant_key)) {
        merchantGroups.set(tx.merchant_key, {
          amounts: [],
          days: [],
          name: recurringMap.get(tx.merchant_key) ?? tx.merchant_name ?? tx.merchant_key,
        })
      }
      const g = merchantGroups.get(tx.merchant_key)!
      g.amounts.push(amt)
      g.days.push(new Date(tx.transaction_date).getDate())
    }

    calendarItems = Array.from(merchantGroups.entries()).map(([key, g]) => {
      const amount = median(g.amounts)
      const dom = median(g.days)
      const daysUntil = Math.round(dom) - todayDay
      return {
        name: g.name,
        amount,
        thisMonthDate: '',
        dayOfMonth: Math.round(dom),
        daysUntil,
        isPast: daysUntil < 0,
        merchantKey: key,
      }
    })
  } catch (e) {
    console.warn('[Dashboard] Calendar items mislukt:', e)
  }

  // ── Inkomen detectie ──────────────────────────────────────────────
  let nextSalaryDay = 25
  let detectedIncome = false
  try {
    // Method 1: via merchant_map income_hint (works with Enable Banking / Plaid)
    const { data: incomeMap } = await supabase
      .from('merchant_map')
      .select('merchant_key')
      .eq('income_hint', true)
      .or('is_variable.is.null,is_variable.eq.false')

    const incomeKeys = (incomeMap ?? []).map(i => i.merchant_key)
    if (incomeKeys.length > 0) {
      const { data: incomeTx } = await supabase
        .from('transactions')
        .select('merchant_key, amount, transaction_date')
        .eq('user_id', user.id)
        .gt('amount', 0)
        .gte('transaction_date', new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10))
        .in('merchant_key', incomeKeys)
        .limit(500)

      const incomeGroups = new Map<string, { days: number[]; amounts: number[] }>()
      for (const tx of incomeTx ?? []) {
        if (!incomeGroups.has(tx.merchant_key)) {
          incomeGroups.set(tx.merchant_key, { days: [], amounts: [] })
        }
        const g = incomeGroups.get(tx.merchant_key)!
        g.days.push(new Date(tx.transaction_date).getDate())
        g.amounts.push(Number(tx.amount))
      }

      if (incomeGroups.size > 0) {
        // Find the primary income source = highest median amount
        let primaryDay = 25
        let highestMedianAmount = 0

        for (const g of incomeGroups.values()) {
          const medianAmount = median(g.amounts)
          if (medianAmount > highestMedianAmount) {
            highestMedianAmount = medianAmount
            // Use max day — salary is always on a fixed day (e.g. 25th),
            // but paid earlier when that day falls on a weekend.
            // The highest observed day is the real salary day.
            primaryDay = Math.max(...g.days)
          }
        }

        nextSalaryDay = primaryDay
        detectedIncome = true
      }
    }

    // Method 2: fallback via income merchants from merchant_map (not tx.category)
    if (!detectedIncome) {
      const { data: incomeKeys } = await supabase
        .from('merchant_map')
        .select('merchant_key')
        .eq('income_hint', true)

      const incomeKeySet = new Set((incomeKeys ?? []).map(r => r.merchant_key))

      const { data: incomeTx } = await supabase
        .from('transactions')
        .select('amount, transaction_date, merchant_key')
        .eq('user_id', user.id)
        .gt('amount', 500)
        .gte('transaction_date', new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10))
        .order('amount', { ascending: false })
        .limit(500)

      const filteredIncome = (incomeTx ?? []).filter(tx =>
        tx.merchant_key && incomeKeySet.has(tx.merchant_key)
      )

      if (filteredIncome && filteredIncome.length > 0) {
        // Group by approximate amount to find the main salary pattern
        // The largest recurring amount is most likely the salary
        const amountGroups = new Map<number, number[]>()
        for (const tx of filteredIncome) {
          const amt = Math.round(Number(tx.amount) / 100) * 100 // Round to nearest 100
          if (!amountGroups.has(amt)) amountGroups.set(amt, [])
          amountGroups.get(amt)!.push(new Date(tx.transaction_date).getDate())
        }

        // Find the group with the most transactions (likely salary)
        let bestGroup: number[] = []
        for (const days of amountGroups.values()) {
          if (days.length > bestGroup.length) bestGroup = days
        }

        if (bestGroup.length >= 2) {
          nextSalaryDay = Math.round(median(bestGroup))
        }
      }
    }
  } catch (e) {
    console.warn('[Dashboard] Inkomen detectie mislukt:', e)
  }

  // ── Variabele budget reservering ──────────────────────────────────
  let variableBudgetReservering = 0
  const variabelPerCategorie: Record<string, { budget: number; gespendeerd: number; resterend: number }> = {}
  try {
    const { data: historicTx } = await supabase
      .from('transactions')
      .select('amount, merchant_key, description, transaction_date')
      .eq('user_id', user.id)
      .lt('amount', 0)
      .gte('transaction_date', sixMonthsAgo)
      .lt('transaction_date', startOfMonth)
      .limit(3000)

    const maandTotalen: Record<string, Record<string, number>> = {}
    for (const tx of historicTx ?? []) {
      const amt = Math.abs(Number(tx.amount ?? 0))
      if (!Number.isFinite(amt) || amt <= 0) continue

      const cat = resolveCategory(tx, categoryMaps)
      if (!VARIABLE_BUDGET_CATEGORIES.includes(cat)) continue

      const maand = tx.transaction_date.slice(0, 7)
      if (!maandTotalen[maand]) maandTotalen[maand] = {}
      if (!maandTotalen[maand][cat]) maandTotalen[maand][cat] = 0
      maandTotalen[maand][cat] += amt
    }

    for (const cat of VARIABLE_BUDGET_CATEGORIES) {
      const maandBedragen = Object.values(maandTotalen)
        .map(m => m[cat] ?? 0)
        .filter(v => v > 0)

      if (maandBedragen.length === 0) continue

      const budgetMediaan = Math.round(median(maandBedragen))

      const alGespendeerd = (thisMonthTx ?? [])
        .filter(tx => resolveCategory(tx, categoryMaps) === cat)
        .reduce((s, tx) => {
          const amt = Number(tx.amount ?? 0)
          return Number.isFinite(amt) && amt < 0 ? s + Math.abs(amt) : s
        }, 0)

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
        .select('amount, merchant_key, description')
        .eq('user_id', user.id)
        .gte('transaction_date', analyseStart)
        .lte('transaction_date', analyseEnd)
        .limit(3000)
    : { data: thisMonthTx }

  // ── Categorie stats ───────────────────────────────────────────────
  const byCategory: Record<string, { total: number; count: number }> = {}
  let totalUitgaven = 0
  let totalInkomen = 0
  let totalGespaard = 0

  for (const tx of analyseTx ?? []) {
    const cat = resolveCategory(tx, categoryMaps)
    const amount = Number(tx.amount ?? 0)
    if (!Number.isFinite(amount)) continue

    if (amount < 0) {
      // Skip hidden categories — these are not real expenses
      if (HIDDEN_EXPENSE_CATEGORIES.includes(cat)) continue

      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
      byCategory[cat].total += Math.abs(amount)
      byCategory[cat].count += 1
      if (cat === 'sparen') totalGespaard += Math.abs(amount)
      else totalUitgaven += Math.abs(amount)
    } else {
      totalInkomen += amount
    }
  }

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

  // ── Cache schrijven voor volgende pageview (non-blocking) ─────────
  const cachePayload = {
    stats: {
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
    },
    sortedCategories,
    variabelPerCategorie,
    transactionCount: analyseTx?.length ?? 0,
    activeMonthLabel,
    isHistoricData,
  }
  writeDashboardCache(supabase, user.id, cachePayload).catch(() => {})

  return (
    <Suspense fallback={null}>
      <DashboardShell
        user={{ id: user.id, email: user.email, firstName }}
        accounts={accounts ?? []}
        stats={cachePayload.stats}
        variabelPerCategorie={variabelPerCategorie}
        sortedCategories={sortedCategories}
        briefing={briefing}
        transactionCount={cachePayload.transactionCount}
        subscriptionStatus={profile?.subscription_status ?? null}
        trialEndsAt={profile?.trial_ends_at ?? null}
        isPro={isPro}
        activeMonthLabel={activeMonthLabel}
        isHistoricData={isHistoricData}
        isBeta={profile?.is_beta ?? false}
      />
    </Suspense>
  )
}