import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { Suspense } from 'react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ─── Stap 1: Vind de meest recente maand met data ────────────────
  // Als er geen transacties zijn deze maand (bijv. geïmporteerde historische data),
  // pakken we automatisch de laatste maand waarvoor data bestaat.
  const { data: latestTx } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single()

  let activeDate: Date

  if (latestTx?.transaction_date) {
    const latest = new Date(latestTx.transaction_date)
    const now = new Date()

    // Als de nieuwste transactie in de huidige kalendermaand valt → gebruik huidige maand
    // Anders → gebruik de maand van de nieuwste transactie
    const sameMonth =
      latest.getFullYear() === now.getFullYear() &&
      latest.getMonth() === now.getMonth()

    activeDate = sameMonth ? now : latest
  } else {
    activeDate = new Date()
  }

  const startOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1)
    .toISOString().split('T')[0]
  const endOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const activeMonthLabel = activeDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const isHistoricData = (() => {
    const now = new Date()
    return !(activeDate.getFullYear() === now.getFullYear() && activeDate.getMonth() === now.getMonth())
  })()

  // ─── Stap 2: Data ophalen ────────────────────────────────────────
  const [
    { data: accounts },
    { data: transactions },
    { data: briefing },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, account_name, iban, balance')
      .eq('user_id', user.id),

    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .order('transaction_date', { ascending: false }),

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
  ])

  // ─── Stap 3: Stats berekenen ─────────────────────────────────────
  const byCategory: Record<string, { total: number; count: number }> = {}
  let totalUitgaven = 0
  let totalInkomen = 0
  let totalGespaard = 0

  transactions?.forEach(tx => {
    const cat = tx.category ?? 'overig'
    const amount = parseFloat(tx.amount)

    if (amount < 0) {
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
      byCategory[cat].total += Math.abs(amount)
      byCategory[cat].count += 1
      if (cat === 'sparen') {
        totalGespaard += Math.abs(amount)
      } else {
        totalUitgaven += Math.abs(amount)
      }
    } else {
      totalInkomen += amount
    }
  })

  const beschikbaar = Math.max(0, totalInkomen - totalUitgaven - totalGespaard)
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
        stats={{ totalUitgaven, totalInkomen, beschikbaar, spaarpct, totalGespaard }}
        sortedCategories={sortedCategories}
        briefing={briefing}
        transactionCount={transactions?.length ?? 0}
        subscriptionStatus={profile?.subscription_status ?? null}
        trialEndsAt={profile?.trial_ends_at ?? null}
        isPro={isPro}
      />
    </Suspense>
  )
}