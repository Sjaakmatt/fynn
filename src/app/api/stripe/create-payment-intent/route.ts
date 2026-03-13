// src/app/api/stripe/create-payment-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!user.email) {
      return NextResponse.json(
        { error: "Geen email gekoppeld aan je account" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name, subscription_status")
      .eq("id", user.id)
      .single();

    // Voorkom dubbele subscriptions
    if (profile?.subscription_status === "active") {
      return NextResponse.json(
        { error: "Je hebt al een actief abonnement" },
        { status: 409 }
      );
    }

    // Zorg dat er een Stripe customer is
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Maak subscription aan met trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.STRIPE_PRICE_ID! }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card", "sepa_debit"],
        save_default_payment_method: "on_subscription",
      },
      trial_period_days: 14,
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      metadata: {
        supabase_user_id: user.id,
      },
    });

    // Probeer PaymentIntent client secret te pakken
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent?: Stripe.PaymentIntent | null;
    } | null;

    const paymentIntent = latestInvoice?.payment_intent ?? null;

    if (paymentIntent?.client_secret) {
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        intentType: "payment_intent",
        subscriptionId: subscription.id,
      });
    }

    // Trial zonder directe betaling → SetupIntent
    const pendingSetupIntent =
      subscription.pending_setup_intent as Stripe.SetupIntent | null;

    if (pendingSetupIntent?.client_secret) {
      return NextResponse.json({
        clientSecret: pendingSetupIntent.client_secret,
        intentType: "setup_intent",
        subscriptionId: subscription.id,
      });
    }

    // Fallback: handmatig SetupIntent aanmaken
    // NB: deze wordt niet automatisch aan de subscription gekoppeld —
    // de webhook moet de default payment method koppelen bij setup_intent.succeeded
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        supabase_user_id: user.id,
        subscription_id: subscription.id,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      intentType: "setup_intent",
      subscriptionId: subscription.id,
    });
  } catch (error: unknown) {
    console.error("Create payment intent error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}