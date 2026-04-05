// --------------------------------------------------------------------------
// Schéma structuré des champs d'une facture française (T005)
// --------------------------------------------------------------------------

/**
 * Champs structurés extraits du texte OCR d'une facture.
 * Toute valeur non trouvée est explicitement null (jamais inventée).
 */
export interface StructuredInvoiceFields {
  // ── Métadonnées de la facture ──────────────────────────────────────────
  invoice_number:          string | null;  // Numéro de facture
  issue_date:              string | null;  // Date d'émission (YYYY-MM-DD)
  due_date:                string | null;  // Date d'échéance (YYYY-MM-DD)
  currency:                string | null;  // Devise (EUR, USD…)
  invoice_type:            string | null;  // FACTURE, AVOIR, PROFORMA…

  // ── Émetteur ──────────────────────────────────────────────────────────
  seller_name:             string | null;
  seller_address:          string | null;
  seller_siren:            string | null;  // 9 chiffres
  seller_siret:            string | null;  // 14 chiffres
  seller_vat_number:       string | null;  // ex. FR12345678901

  // ── Destinataire ──────────────────────────────────────────────────────
  buyer_name:              string | null;
  buyer_address:           string | null;
  buyer_siren:             string | null;
  buyer_siret:             string | null;
  buyer_vat_number:        string | null;

  // ── Montants ──────────────────────────────────────────────────────────
  subtotal_excl_tax:       number | null;  // Sous-total HT
  total_tax:               number | null;  // Total TVA
  total_incl_tax:          number | null;  // Total TTC
  amount_due:              number | null;  // Net à payer

  // ── TVA ───────────────────────────────────────────────────────────────
  vat_rates_detected:      string[] | null; // ex. ["20%", "10%"]
  tax_breakdown_raw:       string | null;   // Ligne(s) de ventilation TVA brute

  // ── Détails commerciaux ───────────────────────────────────────────────
  line_items_raw:          string | null;   // Lignes de détail brutes
  payment_terms:           string | null;   // Conditions de paiement
  purchase_order_number:   string | null;   // N° de bon de commande
  service_or_delivery_date: string | null;  // Date de prestation / livraison (YYYY-MM-DD)
}

/**
 * Résultat complet retourné par un ExtractionProvider.
 */
export interface ExtractionResult {
  fields:    StructuredInvoiceFields;
  provider:  string;
  version:   string;
  processedAt: string; // ISO 8601
}

/**
 * Interface contractuelle que tous les fournisseurs d'extraction doivent implémenter.
 */
export interface ExtractionProvider {
  readonly name: string;
  readonly version: string;
  extractFields(ocrText: string): Promise<ExtractionResult>;
}
