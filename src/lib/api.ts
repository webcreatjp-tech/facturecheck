// Helpers côté serveur pour déclencher les étapes du pipeline en fire-and-forget.
// Ce fichier N'est PAS un "use server" — il peut être importé depuis les routes API
// et les Server Actions sans restriction.

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
