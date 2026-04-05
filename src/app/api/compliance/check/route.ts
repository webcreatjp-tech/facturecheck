// Route interne – contrôle de conformité d'une facture depuis les champs extraits
// Déclenchée en fire-and-forget depuis /api/extraction/process ou retryCompliance()
// Protégée par le même secret partagé que les autres routes internes (INTERNAL_OCR_SECRET)

import { createSupabaseServerClient } from "@/lib/supabase";
import { checkCompliance } from "@/lib/compliance";
import type { UploadRecord } from "@/app/actions/upload";
import type { StructuredInvoiceFields } from "@/lib/extraction/types";

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

type ComplianceStatusFields = Pick<
  UploadRecord,
  "compliance_status" | "compliance_score" | "compliance_band"
>;

async function setComplianceStatus(
  uploadId: string,
  fields: Partial<ComplianceStatusFields>
) {
  const admin = createSupabaseServerClient();
  const { error } = await admin
    .from("uploads")
    .update(fields)
    .eq("id", uploadId);

  if (error) {
    console.error(
      "[compliance/check] Erreur mise à jour statut :",
      error.message
    );
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

  // 3. Récupérer le record (existence + prérequis)
  const admin = createSupabaseServerClient();
  const { data: upload, error: fetchError } = await admin
    .from("uploads")
    .select(
      "id, user_id, extraction_status, extracted_fields, compliance_status"
    )
    .eq("id", uploadId)
    .single<
      Pick<
        UploadRecord,
        | "id"
        | "user_id"
        | "extraction_status"
        | "extracted_fields"
        | "compliance_status"
      >
    >();

  if (fetchError || !upload) {
    console.error("[compliance/check] Upload introuvable :", uploadId);
    return Response.json({ error: "Upload introuvable" }, { status: 404 });
  }

  // 4. L'extraction doit être terminée
  if (upload.extraction_status !== "extracted") {
    return Response.json(
      { message: `Extraction non terminée (statut : ${upload.extraction_status})` },
      { status: 200 }
    );
  }

  // 5. Idempotence
  if (
    upload.compliance_status === "processing" ||
    upload.compliance_status === "checked"
  ) {
    return Response.json(
      { message: `Conformité déjà : ${upload.compliance_status}` },
      { status: 200 }
    );
  }

  // 6. Marquer comme en cours
  await setComplianceStatus(uploadId, { compliance_status: "processing" });

  // 7. Exécuter le moteur de conformité (pur, sans effets de bord)
  try {
    const fields = upload.extracted_fields as unknown as StructuredInvoiceFields | null;
    const report = checkCompliance(fields);

    // 8. Upsert dans compliance_results (un seul résultat par upload)
    const { error: upsertError } = await admin
      .from("compliance_results")
      .upsert(
        {
          upload_id:       uploadId,
          user_id:         upload.user_id,
          score:           report.score,
          band:            report.band,
          blocking_errors: report.blocking_errors,
          warnings:        report.warnings,
          suggestions:     report.suggestions,
          rules_version:   report.rules_version,
          checked_at:      report.checked_at,
        },
        { onConflict: "upload_id" }
      );

    if (upsertError) {
      throw new Error(`Erreur upsert compliance_results : ${upsertError.message}`);
    }

    // 9. Mettre à jour les colonnes de synthèse sur uploads (pour le badge dashboard)
    await setComplianceStatus(uploadId, {
      compliance_status: "checked",
      compliance_score:  report.score,
      compliance_band:   report.band,
    });

    console.info(
      `[compliance/check] Upload ${uploadId} — score ${report.score} (${report.band}), ` +
        `${report.blocking_errors.length} erreurs, ${report.warnings.length} avertissements`
    );

    return Response.json({
      success:  true,
      uploadId,
      score:    report.score,
      band:     report.band,
    });
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Erreur conformité inconnue";
    console.error("[compliance/check] Erreur :", errMsg);

    await setComplianceStatus(uploadId, { compliance_status: "failed" });

    return Response.json({ error: errMsg }, { status: 500 });
  }
}
