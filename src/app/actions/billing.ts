"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { getOrCreateProfile } from "@/lib/billing";
import type { UserProfile } from "@/lib/billing/types";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type BillingActionResult =
  | { success: true; url: string }
  | { success: false; code: "unauthenticated" | "no_price_id" | "server_error" };

// --------------------------------------------------------------------------
// createCheckoutSession
// --------------------------------------------------------------------------

/**
 * Crée une session Stripe Checkout pour le plan donné.
 * Retourne l'URL de redirection vers la page de paiement Stripe.
 */
export async function createCheckoutSession(
  planId: "starter" | "pro"
): Promise<BillingActionResult> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return { success: false, code: "unauthenticated" };

  // Lire les price IDs au moment de l'appel (après chargement des env vars)
  const priceIds: Record<"starter" | "pro", string | undefined> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
  };
  const priceId = priceIds[planId];
  if (!priceId) return { success: false, code: "no_price_id" };

  try {
    const profile = await getOrCreateProfile(user.id);
    const stripe = getStripe();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";

    // Récupérer ou créer le customer Stripe
    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return { success: true, url: session.url! };
  } catch (err) {
    console.error("[billing] createCheckoutSession error:", err);
    return { success: false, code: "server_error" };
  }
}

// --------------------------------------------------------------------------
// createPortalSession
// --------------------------------------------------------------------------

/**
 * Crée une session Stripe Customer Portal.
 * Permet à l'utilisateur de gérer son abonnement (annulation, changement, facturation).
 */
export async function createPortalSession(): Promise<BillingActionResult> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return { success: false, code: "unauthenticated" };

  const profile = await getOrCreateProfile(user.id);

  if (!profile?.stripe_customer_id) {
    return { success: false, code: "server_error" };
  }

  try {
    const stripe = getStripe();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[billing] createPortalSession error:", err);
    return { success: false, code: "server_error" };
  }
}

// --------------------------------------------------------------------------
// getUserProfile
// --------------------------------------------------------------------------

/**
 * Retourne le profil de facturation de l'utilisateur connecté.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return null;

  return getOrCreateProfile(user.id);
}

// --------------------------------------------------------------------------
// refreshBillingPage (revalidation cache)
// --------------------------------------------------------------------------

export async function refreshBillingPage(): Promise<void> {
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
}
