import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .single()

    // Zorg dat er een Stripe customer is
    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Maak subscription aan met trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card', 'sepa_debit'],
        save_default_payment_method: 'on_subscription',
      },
      trial_period_days: 14,
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        supabase_user_id: user.id,
      },
    })

    // Probeer PaymentIntent client secret te pakken
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent?: Stripe.PaymentIntent | null
    } | null

    const paymentIntent = latestInvoice?.payment_intent ?? null

    if (paymentIntent?.client_secret) {
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        intentType: 'payment_intent',
        subscriptionId: subscription.id,
      })
    }

    // Trial zonder directe betaling → SetupIntent
    const pendingSetupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null

    if (pendingSetupIntent?.client_secret) {
      return NextResponse.json({
        clientSecret: pendingSetupIntent.client_secret,
        intentType: 'setup_intent',
        subscriptionId: subscription.id,
      })
    }

    // Fallback: maak handmatig een SetupIntent aan
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        supabase_user_id: user.id,
        subscriptionId: subscription.id,
      },
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      intentType: 'setup_intent',
      subscriptionId: subscription.id,
    })

  } catch (error: any) {
    console.error('Create payment intent error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}