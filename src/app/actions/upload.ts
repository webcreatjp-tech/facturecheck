"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { checkUploadQuota, incrementUsage } from "@/lib/billing";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
  STORAGE_BUCKET,
  buildStoragePath,
} from "@/lib/upload-config";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface UploadRecord {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  status: "uploaded" | "processing" | "done" | "error";
  created_at: string;
  // Champs OCR (T004) — optionnels : absents avant la migration 004
  ocr_status?: "pending" | "processing" | "processed" | "failed";
  ocr_text?: string | null;
  ocr_error?: string | null;
  ocr_processed_at?: string | null;
  ocr_provider?: string | null;
  // Champs extraction structurée (T005) — optionnels : absents avant la migration 005
  extraction_status?: "pending" | "processing" | "extracted" | "failed";
  extraction_error?: string | null;
  extraction_processed_at?: string | null;
  extraction_version?: string | null;
  extracted_fields?: Record<string, unknown> | null;
  // Champs conformité (T006) — optionnels : absents avant la migration 006
  compliance_status?: "pending" | "processing" | "checked" | "failed";
  compliance_score?: number | null;
  compliance_band?: "conforme" | "attention" | "non_conforme_corrections" | "non_conforme_invalide" | null;
}

export type UploadErrorCode =
  | "unauthenticated"
  | "quota_exceeded"
  | "invalid_type"
  | "too_large"
  | "upload_error";

export type UploadResult =
  | { success: true; upload: UploadRecord }
  | { success: false; code: UploadErrorCode };

// --------------------------------------------------------------------------
// Helper interne : déclenche l'OCR de façon asynchrone
// --------------------------------------------------------------------------

function triggerOcrAsync(uploadId: string): void {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const secret = process.env.INTERNAL_OCR_SECRET ?? "";

  fetch(`${base}/api/ocr/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ uploadId }),
  }).catch((err: unknown) => {
    console.error("[upload] Échec du déclenchement OCR :", err);
  });
}

// --------------------------------------------------------------------------
// Action principale : téléversement d'une facture PDF
// --------------------------------------------------------------------------

export async function uploadInvoice(formData: FormData): Promise<UploadResult> {
  // 1. Vérification de l'authentification
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return { success: false, code: "unauthenticated" };
  }

  // 2. Vérification du quota mensuel
  const quota = await checkUploadQuota(user.id);
  if (!quota.allowed) {
    return { success: false, code: "quota_exceeded" };
  }

  // 3. Récupération et validation serveur du fichier
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, code: "invalid_type" };
  }

  if (file.type !== UPLOAD_ALLOWED_MIME) {
    return { success: false, code: "invalid_type" };
  }

  if (file.size > UPLOAD_MAX_BYTES) {
    return { success: false, code: "too_large" };
  }

  // 4. Génération d'un chemin de stockage sûr et unique
  const storagePath = buildStoragePath(user.id, file.name);

  // 5. Téléversement vers Supabase Storage (via service role)
  const adminClient = createSupabaseServerClient();

  const { error: storageError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: UPLOAD_ALLOWED_MIME,
      upsert: false,
    });

  if (storageError) {
    console.error("[upload] Erreur Storage :", storageError.message);
    return { success: false, code: "upload_error" };
  }

  // 6. Insertion des métadonnées en base (ocr_status = 'pending' par défaut via DB)
  const { data: upload, error: dbError } = await adminClient
    .from("uploads")
    .insert({
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      status: "uploaded",
    })
    .select()
    .single<UploadRecord>();

  if (dbError || !upload) {
    // Nettoyage du fichier orphelin dans Storage
    await adminClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
    console.error("[upload] Erreur DB :", dbError?.message);
    return { success: false, code: "upload_error" };
  }

  // 7. Invalide le cache dashboard
  revalidatePath("/dashboard");

  // 8. Incrémenter le compteur de factures du mois (fire-and-forget, pas bloquant)
  incrementUsage(user.id).catch((err: unknown) => {
    console.error("[upload] Échec de l'incrémentation du quota :", err);
  });

  // 9. Déclencher l'OCR de façon asynchrone (fire-and-forget)
  triggerOcrAsync(upload.id);

  return { success: true, upload };
}

// --------------------------------------------------------------------------
// Lecture de l'historique des uploads d'un utilisateur
// --------------------------------------------------------------------------

export async function getUserUploads(): Promise<UploadRecord[]> {
  const sessionClient = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return [];

  const adminClient = createSupabaseServerClient();
  const { data } = await adminClient
    .from("uploads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<UploadRecord[]>();

  return data ?? [];
}
