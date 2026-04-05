import Link from "next/link";
import type { UploadRecord } from "@/app/actions/upload";

type Band = NonNullable<UploadRecord["compliance_band"]>;

const BAND_STYLES: Record<Band, string> = {
  conforme:
    "bg-green-50 text-green-700 border border-green-200",
  attention:
    "bg-yellow-50 text-yellow-700 border border-yellow-200",
  non_conforme_corrections:
    "bg-orange-50 text-orange-700 border border-orange-200",
  non_conforme_invalide:
    "bg-red-50 text-red-700 border border-red-200",
};

const BAND_LABELS: Record<Band, string> = {
  conforme:                  "Conforme",
  attention:                 "Attention",
  non_conforme_corrections:  "À corriger",
  non_conforme_invalide:     "Non conforme",
};

interface ComplianceBadgeProps {
  upload: UploadRecord;
}

export default function ComplianceBadge({ upload }: ComplianceBadgeProps) {
  const { compliance_status, compliance_score, compliance_band, id } = upload;

  if (!compliance_status || compliance_status === "pending") return null;

  if (compliance_status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
        Vérification…
      </span>
    );
  }

  if (compliance_status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
        Erreur vérif.
      </span>
    );
  }

  if (
    compliance_status === "checked" &&
    compliance_score !== null &&
    compliance_score !== undefined &&
    compliance_band
  ) {
    return (
      <Link
        href={`/dashboard/uploads/${id}#conformite`}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 ${BAND_STYLES[compliance_band]}`}
        aria-label={`Score de conformité : ${compliance_score}/100 — ${BAND_LABELS[compliance_band]}`}
      >
        <span className="tabular-nums">{compliance_score}</span>
        <span className="hidden sm:inline">{BAND_LABELS[compliance_band]}</span>
      </Link>
    );
  }

  return null;
}
