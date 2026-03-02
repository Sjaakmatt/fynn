import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { Suspense } from 'react'

// ─── DECISION ENGINE ─────────────────────────────────────────────────────────
// Vrij te besteden = huidig saldo + nog te ontvangen inkomen − nog te betalen vaste lasten
// Checkt per recurring item of het al voorgekomen is in transacties van deze maand

interface RecurringItem {
  description: string
  amount: number       // positief = inkomen, negatief = uitgave
  category: string
  day_of_month: number
  confidence: number
}

interface DecisionResult {
  vrijTeBesteden: number
  nogTeBetalen: number
  nogTeOntvangen: number
  reedsBetaald: number
  reedsBinnengekomen: number
}

function runDecisionEngine(
  totalBalance: number,
  recurring: RecurringItem[],
  thisMonthTx: { amount: number }[],
  todayDay: number,
): DecisionResult {

  const paidAmounts = new Set<string>()
  for (const tx of thisMonthTx) {
    if (tx.amount < 0) paidAmounts.add(Math.abs(tx.amount).toFixed(2))
  }

  const expenses = recurring.filter(r => r.amount < 0)

  // Alleen vaste lasten die nog NIET betaald zijn én nog komen
  const pendingExpenses = expenses.filter(r => {
    const alreadyPaid = paidAmounts.has(Math.abs(r.amount).toFixed(2))
    return !alreadyPaid && r.day_of_month >= todayDay
  })

  const nogTeBetalen = pendingExpenses.reduce((s, r) => s + Math.abs(r.amount), 0)
  const reedsBetaald = expenses
    .filter(r => paidAmounts.has(Math.abs(r.amount).toFixed(2)))
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  return {
    vrijTeBesteden: Math.max(0, totalBalance - nogTeBetalen),
    nogTeBetalen,
    nogTeOntvangen: 0,   // niet meer relevant voor hoofdberekening
    reedsBetaald,
    reedsBinnengekomen: 0,
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const todayDay = today.getDate()

  // Huidige maand
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  // ─── Data ophalen (parallel) ─────────────────────────────────────
  const [
    { data: accounts },
    { data: thisMonthTx },
    { data: allRecurring },
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
      .from('recurring_items')
      .select('description, amount, category, day_of_month, confidence')
      .eq('user_id', user.id),

    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at')
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

  // ─── Decision Engine ─────────────────────────────────────────────
  // Gebruik alleen betaalrekening(en) voor saldo — niet spaarrekeningen
  const totalBalance = (accounts ?? [])
    .filter(a => a.account_type !== 'SAVINGS')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)

  const recurringItems: RecurringItem[] = (allRecurring ?? []).map(r => ({
    description: r.description,
    amount: parseFloat(r.amount),
    category: r.category ?? 'overig',
    day_of_month: r.day_of_month ?? 1,
    confidence: parseFloat(r.confidence ?? '0.7'),
  }))

  const txForEngine = (thisMonthTx ?? []).map(tx => ({
    amount: parseFloat(tx.amount),
  }))

  const engine = runDecisionEngine(totalBalance, recurringItems, txForEngine, todayDay)

  // ─── Analyse tab — gebruik meest recente maand met data ──────────
  // Als er geen data is deze maand (historische import), pak dan de laatste maand met data
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

  // Haal analyse transacties op (andere maand als historische data)
  const { data: analyseTx } = isHistoricData
    ? await supabase
        .from('transactions')
        .select('amount, category')
        .eq('user_id', user.id)
        .gte('transaction_date', analyseStart)
        .lte('transaction_date', analyseEnd)
    : { data: thisMonthTx }

  // ─── Categorie stats voor Analyse tab ────────────────────────────
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

  return (
    <Suspense fallback={null}>
      <DashboardShell
        user={{ id: user.id, email: user.email }}
        accounts={accounts ?? []}
        stats={{
          // Decision Engine — wat telt op de overzicht tab
          beschikbaar: engine.vrijTeBesteden,
          nogTeBetalen: engine.nogTeBetalen,
          nogTeOntvangen: engine.nogTeOntvangen,
          reedsBetaald: engine.reedsBetaald,
          totalBalance,

          // Analyse tab stats
          totalUitgaven,
          totalInkomen,
          totalGespaard,
          spaarpct,
        }}
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