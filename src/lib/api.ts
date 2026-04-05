// Helpers partagés — ni "use server" ni "use client".
// Peut être importé depuis les routes API, Server Actions et Client Components.

import { joinWaitlist, type WaitlistSource } from "@/app/actions/waitlist";

// --------------------------------------------------------------------------
// Waitlist
// --------------------------------------------------------------------------

const ERROR_MESSAGES: Record<"duplicate" | "invalid_email" | "server_error", string> = {
  duplicate: "Cette adresse email est déjà inscrite sur la liste d'attente.",
  invalid_email: "Veuillez saisir une adresse email valide.",
  server_error: "Une erreur est survenue. Veuillez réessayer.",
};

export class WaitlistError extends Error {
  constructor(
    message: string,
    public readonly code: "duplicate" | "invalid_email" | "server_error"
  ) {
    super(message);
    this.name = "WaitlistError";
  }
}

export async function registerWaitlistEmail(
  email: string,
  source: WaitlistSource
): Promise<void> {
  const result = await joinWaitlist(email, source);
  if (!result.success) {
    throw new WaitlistError(ERROR_MESSAGES[result.code], result.code);
  }
}

// --------------------------------------------------------------------------
// Pipeline fire-and-forget triggers
// --------------------------------------------------------------------------

function buildInternalHeaders() {
  return {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.INTERNAL_OCR_SECRET ?? "",
  };
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
}

/** Déclenche l'OCR de façon asynchrone (fire-and-forget). */
export function triggerOcrAsync(uploadId: string): void {
  fetch(`${baseUrl()}/api/ocr/process`, {
    method: "POST",
    headers: buildInternalHeaders(),
    body: JSON.stringify({ uploadId }),
  }).catch((err: unknown) => {
    console.error("[pipeline] Échec déclenchement OCR :", err);
  });
}

/** Déclenche l'extraction structurée de façon asynchrone (fire-and-forget). */
export function triggerExtractionAsync(uploadId: string): void {
  fetch(`${baseUrl()}/api/extraction/process`, {
    method: "POST",
    headers: buildInternalHeaders(),
    body: JSON.stringify({ uploadId }),
  }).catch((err: unknown) => {
    console.error("[pipeline] Échec déclenchement extraction :", err);
  });
}

/** Déclenche la vérification de conformité de façon asynchrone (fire-and-forget). */
export function triggerComplianceAsync(uploadId: string): void {
  fetch(`${baseUrl()}/api/compliance/check`, {
    method: "POST",
    headers: buildInternalHeaders(),
    body: JSON.stringify({ uploadId }),
  }).catch((err: unknown) => {
    console.error("[pipeline] Échec déclenchement conformité :", err);
  });
}
