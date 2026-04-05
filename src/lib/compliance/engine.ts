import type { ComplianceReport, RuleResult, ScoreBand } from "./types";
import type { StructuredInvoiceFields } from "@/lib/extraction/types";
import { ALL_RULES } from "./rules";
import { RULES_VERSION } from "./index";

// --------------------------------------------------------------------------
// Bandes de score
// --------------------------------------------------------------------------

export function getScoreBand(score: number): ScoreBand {
  if (score >= 90) return "conforme";
  if (score >= 70) return "attention";
  if (score >= 50) return "non_conforme_corrections";
  return "non_conforme_invalide";
}

// --------------------------------------------------------------------------
// Moteur principal – pur et déterministe
// --------------------------------------------------------------------------

/**
 * Évalue la conformité d'une facture à partir de ses champs structurés.
 *
 * Propriétés garanties :
 *   - Déterministe : même entrée → même sortie
 *   - Sans effets de bord : aucun appel réseau, aucune écriture
 *   - Isolé : ne modifie pas l'objet fields passé en paramètre
 *
 * Calcul du score :
 *   - Départ à 100
 *   - Chaque règle non respectée applique son score_impact (≤ 0)
 *   - Score plancher à 0, plafond à 100
 */
export function checkCompliance(
  fields: StructuredInvoiceFields | null | undefined
): ComplianceReport {
  // Si les champs sont absents (extraction non terminée), toutes les règles échouent
  const safeFields: StructuredInvoiceFields = fields ?? {
    invoice_number: null,
    issue_date: null,
    due_date: null,
    currency: null,
    invoice_type: null,
    seller_name: null,
    seller_address: null,
    seller_siren: null,
    seller_siret: null,
    seller_vat_number: null,
    buyer_name: null,
    buyer_address: null,
    buyer_siren: null,
    buyer_siret: null,
    buyer_vat_number: null,
    subtotal_excl_tax: null,
    total_tax: null,
    total_incl_tax: null,
    amount_due: null,
    vat_rates_detected: null,
    tax_breakdown_raw: null,
    line_items_raw: null,
    payment_terms: null,
    purchase_order_number: null,
    service_or_delivery_date: null,
  };

  // Évaluer toutes les règles
  const results: RuleResult[] = ALL_RULES.map((rule) => rule(safeFields));

  // Séparer les résultats par catégorie et statut
  const blocking_errors = results.filter(
    (r) => r.category === "blocking" && !r.passed
  );
  const warnings = results.filter(
    (r) => r.category === "warning" && !r.passed
  );
  const suggestions = results.filter(
    (r) => r.category === "suggestion" && !r.passed
  );

  // Calculer le score
  const totalDeduction =
    [...blocking_errors, ...warnings].reduce(
      (sum, r) => sum + r.score_impact,
      0
    );

  const score = Math.max(0, Math.min(100, 100 + totalDeduction));
  const band  = getScoreBand(score);

  return {
    score,
    band,
    blocking_errors,
    warnings,
    suggestions,
    rules_version: RULES_VERSION,
    checked_at: new Date().toISOString(),
  };
}
