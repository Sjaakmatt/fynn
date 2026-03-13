// src/app/api/stripe/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!subscriptionId || typeof subscriptionId !== "string") {
      return NextResponse.json(
        { error: "Missing subscriptionId" },
        { status: 400 }
      );
    }

    // Haal subscription op bij Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Verifieer dat de subscription bij deze user hoort
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (
      !profile?.stripe_customer_id ||
      subscription.customer !== profile.stripe_customer_id
    ) {
      return NextResponse.json(
        { error: "Subscription behoort niet tot deze gebruiker" },
        { status: 403 }
      );
    }

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

    return NextResponse.json({ ok: true, status: subscription.status });
  } catch (error: unknown) {
    console.error("Confirm subscription error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}