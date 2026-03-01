import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

// POST /api/stripe/connect
// Maakt een Stripe Financial Connections session aan en geeft de client_secret terug.
// De frontend gebruikt deze client_secret om de Stripe modal te openen.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Zoek of maak een Stripe customer voor deze user
    let stripeCustomerId: string

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id
    } else {
      // Maak een nieuwe Stripe customer aan
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id

      // Sla op in profiles
      await supabase
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: stripeCustomerId })
    }

    // Maak Financial Connections session aan
    const session = await stripe.financialConnections.sessions.create({
      account_holder: {
        type: 'customer',
        customer: stripeCustomerId,
      },
      permissions: ['balances', 'transactions', 'ownership'],
      filters: {
        countries: ['NL', 'BE'],
      },
    })

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    })

  } catch (error) {
    console.error('[stripe/connect] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}