import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, AlertCircle, Clock } from "lucide-react";
import { getUploadWithOcr } from "@/app/actions/ocr";
import RetryOcrButton from "@/components/RetryOcrButton";

// --------------------------------------------------------------------------
// Métadonnées dynamiques
// --------------------------------------------------------------------------

export const metadata = {
  title: "Texte extrait – FactureCheck",
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UploadDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Récupère le document (contrôle d'accès : owner uniquement)
  const upload = await getUploadWithOcr(id);

  if (!upload) {
    // Accès refusé ou document inexistant → retour dashboard
    redirect("/dashboard");
  }

  const ocrStatus = upload.ocr_status ?? "pending";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Retour ── */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au tableau de bord
      </Link>

      {/* ── En-tête document ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl bg-blue-50 p-3">
            <FileText className="h-6 w-6 text-blue-500" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-bold text-gray-900 truncate"
              title={upload.file_name}
            >
              {upload.file_name}
            </h1>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500">
              <div>
                <dt className="font-medium text-gray-400">Téléversé le</dt>
                <dd>{formatDate(upload.created_at)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-400">Fournisseur OCR</dt>
                <dd>{upload.ocr_provider ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-400">Traité le</dt>
                <dd>{formatDate(upload.ocr_processed_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ── Contenu selon le statut ── */}

      {ocrStatus === "pending" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-14 text-center">
          <Clock className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="font-medium text-gray-600">
            Analyse en attente de démarrage
          </p>
          <p className="text-sm text-gray-400">
            Le traitement OCR n&apos;a pas encore commencé.
          </p>
          <RetryOcrButton uploadId={upload.id} />
        </div>
      )}

      {ocrStatus === "processing" && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 rounded-2xl border border-amber-100 bg-amber-50 py-14 text-center"
        >
          <div className="h-10 w-10 rounded-full border-4 border-amber-300 border-t-amber-600 animate-spin" />
          <p className="font-medium text-amber-700">
            Extraction du texte en cours…
          </p>
          <p className="text-sm text-amber-600">
            Actualisez la page dans quelques instants.
          </p>
        </div>
      )}

      {ocrStatus === "failed" && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-red-700">
                L&apos;extraction du texte a échoué
              </p>
              {upload.ocr_error && (
                <p
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                  aria-label="Détail de l'erreur OCR"
                >
                  {upload.ocr_error}
                </p>
              )}
              <div className="mt-4">
                <RetryOcrButton uploadId={upload.id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {ocrStatus === "processed" && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Texte extrait
            </h2>
            <span className="text-xs text-gray-400">
              {upload.ocr_text?.length ?? 0} caractères
            </span>
          </div>

          {upload.ocr_text ? (
            <pre
              className="px-5 py-4 text-sm text-gray-800 font-mono whitespace-pre-wrap break-words overflow-auto max-h-[60vh] leading-relaxed"
              aria-label="Texte extrait de la facture par OCR"
            >
              {upload.ocr_text}
            </pre>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Aucun texte extrait — le fichier est peut-être un PDF scanné sans
              couche texte.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
