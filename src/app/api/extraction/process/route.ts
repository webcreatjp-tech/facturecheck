// Route interne – extraction structurée des champs d'une facture depuis le texte OCR
// Appelée en fire-and-forget depuis /api/ocr/process ou retryExtraction()
// Protégée par le même secret partagé que le pipeline OCR (INTERNAL_OCR_SECRET)

import { createSupabaseServerClient } from "@/lib/supabase";
import { getExtractionProvider } from "@/lib/extraction";
import { triggerComplianceAsync } from "@/app/actions/compliance";
import type { UploadRecord } from "@/app/actions/upload";

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

type ExtractionFields = Pick<
  UploadRecord,
  | "extraction_status"
  | "extraction_error"
  | "extraction_processed_at"
  | "extraction_version"
  | "extracted_fields"
>;

async function setExtractionStatus(
  uploadId: string,
  fields: Partial<ExtractionFields>
) {
  const admin = createSupabaseServerClient();
  const { error } = await admin
    .from("uploads")
    .update(fields)
    .eq("id", uploadId);

  if (error) {
    console.error(
      "[extraction/process] Erreur mise à jour statut :",
      error.message
    );
  }
}

// --------------------------------------------------------------------------
// Handler POST
// --------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Valider le secret interne (même secret que le pipeline OCR)
  const secret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_OCR_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return unauthorized();
  }

  // 2. Extraire uploadId
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

  // 3. Récupérer le record (vérif existence + statut OCR)
  const admin = createSupabaseServerClient();
  const { data: upload, error: fetchError } = await admin
    .from("uploads")
    .select("id, ocr_status, ocr_text, extraction_status")
    .eq("id", uploadId)
    .single<
      Pick<
        UploadRecord,
        "id" | "ocr_status" | "ocr_text" | "extraction_status"
      >
    >();

  if (fetchError || !upload) {
    console.error("[extraction/process] Upload introuvable :", uploadId);
    return Response.json({ error: "Upload introuvable" }, { status: 404 });
  }

  // 4. L'OCR doit être terminé avant d'extraire
  if (upload.ocr_status !== "processed") {
    return Response.json(
      { message: `OCR non terminé (statut : ${upload.ocr_status})` },
      { status: 200 }
    );
  }

  // 5. Idempotence
  if (
    upload.extraction_status === "processing" ||
    upload.extraction_status === "extracted"
  ) {
    return Response.json(
      { message: `Extraction déjà : ${upload.extraction_status}` },
      { status: 200 }
    );
  }

  // 6. Marquer comme en cours
  await setExtractionStatus(uploadId, { extraction_status: "processing" });

  // 7. Extraire les champs structurés
  const provider = getExtractionProvider();

  try {
    const result = await provider.extractFields(upload.ocr_text ?? "");

    await setExtractionStatus(uploadId, {
      extraction_status:      "extracted",
      extracted_fields:       result.fields as unknown as Record<string, unknown>,
      extraction_version:     result.version,
      extraction_processed_at: result.processedAt,
      extraction_error:       null,
    });

    console.info(
      `[extraction/process] Upload ${uploadId} extrait par "${result.provider}" v${result.version}`
    );

    // Déclencher la vérification de conformité de façon asynchrone (fire-and-forget)
    triggerComplianceAsync(uploadId);

    return Response.json({ success: true, uploadId });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Erreur extraction inconnue";
    console.error("[extraction/process] Erreur :", errMsg);

    await setExtractionStatus(uploadId, {
      extraction_status:      "failed",
      extraction_error:       errMsg,
      extraction_processed_at: new Date().toISOString(),
    });

    return Response.json({ error: errMsg }, { status: 500 });
  }
}
