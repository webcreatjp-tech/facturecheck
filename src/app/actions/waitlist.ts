"use server";

import { createSupabaseServerClient } from "@/lib/supabase";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type WaitlistSource = "hero" | "footer";

export type WaitlistResult =
  | { success: true }
  | { success: false; code: "duplicate" | "invalid_email" | "server_error" };

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

// RFC 5322 simplifié – chaque label de domaine séparé par un point unique
// Exemples valides : user@example.com, prenom.nom@sub.domain.fr
// Rejette : user@domain..fr, @domain.fr, user@
const EMAIL_REGEX =
  /^[A-Za-z0-9._%+\-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

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
