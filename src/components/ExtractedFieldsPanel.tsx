import type { StructuredInvoiceFields } from "@/lib/extraction/types";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | string[] | null | undefined;
}) {
  const isEmpty = value === null || value === undefined || value === "";

  let displayValue: string;
  if (isEmpty) {
    displayValue = "Non détecté";
  } else if (Array.isArray(value)) {
    displayValue = value.join(", ");
  } else {
    displayValue = String(value);
  }

  return (
    <div className="py-2 flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={`text-sm ${
          isEmpty ? "text-gray-300 italic" : "text-gray-800"
        }`}
      >
        {displayValue}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">
        {title}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</dl>
    </div>
  );
}

// --------------------------------------------------------------------------
// Composant principal
// --------------------------------------------------------------------------

interface ExtractedFieldsPanelProps {
  fields: StructuredInvoiceFields;
  extractionVersion?: string | null;
}

export default function ExtractedFieldsPanel({
  fields,
  extractionVersion,
}: ExtractedFieldsPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">
          Champs extraits
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            À vérifier par l&apos;utilisateur
          </span>
          {extractionVersion && (
            <span className="text-xs text-gray-400">v{extractionVersion}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Métadonnées */}
        <Section title="Facture">
          <Field label="Numéro" value={fields.invoice_number} />
          <Field label="Type" value={fields.invoice_type} />
          <Field label="Date d'émission" value={fields.issue_date} />
          <Field label="Date d'échéance" value={fields.due_date} />
          <Field label="Devise" value={fields.currency} />
          <Field label="Bon de commande" value={fields.purchase_order_number} />
          <Field label="Date de prestation" value={fields.service_or_delivery_date} />
        </Section>

        {/* Émetteur */}
        <Section title="Émetteur">
          <Field label="Raison sociale" value={fields.seller_name} />
          <Field label="SIRET" value={fields.seller_siret} />
          <Field label="SIREN" value={fields.seller_siren} />
          <Field label="N° TVA" value={fields.seller_vat_number} />
          <Field label="Adresse" value={fields.seller_address} />
        </Section>

        {/* Destinataire */}
        <Section title="Destinataire">
          <Field label="Raison sociale" value={fields.buyer_name} />
          <Field label="SIRET" value={fields.buyer_siret} />
          <Field label="SIREN" value={fields.buyer_siren} />
          <Field label="N° TVA" value={fields.buyer_vat_number} />
          <Field label="Adresse" value={fields.buyer_address} />
        </Section>

        {/* Montants */}
        <Section title="Montants">
          <Field
            label="Total HT"
            value={
              fields.subtotal_excl_tax !== null
                ? `${fields.subtotal_excl_tax.toFixed(2)} €`
                : null
            }
          />
          <Field
            label="Total TVA"
            value={
              fields.total_tax !== null
                ? `${fields.total_tax.toFixed(2)} €`
                : null
            }
          />
          <Field
            label="Total TTC"
            value={
              fields.total_incl_tax !== null
                ? `${fields.total_incl_tax.toFixed(2)} €`
                : null
            }
          />
          <Field
            label="Net à payer"
            value={
              fields.amount_due !== null
                ? `${fields.amount_due.toFixed(2)} €`
                : null
            }
          />
        </Section>

        {/* TVA */}
        <Section title="TVA">
          <Field label="Taux détectés" value={fields.vat_rates_detected} />
          {fields.tax_breakdown_raw && (
            <div className="sm:col-span-2 py-2">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                Ventilation brute
              </dt>
              <dd>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono">
                  {fields.tax_breakdown_raw}
                </pre>
              </dd>
            </div>
          )}
        </Section>

        {/* Conditions de paiement */}
        {fields.payment_terms && (
          <Section title="Paiement">
            <Field label="Conditions" value={fields.payment_terms} />
          </Section>
        )}

        {/* Lignes de détail */}
        {fields.line_items_raw && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 pb-1 border-b border-gray-100">
              Lignes de détail
            </h3>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-auto">
              {fields.line_items_raw}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
