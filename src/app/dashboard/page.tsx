import { getUserUploads } from "@/app/actions/upload";
import UploadZone from "@/components/UploadZone";
import UploadHistory from "@/components/UploadHistory";

export default async function DashboardPage() {
  const uploads = await getUserUploads();

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
        <UploadZone />
      </section>

      {/* ── Historique ── */}
      <UploadHistory uploads={uploads} />
    </div>
  );
}
