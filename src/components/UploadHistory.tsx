import Link from "next/link";
import { FileText, Eye, RotateCcw } from "lucide-react";
import type { UploadRecord } from "@/app/actions/upload";
import RetryOcrButton from "@/components/RetryOcrButton";
import ComplianceBadge from "@/components/ComplianceBadge";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------------------------------------------------------
// Statut OCR
// --------------------------------------------------------------------------

type OcrStatus = NonNullable<UploadRecord["ocr_status"]>;

const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  pending: "En attente",
  processing: "Analyse…",
  processed: "Analysé",
  failed: "Échec OCR",
};

const OCR_STATUS_CLASSES: Record<OcrStatus, string> = {
  pending: "bg-gray-50 text-gray-500 border border-gray-200",
  processing: "bg-amber-50 text-amber-700 border border-amber-100",
  processed: "bg-green-50 text-green-700 border border-green-100",
  failed: "bg-red-50 text-red-700 border border-red-100",
};

// --------------------------------------------------------------------------
// Composant
// --------------------------------------------------------------------------

interface UploadHistoryProps {
  uploads: UploadRecord[];
}

export default function UploadHistory({ uploads }: UploadHistoryProps) {
  return (
    <section aria-label="Historique des factures téléversées">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Mes factures
      </h2>

      {uploads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <FileText className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="text-gray-500 text-sm">
            Aucune facture téléversée pour l&apos;instant.
          </p>
          <p className="text-gray-400 text-xs">
            Utilisez la zone ci-dessus pour commencer.
          </p>
        </div>
      ) : (
        <ul
          role="list"
          aria-label="Liste des factures téléversées"
          className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white overflow-hidden"
        >
          {uploads.map((upload) => {
            const ocrStatus = upload.ocr_status ?? "pending";
            return (
              <li
                key={upload.id}
                className="flex items-start sm:items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors flex-wrap sm:flex-nowrap"
              >
                {/* Icône */}
                <div className="shrink-0 rounded-xl bg-blue-50 p-2.5 mt-0.5 sm:mt-0">
                  <FileText className="h-5 w-5 text-blue-500" aria-hidden />
                </div>

                {/* Infos fichier */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-gray-900 truncate text-sm"
                    title={upload.file_name}
                  >
                    {upload.file_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatBytes(upload.file_size)} &middot;{" "}
                    <time dateTime={upload.created_at}>
                      {formatDate(upload.created_at)}
                    </time>
                  </p>
                  {/* Message d'erreur OCR */}
                  {ocrStatus === "failed" && upload.ocr_error && (
                    <p
                      className="text-xs text-red-500 mt-1"
                      role="alert"
                      aria-label="Erreur OCR"
                    >
                      {upload.ocr_error}
                    </p>
                  )}
                </div>

                {/* Badge conformité (prioritaire sur badge OCR si disponible) */}
                <ComplianceBadge upload={upload} />

                {/* Badge statut OCR (si pas encore de score conformité) */}
                {!upload.compliance_status && (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${OCR_STATUS_CLASSES[ocrStatus]}`}
                    aria-label={`Statut OCR : ${OCR_STATUS_LABELS[ocrStatus]}`}
                  >
                    {OCR_STATUS_LABELS[ocrStatus]}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {ocrStatus === "processed" && (
                    <Link
                      href={`/dashboard/uploads/${upload.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      aria-label={`Voir le détail de ${upload.file_name}`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      {upload.compliance_status === "checked"
                        ? "Voir le rapport"
                        : "Voir le texte"}
                    </Link>
                  )}
                  {ocrStatus === "failed" && (
                    <RetryOcrButton uploadId={upload.id} />
                  )}
                  {ocrStatus === "processing" && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                      <RotateCcw
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                      />
                      Traitement…
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
