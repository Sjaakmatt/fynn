import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { Suspense } from 'react'

// ─── DECISION ENGINE ──────────────────────────────────────────────────────────
// Gebruikt calendar items (merchant_map gebaseerd) ipv recurring_items tabel
// Vrij te besteden = saldo − nog te betalen vaste lasten deze maand

interface CalendarItem {
  name: string
  amount: number
  thisMonthDate: string
  dayOfMonth: number
  daysUntil: number
  isPast: boolean
  merchantKey: string
}

function runDecisionEngine(
  totalBalance: number,
  calendarItems: CalendarItem[],
  todayDay: number,
): {
  vrijTeBesteden: number
  nogTeBetalen: number
  reedsBetaald: number
} {
  // Vaste lasten die al betaald zijn deze maand (isPast = true of daysUntil < 0)
  const reedsBetaald = calendarItems
    .filter(i => i.isPast)
    .reduce((s, i) => s + i.amount, 0)

  // Vaste lasten die nog komen
  const nogTeBetalen = calendarItems
    .filter(i => !i.isPast)
    .reduce((s, i) => s + i.amount, 0)

  return {
    vrijTeBesteden: Math.max(0, totalBalance - nogTeBetalen),
    nogTeBetalen,
    reedsBetaald,
  }
}

// ─── Naam uit email ───────────────────────────────────────────────────────────
function parseFirstName(fullName: string | null, email: string | undefined): string {
  if (fullName) return fullName.split(' ')[0]
  if (!email) return 'daar'
  const local = email.split('@')[0]
  // "sjaakterveld" → probeer bekende patronen
  // "sjaak.terveld" → "Sjaak"
  // "sjaak_terveld" → "Sjaak"
  const parts = local.split(/[._\-+]/)
  if (parts.length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  }
  // Geen scheidingsteken — geef gewoon de lokale naam terug met hoofdletter
  return local.charAt(0).toUpperCase() + local.slice(1)
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

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

  // ─── Data ophalen (parallel) ─────────────────────────────────────
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

  // ─── Saldo (alleen betaalrekeningen) ─────────────────────────────
  const totalBalance = (accounts ?? [])
    .filter(a => a.account_type !== 'SAVINGS')
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)

  // ─── Calendar items ophalen voor Decision Engine ──────────────────
  // Gebruik de calendar API intern — zelfde logica als de kalender tab
  let calendarItems: CalendarItem[] = []
  try {
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
      .toISOString().split('T')[0]

    const [{ data: merchantMap }, { data: overrides }, { data: recentTx }] = await Promise.all([
      supabase.from('merchant_map').select('merchant_key, merchant_name').eq('recurring_hint', true).or('is_variable.is.null,is_variable.eq.false'),
      supabase.from('merchant_user_overrides').select('merchant_key, is_variable').eq('user_id', user.id),
      supabase.from('transactions').select('merchant_key, merchant_name, amount, transaction_date').eq('user_id', user.id).lt('amount', 0).gte('transaction_date', threeMonthsAgo),
    ])

    console.log('[Dashboard] merchantMap:', merchantMap?.length, 'recentTx:', recentTx?.length)
    console.log('[Dashboard] sample:', merchantMap?.slice(0, 2))

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

  // ─── Decision Engine ─────────────────────────────────────────────
  console.log('[Dashboard] calendarItems:', calendarItems.length, calendarItems.map(i => `${i.name} €${i.amount} dag${i.dayOfMonth} isPast:${i.isPast}`))

  const engine = runDecisionEngine(totalBalance, calendarItems, todayDay)

  console.log('[Dashboard] engine:', engine)
  console.log('[Dashboard] totalBalance:', totalBalance)

  // ─── Analyse: meest recente maand met data ────────────────────────
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

  // ─── Categorie stats ──────────────────────────────────────────────
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

  // ─── Naam ─────────────────────────────────────────────────────────
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
          totalBalance,
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