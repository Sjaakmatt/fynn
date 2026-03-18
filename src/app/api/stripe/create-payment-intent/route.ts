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
      .select("stripe_customer_id, full_name, subscription_status, is_beta")
      .eq("id", user.id)
      .single();

    // Voorkom dubbele subscriptions
    if (
      profile?.subscription_status === "active" ||
      profile?.subscription_status === "trialing"
    ) {
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

    // Beta users: andere prijs + langere trial
    const isBeta = profile?.is_beta === true;
    const priceId = isBeta
      ? process.env.STRIPE_PRICE_ID_BETA!
      : process.env.STRIPE_PRICE_ID!;
    const trialDays = isBeta ? 90 : 14;

    // Maak subscription aan met trial
    // Trial = geen directe betaling, maar wél kaartgegevens opslaan via SetupIntent
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      trial_period_days: trialDays,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      metadata: {
        supabase_user_id: user.id,
        is_beta: isBeta ? "true" : "false",
      },
    });

    // ── 1) Trial → Stripe geeft een pending_setup_intent terug
    const pendingSetupIntent =
      subscription.pending_setup_intent as Stripe.SetupIntent | null;

    if (pendingSetupIntent?.client_secret) {
      // Sla subscription alvast op in profile (webhook doet het ook, maar dit is sneller)
      await supabase
        .from("profiles")
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", user.id);

      return NextResponse.json({
        clientSecret: pendingSetupIntent.client_secret,
        intentType: "setup_intent",
        subscriptionId: subscription.id,
      });
    }

    // ── 2) Geen trial → payment_intent op eerste factuur
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

    // ── 3) Fallback: handmatig SetupIntent aanmaken
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        supabase_user_id: user.id,
        subscription_id: subscription.id,
      },
    });

    await supabase
      .from("profiles")
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      })
      .eq("id", user.id);

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