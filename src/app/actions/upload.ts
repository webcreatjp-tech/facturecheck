"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase";

// --------------------------------------------------------------------------
// Constantes
// --------------------------------------------------------------------------

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
export const UPLOAD_ALLOWED_MIME = "application/pdf";
export const STORAGE_BUCKET = "invoices";

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
}

export type UploadErrorCode =
  | "unauthenticated"
  | "invalid_type"
  | "too_large"
  | "upload_error";

export type UploadResult =
  | { success: true; upload: UploadRecord }
  | { success: false; code: UploadErrorCode };

// --------------------------------------------------------------------------
// Helpers (exportés pour les tests)
// --------------------------------------------------------------------------

/**
 * Génère un slug URL-safe à partir du nom de fichier.
 * Retire l'extension .pdf, remplace les caractères spéciaux par des tirets.
 */
export function slugify(name: string): string {
  const withoutExt = name.replace(/\.pdf$/i, "");
  const slug = withoutExt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "facture";
}

/**
 * Construit le chemin de stockage unique par utilisateur.
 * Format : {userId}/{timestamp}-{slug}.pdf
 */
export function buildStoragePath(userId: string, fileName: string): string {
  return `${userId}/${Date.now()}-${slugify(fileName)}.pdf`;
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

  // 2. Récupération et validation serveur du fichier
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

  // 3. Génération d'un chemin de stockage sûr et unique
  const storagePath = buildStoragePath(user.id, file.name);

  // 4. Téléversement vers Supabase Storage (via service role)
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

  // 5. Insertion des métadonnées en base
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

  // 6. Invalide le cache de la page dashboard pour rafraîchir l'historique
  revalidatePath("/dashboard");

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
