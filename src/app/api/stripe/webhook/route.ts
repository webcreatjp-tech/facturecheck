import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { updateProfileFromStripe } from "@/lib/billing";
import type { SubscriptionStatus } from "@/lib/billing/types";

// Route handler Node.js (signature Stripe nécessite le body brut)
export const runtime = "nodejs";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Convertit le status Stripe en SubscriptionStatus interne.
 */
function toSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): SubscriptionStatus {
  if (stripeStatus === "active" || stripeStatus === "trialing") {
    return "starter"; // plan sera raffiné via les metadata
  }
  if (stripeStatus === "canceled" || stripeStatus === "unpaid") {
    return "canceled";
  }
  return "free";
}

/**
 * Détermine le plan à partir des items de la subscription Stripe.
 */
function resolvePlanFromSubscription(
  sub: Stripe.Subscription
): SubscriptionStatus {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) return toSubscriptionStatus(sub.status);

  if (priceId === proPriceId) return "pro";
  if (priceId === starterPriceId) return "starter";
  return toSubscriptionStatus(sub.status);
}

// --------------------------------------------------------------------------
// POST /api/stripe/webhook
// --------------------------------------------------------------------------

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe-signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error("[webhook] Event handling error:", err);
    return NextResponse.json({ error: "Event handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// --------------------------------------------------------------------------
// Event dispatcher
// --------------------------------------------------------------------------

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription
      );
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription
      );
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    default:
      // Ignorer les événements non gérés
      break;
  }
}

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[webhook] checkout.session.completed: missing supabase_user_id");
    return;
  }

  // Récupérer la subscription pour connaître le plan
  if (!session.subscription) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await updateProfileFromStripe(userId, {
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: sub.id,
    subscription_status: resolvePlanFromSubscription(sub),
    subscription_period_end:
      sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
  });
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[webhook] customer.subscription.updated: missing supabase_user_id");
    return;
  }

  await updateProfileFromStripe(userId, {
    stripe_subscription_id: sub.id,
    subscription_status: resolvePlanFromSubscription(sub),
    subscription_period_end:
      sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
  });
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.warn("[webhook] customer.subscription.deleted: missing supabase_user_id");
    return;
  }

  await updateProfileFromStripe(userId, {
    stripe_subscription_id: null,
    subscription_status: "canceled",
    subscription_period_end: null,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Remise à zéro du compteur mensuel à chaque renouvellement
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  // Récupérer le user_id depuis le customer Stripe
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const userId = (customer as Stripe.Customer).metadata?.supabase_user_id;
  if (!userId) return;

  // Remettre à zéro l'usage du mois
  const { createSupabaseServerClient } = await import("@/lib/supabase");
  const admin = createSupabaseServerClient();
  await admin.rpc("reset_invoices_used", { p_user_id: userId });
}
