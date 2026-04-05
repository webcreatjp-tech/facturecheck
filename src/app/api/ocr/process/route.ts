// Route interne – traitement OCR asynchrone d'une facture
// Appelée en fire-and-forget depuis uploadInvoice() ou retryOcr()
// Protégée par un secret partagé (INTERNAL_OCR_SECRET)

import { createSupabaseServerClient } from "@/lib/supabase";
import { getOcrProvider } from "@/lib/ocr";
import { triggerExtractionAsync } from "@/app/actions/extraction";
import type { UploadRecord } from "@/app/actions/upload";

// Next.js Node.js runtime (pdf-parse utilise des APIs Node)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

async function setOcrStatus(
  uploadId: string,
  fields: Partial<
    Pick<
      UploadRecord,
      "ocr_status" | "ocr_text" | "ocr_error" | "ocr_processed_at" | "ocr_provider"
    >
  >
) {
  const admin = createSupabaseServerClient();
  const { error } = await admin
    .from("uploads")
    .update(fields)
    .eq("id", uploadId);

  if (error) {
    console.error("[ocr/process] Erreur mise à jour statut :", error.message);
  }
}

// --------------------------------------------------------------------------
// Handler POST
// --------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Valider le secret interne
  const secret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_OCR_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return unauthorized();
  }

  // 2. Extraire l'uploadId du body
  let uploadId: string;
  try {
    const body = await request.json();
    uploadId = body?.uploadId;
  } catch {
    return badRequest("Corps JSON invalide");
  }

  if (!uploadId || typeof uploadId !== "string") {
    return badRequest("uploadId manquant ou invalide");
  }

  // 3. Récupérer le record d'upload (vérif existence)
  const admin = createSupabaseServerClient();
  const { data: upload, error: fetchError } = await admin
    .from("uploads")
    .select("id, storage_path, ocr_status")
    .eq("id", uploadId)
    .single<Pick<UploadRecord, "id" | "storage_path" | "ocr_status">>();

  if (fetchError || !upload) {
    console.error("[ocr/process] Upload introuvable :", uploadId);
    return Response.json({ error: "Upload introuvable" }, { status: 404 });
  }

  // 4. Éviter les doubles traitements (sauf retry explicite)
  if (upload.ocr_status === "processing" || upload.ocr_status === "processed") {
    return Response.json(
      { message: `Statut déjà : ${upload.ocr_status}` },
      { status: 200 }
    );
  }

  // 5. Marquer comme "en cours"
  await setOcrStatus(uploadId, { ocr_status: "processing" });

  // 6. Télécharger le PDF depuis Supabase Storage
  const { data: fileBlob, error: downloadError } = await admin.storage
    .from("invoices")
    .download(upload.storage_path);

  if (downloadError || !fileBlob) {
    const errMsg = downloadError?.message ?? "Téléchargement impossible";
    console.error("[ocr/process] Erreur téléchargement :", errMsg);
    await setOcrStatus(uploadId, {
      ocr_status: "failed",
      ocr_error: `Téléchargement du fichier impossible : ${errMsg}`,
      ocr_processed_at: new Date().toISOString(),
    });
    return Response.json({ error: errMsg }, { status: 500 });
  }

  // 7. Convertir en Buffer et lancer l'OCR
  const pdfBuffer = Buffer.from(await fileBlob.arrayBuffer());
  const provider = getOcrProvider();

  try {
    const result = await provider.extractText(pdfBuffer);

    await setOcrStatus(uploadId, {
      ocr_status: "processed",
      ocr_text: result.text,
      ocr_provider: result.provider,
      ocr_processed_at: result.processedAt,
      ocr_error: null,
    });

    console.info(
      `[ocr/process] Upload ${uploadId} traité par "${result.provider}" — ${result.text.length} caractères`
    );

    // Déclencher l'extraction structurée de façon asynchrone (fire-and-forget)
    triggerExtractionAsync(uploadId);

    return Response.json({ success: true, uploadId });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Erreur OCR inconnue";
    console.error("[ocr/process] Erreur OCR :", errMsg);

    await setOcrStatus(uploadId, {
      ocr_status: "failed",
      ocr_error: errMsg,
      ocr_processed_at: new Date().toISOString(),
    });

    return Response.json({ error: errMsg }, { status: 500 });
  }
}
