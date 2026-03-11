// src/app/api/account/delete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = user.id

    // 1) Revoke Plaid access tokens
    try {
      const { data: plaidItems } = await supabase
        .from('plaid_items')
        .select('access_token')
        .eq('user_id', userId)

      if (plaidItems && plaidItems.length > 0 && process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
        const plaidBaseUrl = process.env.PLAID_ENV === 'production'
          ? 'https://production.plaid.com'
          : process.env.PLAID_ENV === 'development'
          ? 'https://development.plaid.com'
          : 'https://sandbox.plaid.com'

        for (const item of plaidItems) {
          await fetch(`${plaidBaseUrl}/item/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: process.env.PLAID_CLIENT_ID,
              secret: process.env.PLAID_SECRET,
              access_token: item.access_token,
            }),
          }).catch(() => {})
        }
      }
    } catch {
      console.warn('[Delete] Plaid token revocation failed — continuing')
    }

    // 2) Cancel Stripe subscription if active
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()

      if (profile?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
        })

        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id).catch(() => {})
        }

        const trials = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'trialing',
        })

        for (const sub of trials.data) {
          await stripe.subscriptions.cancel(sub.id).catch(() => {})
        }
      }
    } catch {
      console.warn('[Delete] Stripe cancellation failed — continuing')
    }

    // 3) Delete all user data from Supabase (order matters for FK constraints)
    const tables = [
      'merchant_user_overrides',
      'transactions',
      'plaid_items',
      'bank_accounts',
      'enablebanking_sessions',
      'briefings',
      'savings_goals',
    ]

    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', userId)
    }

    // Profile uses 'id' not 'user_id'
    await supabase.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Delete] Account deletion error:', error)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }
}