import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal subscription op bij Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    await supabase
      .from('profiles')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status, // 'trialing' of 'active'
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      })
      .eq('id', user.id)

    return NextResponse.json({ ok: true, status: subscription.status })

  } catch (error: any) {
    console.error('Confirm subscription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}