// src/app/account/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountShell from '@/components/AccountShell'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accounts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, subscription_status, trial_ends_at, stripe_customer_id')
      .eq('id', user.id)
      .single(),
    supabase
      .from('bank_accounts')
      .select('id, account_name, iban, balance, account_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <AccountShell
      user={{
        id: user.id,
        email: user.email ?? '',
        fullName: profile?.full_name ?? null,
      }}
      subscription={{
        status: profile?.subscription_status ?? null,
        trialEndsAt: profile?.trial_ends_at ?? null,
        hasStripe: !!profile?.stripe_customer_id,
      }}
      accounts={accounts ?? []}
    />
  )
}