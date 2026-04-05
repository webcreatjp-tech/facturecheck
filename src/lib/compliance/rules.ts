import type { RuleResult } from "./types";
import type { StructuredInvoiceFields } from "@/lib/extraction/types";

// --------------------------------------------------------------------------
// Taux de TVA français valides (CGI art. 278 et suivants)
// --------------------------------------------------------------------------

const FRENCH_VAT_RATES = new Set(["0%", "2.1%", "5.5%", "10%", "20%"]);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function present(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== "";
}

function presentNum(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && isFinite(value);
}

// --------------------------------------------------------------------------
// Règles bloquantes
// (impact minimum -11 pour garantir : 1 erreur → score ≤ 89, hors "conforme")
// --------------------------------------------------------------------------

export function ruleInvoiceNumberPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "invoice_number_present",
    category:     "blocking",
    field_name:   "invoice_number",
    message:
      "Le numéro de facture est obligatoire (art. 242 nonies A, 1° CGI ann. II).",
    passed:       present(fields.invoice_number),
    score_impact: -12,
  };
}

export function ruleIssueDatePresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "issue_date_present",
    category:     "blocking",
    field_name:   "issue_date",
    message:
      "La date d'émission de la facture est obligatoire.",
    passed:       present(fields.issue_date),
    score_impact: -12,
  };
}

export function ruleSellerNamePresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "seller_name_present",
    category:     "blocking",
    field_name:   "seller_name",
    message:
      "La raison sociale ou le nom de l'émetteur est obligatoire.",
    passed:       present(fields.seller_name),
    score_impact: -12,
  };
}

export function ruleSellerAddressPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "seller_address_present",
    category:     "blocking",
    field_name:   "seller_address",
    message:
      "L'adresse complète de l'émetteur est obligatoire.",
    passed:       present(fields.seller_address),
    score_impact: -11,
  };
}

export function ruleSellerIdentifierPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  const hasSiren = present(fields.seller_siren);
  const hasSiret = present(fields.seller_siret);
  return {
    rule_id:      "seller_identifier_present",
    category:     "blocking",
    field_name:   "seller_siren",
    message:
      "Le SIREN ou le SIRET de l'émetteur est obligatoire pour identifier l'entreprise.",
    passed:       hasSiren || hasSiret,
    score_impact: -12,
  };
}

export function ruleSellerVatNumberPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "seller_vat_number_present",
    category:     "blocking",
    field_name:   "seller_vat_number",
    message:
      "Le numéro de TVA intracommunautaire de l'émetteur est requis pour les assujettis à la TVA.",
    passed:       present(fields.seller_vat_number),
    score_impact: -11,
  };
}

export function ruleBuyerNamePresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "buyer_name_present",
    category:     "blocking",
    field_name:   "buyer_name",
    message:
      "La raison sociale ou le nom du destinataire est obligatoire.",
    passed:       present(fields.buyer_name),
    score_impact: -12,
  };
}

export function ruleBuyerAddressPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "buyer_address_present",
    category:     "blocking",
    field_name:   "buyer_address",
    message:
      "L'adresse complète du destinataire est obligatoire.",
    passed:       present(fields.buyer_address),
    score_impact: -11,
  };
}

export function ruleSubtotalExclTaxPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "subtotal_excl_tax_present",
    category:     "blocking",
    field_name:   "subtotal_excl_tax",
    message:
      "Le montant total hors taxes (HT) est obligatoire.",
    passed:       presentNum(fields.subtotal_excl_tax),
    score_impact: -11,
  };
}

export function ruleTotalTaxPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "total_tax_present",
    category:     "blocking",
    field_name:   "total_tax",
    message:
      "Le montant de la TVA doit être indiqué.",
    passed:       presentNum(fields.total_tax),
    score_impact: -11,
  };
}

export function ruleTotalInclTaxPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "total_incl_tax_present",
    category:     "blocking",
    field_name:   "total_incl_tax",
    message:
      "Le montant total toutes taxes comprises (TTC) est obligatoire.",
    passed:       presentNum(fields.total_incl_tax),
    score_impact: -11,
  };
}

export function ruleVatRatesPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  const rates = fields.vat_rates_detected;
  return {
    rule_id:      "vat_rates_present",
    category:     "blocking",
    field_name:   "vat_rates_detected",
    message:
      "Au moins un taux de TVA applicable doit être mentionné sur la facture.",
    passed:       Array.isArray(rates) && rates.length > 0,
    score_impact: -11,
  };
}

export function ruleLineItemsPresent(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "line_items_present",
    category:     "blocking",
    field_name:   "line_items_raw",
    message:
      "La description des prestations ou marchandises facturées est obligatoire.",
    passed:       present(fields.line_items_raw),
    score_impact: -11,
  };
}

// --------------------------------------------------------------------------
// Avertissements
// --------------------------------------------------------------------------

export function ruleDueDateRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "due_date_recommended",
    category:     "warning",
    field_name:   "due_date",
    message:
      "La date d'échéance est recommandée pour les factures B2B (délais de paiement légaux).",
    passed:       present(fields.due_date),
    score_impact: -3,
  };
}

export function rulePaymentTermsRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "payment_terms_recommended",
    category:     "warning",
    field_name:   "payment_terms",
    message:
      "Les conditions de règlement (délai, mode de paiement) doivent figurer sur la facture.",
    passed:       present(fields.payment_terms),
    score_impact: -3,
  };
}

