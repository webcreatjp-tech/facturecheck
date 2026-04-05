"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { UploadRecord } from "./upload";
import type { ComplianceResultRecord } from "@/lib/compliance/types";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ComplianceActionResult =
  | { success: true }
  | {
      success: false;
      code:
        | "unauthenticated"
        | "not_found"
        | "extraction_not_ready"
        | "already_processing"
        | "server_error";
    };

import { triggerComplianceAsync } from "@/lib/api";

// --------------------------------------------------------------------------
// retryCompliance – relance la vérification pour un upload dont l'extraction est prête
// --------------------------------------------------------------------------

export async function retryCompliance(
  uploadId: string
): Promise<ComplianceActionResult> {
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
    .select("id, user_id, extraction_status, compliance_status")
    .eq("id", uploadId)
    .single<
      Pick<
        UploadRecord,
        "id" | "user_id" | "extraction_status" | "compliance_status"
      >
    >();

  if (fetchErr || !upload || upload.user_id !== user.id) {
    return { success: false, code: "not_found" };
  }

  // 3. L'extraction doit être terminée
  if (upload.extraction_status !== "extracted") {
    return { success: false, code: "extraction_not_ready" };
  }

  // 4. Ne pas relancer si déjà en cours
  if (upload.compliance_status === "processing") {
    return { success: false, code: "already_processing" };
  }

  // 5. Remettre à zéro le statut
  const { error: resetErr } = await admin
    .from("uploads")
    .update({
      compliance_status: "pending",
      compliance_score:  null,
      compliance_band:   null,
    })
    .eq("id", uploadId);

  if (resetErr) {
    console.error("[compliance] Erreur reset :", resetErr.message);
    return { success: false, code: "server_error" };
  }

  // 6. Déclencher de façon asynchrone
  triggerComplianceAsync(uploadId);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/uploads/${uploadId}`);
  return { success: true };
}

// --------------------------------------------------------------------------
// getComplianceResult – récupère le résultat de conformité (accès owner)
// --------------------------------------------------------------------------

export async function getComplianceResult(
  uploadId: string
): Promise<ComplianceResultRecord | null> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseServerClient();
  const { data } = await admin
    .from("compliance_results")
    .select("*")
    .eq("upload_id", uploadId)
    .eq("user_id", user.id) // contrôle d'accès : owner uniquement
    .single<ComplianceResultRecord>();

  return data ?? null;
}
