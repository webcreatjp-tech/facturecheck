import { FileText } from "lucide-react";
import type { UploadRecord } from "@/app/actions/upload";

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

const STATUS_LABELS: Record<UploadRecord["status"], string> = {
  uploaded: "Téléversé",
  processing: "Analyse en cours",
  done: "Analysé",
  error: "Erreur",
};

const STATUS_CLASSES: Record<UploadRecord["status"], string> = {
  uploaded:
    "bg-blue-50 text-blue-700 border border-blue-100",
  processing:
    "bg-amber-50 text-amber-700 border border-amber-100",
  done: "bg-green-50 text-green-700 border border-green-100",
  error: "bg-red-50 text-red-700 border border-red-100",
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
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Icône */}
              <div className="shrink-0 rounded-xl bg-blue-50 p-2.5">
                <FileText
                  className="h-5 w-5 text-blue-500"
                  aria-hidden
                />
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
              </div>

              {/* Badge statut */}
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  STATUS_CLASSES[upload.status]
                }`}
                aria-label={`Statut : ${STATUS_LABELS[upload.status]}`}
              >
                {STATUS_LABELS[upload.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