export function rulePurchaseOrderRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "purchase_order_recommended",
    category:     "warning",
    field_name:   "purchase_order_number",
    message:
      "L'indication du numéro de bon de commande est conseillée pour les transactions B2B.",
    passed:       present(fields.purchase_order_number),
    score_impact: -2,
  };
}

export function ruleVatArithmeticCheck(
  fields: StructuredInvoiceFields
): RuleResult {
  const { subtotal_excl_tax: ht, total_tax: tva, total_incl_tax: ttc } = fields;
  let passed = true;

  if (presentNum(ht) && presentNum(tva) && presentNum(ttc)) {
    const expected = Math.round((ht! + tva!) * 100) / 100;
    const actual   = Math.round(ttc! * 100) / 100;
    passed = Math.abs(expected - actual) <= 0.02;
  }

  return {
    rule_id:      "vat_arithmetic_check",
    category:     "warning",
    field_name:   "total_incl_tax",
    message:
      "Le total TTC ne correspond pas à la somme HT + TVA — vérifiez les montants.",
    passed,
    score_impact: -5,
  };
}

export function ruleKnownVatRates(
  fields: StructuredInvoiceFields
): RuleResult {
  const rates = fields.vat_rates_detected;
  let passed = true;

  if (Array.isArray(rates) && rates.length > 0) {
    passed = rates.every((r) => {
      // Normalise "20%" → "20%", "20,0%" → "20%"
      const normalized = r.replace(",", ".").replace(/\.0+%$/, "%");
      return FRENCH_VAT_RATES.has(normalized);
    });
  }

  return {
    rule_id:      "vat_rate_known",
    category:     "warning",
    field_name:   "vat_rates_detected",
    message:
      "Un taux de TVA inhabituel a été détecté — vérifiez qu'il s'applique bien à ce type de prestation.",
    passed,
    score_impact: -3,
  };
}

export function ruleIssueDateNotFuture(
  fields: StructuredInvoiceFields
): RuleResult {
  let passed = true;

  if (present(fields.issue_date)) {
    const issueDate = new Date(fields.issue_date!);
    const today     = new Date();
    today.setHours(23, 59, 59, 999); // fin de journée aujourd'hui
    passed = !isNaN(issueDate.getTime()) && issueDate <= today;
  }

  return {
    rule_id:      "issue_date_not_future",
    category:     "warning",
    field_name:   "issue_date",
    message:
      "La date d'émission est dans le futur — vérifiez qu'il ne s'agit pas d'une erreur.",
    passed,
    score_impact: -4,
  };
}

// --------------------------------------------------------------------------
// Suggestions (bonnes pratiques, aucune déduction de points)
// --------------------------------------------------------------------------

export function ruleBuyerIdentifierRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "buyer_identifier_recommended",
    category:     "suggestion",
    field_name:   "buyer_siren",
    message:
      "Indiquer le SIREN ou SIRET du client améliore la traçabilité B2B.",
    passed:       present(fields.buyer_siren) || present(fields.buyer_siret),
    score_impact: 0,
  };
}

export function ruleBuyerVatNumberRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "buyer_vat_number_recommended",
    category:     "suggestion",
    field_name:   "buyer_vat_number",
    message:
      "Le numéro de TVA du client est recommandé pour les opérations intracommunautaires.",
    passed:       present(fields.buyer_vat_number),
    score_impact: 0,
  };
}

export function ruleServiceDeliveryDateRecommended(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "service_delivery_date_recommended",
    category:     "suggestion",
    field_name:   "service_or_delivery_date",
    message:
      "La date de réalisation de la prestation ou de livraison est recommandée.",
    passed:       present(fields.service_or_delivery_date),
    score_impact: 0,
  };
}

export function ruleCurrencyStated(
  fields: StructuredInvoiceFields
): RuleResult {
  return {
    rule_id:      "currency_stated",
    category:     "suggestion",
    field_name:   "currency",
    message:
      "La devise utilisée devrait être explicitement mentionnée sur la facture.",
    passed:       present(fields.currency),
    score_impact: 0,
  };
}

// --------------------------------------------------------------------------
// Registre ordonné de toutes les règles
// --------------------------------------------------------------------------

export type RuleFunction = (fields: StructuredInvoiceFields) => RuleResult;

export const ALL_RULES: RuleFunction[] = [
  // Blocking
  ruleInvoiceNumberPresent,
  ruleIssueDatePresent,
  ruleSellerNamePresent,
  ruleSellerAddressPresent,
  ruleSellerIdentifierPresent,
  ruleSellerVatNumberPresent,
  ruleBuyerNamePresent,
  ruleBuyerAddressPresent,
  ruleSubtotalExclTaxPresent,
  ruleTotalTaxPresent,
  ruleTotalInclTaxPresent,
  ruleVatRatesPresent,
  ruleLineItemsPresent,
  // Warnings
  ruleDueDateRecommended,
  rulePaymentTermsRecommended,
  rulePurchaseOrderRecommended,
  ruleVatArithmeticCheck,
  ruleKnownVatRates,
  ruleIssueDateNotFuture,
  // Suggestions
  ruleBuyerIdentifierRecommended,
  ruleBuyerVatNumberRecommended,
  ruleServiceDeliveryDateRecommended,
  ruleCurrencyStated,
];
