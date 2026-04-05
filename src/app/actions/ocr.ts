"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { UploadRecord } from "./upload";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type OcrActionResult =
  | { success: true }
  | { success: false; code: "unauthenticated" | "not_found" | "already_processing" | "server_error" };

// --------------------------------------------------------------------------
// Helpers internes
// --------------------------------------------------------------------------

function buildOcrUrl(uploadId: string): { url: string; secret: string } {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const secret = process.env.INTERNAL_OCR_SECRET ?? "";
  return { url: `${base}/api/ocr/process`, secret };
}

/**
 * Déclenche le traitement OCR de façon asynchrone (fire-and-forget).
 * L'appelant n'attend pas la fin de l'OCR.
 */
function triggerOcrAsync(uploadId: string): void {
  const { url, secret } = buildOcrUrl(uploadId);

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ uploadId }),
  }).catch((err: unknown) => {
    console.error("[ocr] Échec du déclenchement asynchrone :", err);
  });
}

// --------------------------------------------------------------------------
// retryOcr – relance le traitement OCR pour un upload échoué
// --------------------------------------------------------------------------

export async function retryOcr(uploadId: string): Promise<OcrActionResult> {
  // 1. Auth
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return { success: false, code: "unauthenticated" };

  // 2. Vérifier l'existence et la propriété (pas de RLS bypass : le user_id
  //    est vérifié manuellement pour un message d'erreur clair)
  const admin = createSupabaseServerClient();
  const { data: upload, error: fetchErr } = await admin
    .from("uploads")
    .select("id, user_id, ocr_status")
    .eq("id", uploadId)
    .single<Pick<UploadRecord, "id" | "user_id" | "ocr_status">>();

  if (fetchErr || !upload || upload.user_id !== user.id) {
    return { success: false, code: "not_found" };
  }

  // 3. Ne pas relancer si déjà en cours
  if (upload.ocr_status === "processing") {
    return { success: false, code: "already_processing" };
  }

  // 4. Remettre à zéro les champs OCR et extraction (l'extraction sera relancée après l'OCR)
  const { error: resetErr } = await admin
    .from("uploads")
    .update({
      ocr_status: "pending",
      ocr_text: null,
      ocr_error: null,
      ocr_processed_at: null,
      ocr_provider: null,
      extraction_status: "pending",
      extracted_fields: null,
      extraction_error: null,
      extraction_processed_at: null,
      extraction_version: null,
    })
    .eq("id", uploadId);

  if (resetErr) {
    console.error("[ocr] Erreur reset :", resetErr.message);
    return { success: false, code: "server_error" };
  }

  // 5. Déclencher l'OCR de façon asynchrone
  triggerOcrAsync(uploadId);

  revalidatePath("/dashboard");
  return { success: true };
}

// --------------------------------------------------------------------------
// getUploadWithOcr – récupère un upload avec ses données OCR (accès owner)
// --------------------------------------------------------------------------

export async function getUploadWithOcr(
  uploadId: string
): Promise<UploadRecord | null> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseServerClient();
  const { data } = await admin
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("user_id", user.id) // contrôle d'accès : owner uniquement
    .single<UploadRecord>();

  return data ?? null;
}

// Exporte le helper pour upload.ts (même fichier ne peut pas importer actions/)
export { triggerOcrAsync };
