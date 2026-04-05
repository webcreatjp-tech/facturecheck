import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { ComplianceResultRecord, ScoreBand, RuleResult } from "@/lib/compliance/types";
import RetryComplianceButton from "./RetryComplianceButton";
import PrintButton from "./PrintButton";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const BAND_STYLES: Record<ScoreBand, { bg: string; text: string; border: string; label: string }> = {
  conforme: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    label: "Conforme",
  },
  attention: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    label: "Attention requise",
  },
  non_conforme_corrections: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    label: "Non conforme — corrections nécessaires",
  },
  non_conforme_invalide: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "Non conforme — facture invalide",
  },
};

const SCORE_RING: Record<ScoreBand, string> = {
  conforme:                  "text-green-600",
  attention:                 "text-yellow-600",
  non_conforme_corrections:  "text-orange-600",
  non_conforme_invalide:     "text-red-600",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RuleItem({
  result,
  colorClass,
}: {
  result: RuleResult;
  colorClass: string;
}) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className={`shrink-0 mt-0.5 text-xs font-mono bg-gray-100 text-gray-500 rounded px-1.5 py-0.5`}>
        {result.field_name}
      </span>
      <span className={`text-sm ${colorClass}`}>{result.message}</span>
    </li>
  );
}

// --------------------------------------------------------------------------
// Composant principal
// --------------------------------------------------------------------------

interface ComplianceReportProps {
  result: ComplianceResultRecord;
  uploadId: string;
}

export default function ComplianceReport({
  result,
  uploadId,
}: ComplianceReportProps) {
  const band = BAND_STYLES[result.band];
  const ringColor = SCORE_RING[result.band];

  const totalErrors  = result.blocking_errors.length;
  const totalWarnings = result.warnings.length;
  const totalSuggestions = result.suggestions.length;

  // Ligne de résumé
  const summaryParts: string[] = [];
  if (totalErrors > 0)
    summaryParts.push(
      `${totalErrors} erreur${totalErrors > 1 ? "s" : ""} bloquante${totalErrors > 1 ? "s" : ""}`
    );
  if (totalWarnings > 0)
    summaryParts.push(
      `${totalWarnings} avertissement${totalWarnings > 1 ? "s" : ""}`
    );
  if (totalSuggestions > 0)
    summaryParts.push(
      `${totalSuggestions} suggestion${totalSuggestions > 1 ? "s" : ""}`
    );

  const summary =
    summaryParts.length > 0
      ? `Votre facture contient ${summaryParts.join(" et ")}.`
      : "Votre facture respecte toutes les exigences vérifiées.";

  return (
    <div
      id="conformite"
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">
          Rapport de conformité
        </h2>
        <span className="text-xs text-gray-400">
          v{result.rules_version} · {formatDate(result.checked_at)}
        </span>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* ── Score + bande ── */}
        <div className="flex items-center gap-6">
          {/* Score visuel */}
          <div
            className={`shrink-0 flex items-center justify-center w-20 h-20 rounded-full border-4 ${band.border} ${band.bg}`}
            aria-label={`Score de conformité : ${result.score} sur 100`}
          >
            <span className={`text-2xl font-bold tabular-nums ${ringColor}`}>
              {result.score}
            </span>
          </div>

          {/* Bande + résumé */}
          <div className="flex-1">
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold mb-2 ${band.bg} ${band.text} border ${band.border}`}
            >
              {band.label}
            </span>
            <p className="text-sm text-gray-600">{summary}</p>
          </div>
        </div>

        {/* ── Avertissement "données à vérifier" ── */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            Ce rapport est basé sur les champs extraits automatiquement.
            Vérifiez les données extraites avant de vous fier à ce score.
          </span>
        </div>

        {/* ── Erreurs bloquantes ── */}
        {totalErrors > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
              <AlertCircle className="h-4 w-4" aria-hidden />
              Erreurs bloquantes ({totalErrors})
            </h3>
            <ul className="space-y-0.5 pl-1">
              {result.blocking_errors.map((r) => (
                <RuleItem key={r.rule_id} result={r} colorClass="text-red-700" />
              ))}
            </ul>
          </div>
        )}

        {/* ── Avertissements ── */}
        {totalWarnings > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Avertissements ({totalWarnings})
            </h3>
            <ul className="space-y-0.5 pl-1">
              {result.warnings.map((r) => (
                <RuleItem key={r.rule_id} result={r} colorClass="text-amber-700" />
              ))}
            </ul>
          </div>
        )}

        {/* ── Suggestions ── */}
        {totalSuggestions > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
              <Info className="h-4 w-4" aria-hidden />
              Bonnes pratiques ({totalSuggestions})
            </h3>
            <ul className="space-y-0.5 pl-1">
              {result.suggestions.map((r) => (
                <RuleItem key={r.rule_id} result={r} colorClass="text-blue-700" />
              ))}
            </ul>
          </div>
        )}

        {/* ── Tout est OK ── */}
        {totalErrors === 0 && totalWarnings === 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Aucune erreur ni avertissement détecté — félicitations !
          </div>
        )}

        {/* ── Actions ── */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            Relancez la vérification après correction des données extraites.
          </p>
          <div className="flex gap-2">
            <PrintButton />
            <RetryComplianceButton uploadId={uploadId} />
          </div>
        </div>
      </div>
    </div>
  );
}
