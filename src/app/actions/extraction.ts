"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { UploadRecord } from "./upload";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ExtractionActionResult =
  | { success: true }
  | {
      success: false;
      code:
        | "unauthenticated"
        | "not_found"
        | "ocr_not_ready"
        | "already_processing"
        | "server_error";
    };

import { triggerExtractionAsync } from "@/lib/api";

// --------------------------------------------------------------------------
// retryExtraction – relance l'extraction pour un upload dont l'OCR est prêt
// --------------------------------------------------------------------------

export async function retryExtraction(
  uploadId: string
): Promise<ExtractionActionResult> {
  // 1. Auth
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return { success: false, code: "unauthenticated" };

  // 2. Vérifier existence et propriété
  const admin = createSupabaseServerClient();
  const { data: upload, error: fetchErr } = await admin
    .from("uploads")
    .select("id, user_id, ocr_status, extraction_status")
    .eq("id", uploadId)
    .single<
      Pick<UploadRecord, "id" | "user_id" | "ocr_status" | "extraction_status">
    >();

  if (fetchErr || !upload || upload.user_id !== user.id) {
    return { success: false, code: "not_found" };
  }

  // 3. L'OCR doit être terminé
  if (upload.ocr_status !== "processed") {
    return { success: false, code: "ocr_not_ready" };
  }

  // 4. Ne pas relancer si déjà en cours
  if (upload.extraction_status === "processing") {
    return { success: false, code: "already_processing" };
  }

  // 5. Remettre à zéro les champs d'extraction et de conformité
  const { error: resetErr } = await admin
    .from("uploads")
    .update({
      extraction_status:      "pending",
      extracted_fields:       null,
      extraction_error:       null,
      extraction_processed_at: null,
      extraction_version:     null,
      compliance_status:      null,
      compliance_score:       null,
      compliance_band:        null,
    })
    .eq("id", uploadId);

  if (resetErr) {
    console.error("[extraction] Erreur reset :", resetErr.message);
    return { success: false, code: "server_error" };
  }

  // 6. Déclencher de façon asynchrone
  triggerExtractionAsync(uploadId);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/uploads/${uploadId}`);
  return { success: true };
}
