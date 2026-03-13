// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Webhook heeft geen user session — gebruik service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateProfile(
  customerId: string,
  updates: Record<string, unknown>
) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(
      `[stripe webhook] Profile update failed for ${customerId}:`,
      error
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        // Haal actuele subscription op voor correcte status en trial_end
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await updateProfile(customerId, {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          trial_ends_at: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await updateProfile(customerId, {
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        trial_ends_at: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      await updateProfile(sub.customer as string, {
        subscription_status: "canceled",
        stripe_subscription_id: null,
        trial_ends_at: null,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      await updateProfile(invoice.customer as string, {
        subscription_status: "past_due",
      });
      break;
    }

    case "setup_intent.succeeded": {
      // Fallback SetupIntent flow: koppel payment method aan customer + subscription
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const customerId = setupIntent.customer as string;
      const paymentMethodId = setupIntent.payment_method as string;
      const subscriptionId = setupIntent.metadata?.subscription_id;

      if (customerId && paymentMethodId) {
        try {
          // Stel default payment method in op customer level
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });

          // Als er een subscription_id in metadata zit, koppel daar ook
          if (subscriptionId) {
            await stripe.subscriptions.update(subscriptionId, {
              default_payment_method: paymentMethodId,
            });
          }
        } catch (err) {
          console.error(
            "[stripe webhook] Payment method koppelen mislukt:",
            err
          );
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}