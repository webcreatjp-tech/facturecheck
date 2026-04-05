import { createSupabaseServerClient } from "@/lib/supabase";
import type { QuotaCheck, SubscriptionStatus, UserProfile } from "./types";

// --------------------------------------------------------------------------
// Limites par plan
// --------------------------------------------------------------------------

const LIMITS: Record<SubscriptionStatus, number | null> = {
  free: 3,
  starter: 10,
  pro: null,   // illimité
  canceled: 3, // rétrogradé au niveau gratuit
};

// --------------------------------------------------------------------------
// getOrCreateProfile
// --------------------------------------------------------------------------

/**
 * Récupère le profil de facturation d'un utilisateur.
 * Si le profil n'existe pas encore, le crée avec les valeurs par défaut (plan free).
 */
export async function getOrCreateProfile(
  userId: string
): Promise<UserProfile | null> {
  const admin = createSupabaseServerClient();

  // Tentative de lecture
  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<UserProfile>();

  if (existing) return existing;

  // Création avec valeurs par défaut
  const { data: created, error } = await admin
    .from("profiles")
    .insert({
      id: userId,
      subscription_status: "free",
      invoices_used_this_month: 0,
      invoices_limit: LIMITS.free,
    })
    .select()
    .single<UserProfile>();

  if (error) {
    console.error("[billing] getOrCreateProfile error:", error.message);
    return null;
  }

  return created;
}

// --------------------------------------------------------------------------
// checkUploadQuota
// --------------------------------------------------------------------------

/**
 * Vérifie si l'utilisateur peut encore uploader une facture ce mois-ci.
 */
export async function checkUploadQuota(
  userId: string
): Promise<QuotaCheck> {
  const profile = await getOrCreateProfile(userId);

  if (!profile) {
    // Fail-open : si le profil est inaccessible, autoriser pour éviter de bloquer
    // l'utilisateur à cause d'un problème d'infrastructure.
    return { allowed: true, used: 0, limit: null, remaining: null };
  }

  const limit = LIMITS[profile.subscription_status];
  const used = profile.invoices_used_this_month;

  if (limit === null) {
    return { allowed: true, used, limit: null, remaining: null };
  }

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: limit - used,
  };
}

// --------------------------------------------------------------------------
// incrementUsage
// --------------------------------------------------------------------------

/**
 * Incrémente le compteur d'uploads du mois en cours via une fonction SQL atomique.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const admin = createSupabaseServerClient();
  const { error } = await admin.rpc("increment_invoices_used", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[billing] incrementUsage error:", error.message);
  }
}

// --------------------------------------------------------------------------
// updateProfileFromStripe (appelé par le webhook)
// --------------------------------------------------------------------------

/**
 * Met à jour le profil utilisateur depuis les données Stripe.
 * Synchronise le status et la limite selon le plan souscrit.
 */
export async function updateProfileFromStripe(
  userId: string,
  params: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string | null;
    subscription_status: SubscriptionStatus;
    subscription_period_end?: string | null;
    reset_usage?: boolean;
  }
): Promise<void> {
  const admin = createSupabaseServerClient();

  const updatePayload: Record<string, unknown> = {
    subscription_status: params.subscription_status,
    invoices_limit: LIMITS[params.subscription_status],
  };

  if (params.stripe_customer_id !== undefined) {
    updatePayload.stripe_customer_id = params.stripe_customer_id;
  }
  if (params.stripe_subscription_id !== undefined) {
    updatePayload.stripe_subscription_id = params.stripe_subscription_id;
  }
  if (params.subscription_period_end !== undefined) {
    updatePayload.subscription_period_end = params.subscription_period_end;
  }
  if (params.reset_usage) {
    updatePayload.invoices_used_this_month = 0;
  }

  const { error } = await admin
    .from("profiles")
    .upsert({ id: userId, ...updatePayload }, { onConflict: "id" });

  if (error) {
    console.error("[billing] updateProfileFromStripe error:", error.message);
  }
}
