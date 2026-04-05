"use server";

import { createSupabaseServerClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/utils";

// --------------------------------------------------------------------------
// Action principale
// --------------------------------------------------------------------------

/**
 * Inscrit un email sur la liste d'attente FactureCheck.
 * Valide le format côté serveur, normalise en minuscules,
 * et gère les doublons avec un message convivial.
 */
export async function joinWaitlist(
  email: string,
  source: WaitlistSource
): Promise<WaitlistResult> {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !isValidEmail(normalized)) {
    return { success: false, code: "invalid_email" };
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("waitlist")
    .insert({ email: normalized, source });

  if (error) {
    // Code PostgreSQL 23505 = violation de contrainte unique
    if (error.code === "23505") {
      return { success: false, code: "duplicate" };
    }
    console.error("[waitlist] Erreur Supabase :", error.message, error.code);
    return { success: false, code: "server_error" };
  }

  return { success: true };
}
