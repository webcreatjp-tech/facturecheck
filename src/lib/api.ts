import {
  joinWaitlist,
  type WaitlistSource,
} from "@/app/actions/waitlist";

// --------------------------------------------------------------------------
// Erreur typée
// --------------------------------------------------------------------------

export class WaitlistError extends Error {
  constructor(
    message: string,
    public readonly code: "duplicate" | "invalid_email" | "server_error"
  ) {
    super(message);
    this.name = "WaitlistError";
  }
}

// Messages d'erreur en français
const ERROR_MESSAGES: Record<WaitlistError["code"], string> = {
  duplicate:
    "Cette adresse email est déjà inscrite sur la liste d'attente.",
  invalid_email: "Veuillez saisir une adresse email valide.",
  server_error: "Une erreur est survenue. Veuillez réessayer.",
};

// --------------------------------------------------------------------------
// API publique
// --------------------------------------------------------------------------

/**
 * Inscrit un email sur la liste d'attente.
 * @param email  Adresse email saisie par l'utilisateur
 * @param source Zone d'origine du formulaire ("hero" | "footer")
 * @throws {WaitlistError} si l'email est invalide, déjà inscrit, ou en cas d'erreur serveur
 */
export async function registerWaitlistEmail(
  email: string,
  source: WaitlistSource
): Promise<void> {
  const result = await joinWaitlist(email, source);

  if (!result.success) {
    throw new WaitlistError(ERROR_MESSAGES[result.code], result.code);
  }
}
