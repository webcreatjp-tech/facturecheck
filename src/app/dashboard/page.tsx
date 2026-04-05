import { getUserUploads } from "@/app/actions/upload";
import { getUserProfile } from "@/app/actions/billing";
import UploadZone from "@/components/UploadZone";
import UploadHistory from "@/components/UploadHistory";
import StatusPoller from "@/components/StatusPoller";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [{ uploads, totalPages }, profile] = await Promise.all([
    getUserUploads(page),
    getUserProfile(),
  ]);

  const used = profile?.invoices_used_this_month ?? 0;
  const limit = profile?.invoices_limit ?? 3;
  const quotaReached = limit !== null && used >= limit;
  const quotaNearLimit = !quotaReached && limit !== null && used >= limit - 1;

  return (
    <div className="space-y-10">
      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mes factures</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Téléversez une facture PDF pour vérifier sa conformité aux
          obligations légales 2026–2027.
        </p>
      </div>

      {/* ── Nudge quota ── */}
      {quotaReached && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Vous avez atteint votre limite de{" "}
            <strong>{limit} factures</strong> ce mois-ci.{" "}
            <Link
              href="/dashboard/billing"
              className="underline underline-offset-2 font-medium hover:text-red-900"
            >
              Passez à un plan supérieur
            </Link>{" "}
            pour continuer.
          </span>
        </div>
      )}
      {quotaNearLimit && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Il vous reste <strong>1 facture</strong> sur {limit} ce mois-ci.{" "}
            <Link
              href="/dashboard/billing"
              className="underline underline-offset-2 font-medium hover:text-amber-900"
            >
              Voir les plans
            </Link>
          </span>
        </div>
      )}

      {/* ── Upload ── */}
      <section
        aria-labelledby="upload-heading"
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2
          id="upload-heading"
          className="text-base font-semibold text-gray-900 mb-6"
        >
          Téléverser une facture
        </h2>
        <UploadZone quotaReached={quotaReached} />
      </section>

      {/* ── Historique ── */}
      <UploadHistory uploads={uploads} page={page} totalPages={totalPages} />

      {/* ── Polling auto si des uploads sont en cours ── */}
      <StatusPoller
        active={uploads.some(
          (u) =>
            u.ocr_status === "pending" ||
            u.ocr_status === "processing" ||
            u.extraction_status === "pending" ||
            u.extraction_status === "processing" ||
            u.compliance_status === "pending" ||
            u.compliance_status === "processing"
        )}
      />
    </div>
  );
}
