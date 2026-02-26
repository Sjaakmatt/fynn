import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import ConnectBank from '@/components/ConnectBank'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('id, account_name, iban, balance')
    .eq('user_id', user.id)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .not('category', 'is', null)
    .order('transaction_date', { ascending: false })

  const { data: briefing } = await supabase
    .from('briefings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Na de bestaande queries
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

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
      if (cat === 'sparen') totalGespaard += Math.abs(amount)
      else totalUitgaven += Math.abs(amount)
    } else {
      totalInkomen += amount
    }
  })

  const beschikbaar = totalInkomen - totalUitgaven - totalGespaard
  const spaarpct = totalInkomen > 0 ? ((totalGespaard / totalInkomen) * 100).toFixed(0) : '0'
  const sortedCategories = Object.entries(byCategory)
    .filter(([cat]) => cat !== 'sparen')
    .sort((a, b) => b[1].total - a[1].total)

  const isPro = profile?.subscription_status === 'active' || 
              profile?.subscription_status === 'trialing'

  return (
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
  )
}