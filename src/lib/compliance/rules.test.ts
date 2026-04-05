import { describe, it, expect } from "vitest";
import type { StructuredInvoiceFields } from "@/lib/extraction/types";
import {
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
  ruleDueDateRecommended,
  rulePaymentTermsRecommended,
  rulePurchaseOrderRecommended,
  ruleVatArithmeticCheck,
  ruleKnownVatRates,
  ruleIssueDateNotFuture,
  ruleBuyerIdentifierRecommended,
  ruleBuyerVatNumberRecommended,
  ruleServiceDeliveryDateRecommended,
  ruleCurrencyStated,
} from "./rules";

// --------------------------------------------------------------------------
// Fixture : champs complets (facture idéale)
// --------------------------------------------------------------------------

const FULL: StructuredInvoiceFields = {
  invoice_number:           "FA-2024-001",
  issue_date:               "2024-01-15",
  due_date:                 "2024-02-15",
  currency:                 "EUR",
  invoice_type:             "FACTURE",
  seller_name:              "ACME SAS",
  seller_address:           "12 rue de la Paix, 75001 Paris",
  seller_siren:             "123456789",
  seller_siret:             "12345678900012",
  seller_vat_number:        "FR12123456789",
  buyer_name:               "Client SA",
  buyer_address:            "1 av. Victor Hugo, 69001 Lyon",
  buyer_siren:              "987654321",
  buyer_siret:              "98765432100011",
  buyer_vat_number:         "FR99987654321",
  subtotal_excl_tax:        1000.00,
  total_tax:                200.00,
  total_incl_tax:           1200.00,
  amount_due:               1200.00,
  vat_rates_detected:       ["20%"],
  tax_breakdown_raw:        "TVA 20% : 200,00 €",
  line_items_raw:           "Prestation de conseil : 1 000,00 €",
  payment_terms:            "30 jours nets",
  purchase_order_number:    "BC-2024-42",
  service_or_delivery_date: "2024-01-10",
};

/** Retourne FULL avec les overrides donnés */
function fields(overrides: Partial<StructuredInvoiceFields>): StructuredInvoiceFields {
  return { ...FULL, ...overrides };
}

// ============================================================================
// Règles bloquantes
// ============================================================================

describe("ruleInvoiceNumberPresent", () => {
  it("passe si invoice_number est présent", () => {
    expect(ruleInvoiceNumberPresent(FULL).passed).toBe(true);
  });
  it("échoue si invoice_number est null", () => {
    expect(ruleInvoiceNumberPresent(fields({ invoice_number: null })).passed).toBe(false);
  });
  it("échoue si invoice_number est une chaîne vide", () => {
    expect(ruleInvoiceNumberPresent(fields({ invoice_number: "  " })).passed).toBe(false);
  });
  it("a une catégorie 'blocking'", () => {
    expect(ruleInvoiceNumberPresent(FULL).category).toBe("blocking");
  });
  it("a un score_impact négatif", () => {
    expect(ruleInvoiceNumberPresent(FULL).score_impact).toBeLessThan(0);
  });
});

describe("ruleIssueDatePresent", () => {
  it("passe si issue_date est présente", () => {
    expect(ruleIssueDatePresent(FULL).passed).toBe(true);
  });
  it("échoue si issue_date est null", () => {
    expect(ruleIssueDatePresent(fields({ issue_date: null })).passed).toBe(false);
  });
});

describe("ruleSellerNamePresent", () => {
  it("passe si seller_name est présent", () => {
    expect(ruleSellerNamePresent(FULL).passed).toBe(true);
  });
  it("échoue si seller_name est null", () => {
    expect(ruleSellerNamePresent(fields({ seller_name: null })).passed).toBe(false);
  });
});

describe("ruleSellerAddressPresent", () => {
  it("passe si seller_address est présente", () => {
    expect(ruleSellerAddressPresent(FULL).passed).toBe(true);
  });
  it("échoue si seller_address est null", () => {
    expect(ruleSellerAddressPresent(fields({ seller_address: null })).passed).toBe(false);
  });
});

describe("ruleSellerIdentifierPresent", () => {
  it("passe si seller_siret est présent", () => {
    expect(ruleSellerIdentifierPresent(FULL).passed).toBe(true);
  });
  it("passe si seulement seller_siren est présent", () => {
    expect(
      ruleSellerIdentifierPresent(fields({ seller_siret: null })).passed
    ).toBe(true);
  });
  it("passe si seulement seller_siret est présent", () => {
    expect(
      ruleSellerIdentifierPresent(fields({ seller_siren: null })).passed
    ).toBe(true);
  });
  it("échoue si ni siren ni siret", () => {
    expect(
      ruleSellerIdentifierPresent(
        fields({ seller_siren: null, seller_siret: null })
      ).passed
    ).toBe(false);
  });
});

describe("ruleSellerVatNumberPresent", () => {
  it("passe si seller_vat_number est présent", () => {
    expect(ruleSellerVatNumberPresent(FULL).passed).toBe(true);
  });
  it("échoue si seller_vat_number est null", () => {
    expect(ruleSellerVatNumberPresent(fields({ seller_vat_number: null })).passed).toBe(false);
  });
});

describe("ruleBuyerNamePresent", () => {
  it("passe si buyer_name est présent", () => {
    expect(ruleBuyerNamePresent(FULL).passed).toBe(true);
  });
  it("échoue si buyer_name est null", () => {
    expect(ruleBuyerNamePresent(fields({ buyer_name: null })).passed).toBe(false);
  });
});

describe("ruleBuyerAddressPresent", () => {
  it("passe si buyer_address est présente", () => {
    expect(ruleBuyerAddressPresent(FULL).passed).toBe(true);
  });
  it("échoue si buyer_address est null", () => {
    expect(ruleBuyerAddressPresent(fields({ buyer_address: null })).passed).toBe(false);
  });
});

describe("ruleSubtotalExclTaxPresent", () => {
  it("passe si subtotal_excl_tax est un nombre", () => {
    expect(ruleSubtotalExclTaxPresent(FULL).passed).toBe(true);
  });
  it("passe pour la valeur 0", () => {
    expect(ruleSubtotalExclTaxPresent(fields({ subtotal_excl_tax: 0 })).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(ruleSubtotalExclTaxPresent(fields({ subtotal_excl_tax: null })).passed).toBe(false);
  });
});

describe("ruleTotalTaxPresent", () => {
  it("passe si total_tax est un nombre", () => {
    expect(ruleTotalTaxPresent(FULL).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(ruleTotalTaxPresent(fields({ total_tax: null })).passed).toBe(false);
  });
});

describe("ruleTotalInclTaxPresent", () => {
  it("passe si total_incl_tax est un nombre", () => {
    expect(ruleTotalInclTaxPresent(FULL).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(ruleTotalInclTaxPresent(fields({ total_incl_tax: null })).passed).toBe(false);
  });
});

describe("ruleVatRatesPresent", () => {
  it("passe si au moins un taux est présent", () => {
    expect(ruleVatRatesPresent(FULL).passed).toBe(true);
  });
  it("échoue si le tableau est vide", () => {
    expect(ruleVatRatesPresent(fields({ vat_rates_detected: [] })).passed).toBe(false);
  });
  it("échoue si null", () => {
    expect(ruleVatRatesPresent(fields({ vat_rates_detected: null })).passed).toBe(false);
  });
});

describe("ruleLineItemsPresent", () => {
  it("passe si line_items_raw est présent", () => {
    expect(ruleLineItemsPresent(FULL).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(ruleLineItemsPresent(fields({ line_items_raw: null })).passed).toBe(false);
  });
  it("échoue si chaîne vide", () => {
    expect(ruleLineItemsPresent(fields({ line_items_raw: "  " })).passed).toBe(false);
  });
});

// ============================================================================
// Règles d'avertissement
// ============================================================================

describe("ruleDueDateRecommended", () => {
  it("passe si due_date est présente", () => {
    expect(ruleDueDateRecommended(FULL).passed).toBe(true);
  });
  it("échoue (warning) si due_date est null", () => {
    const r = ruleDueDateRecommended(fields({ due_date: null }));
    expect(r.passed).toBe(false);
    expect(r.category).toBe("warning");
  });
});

describe("rulePaymentTermsRecommended", () => {
  it("passe si payment_terms est présent", () => {
    expect(rulePaymentTermsRecommended(FULL).passed).toBe(true);
  });
  it("échoue si payment_terms est null", () => {
    expect(rulePaymentTermsRecommended(fields({ payment_terms: null })).passed).toBe(false);
  });
});

describe("rulePurchaseOrderRecommended", () => {
  it("passe si purchase_order_number est présent", () => {
    expect(rulePurchaseOrderRecommended(FULL).passed).toBe(true);
  });
  it("échoue si purchase_order_number est null", () => {
    expect(rulePurchaseOrderRecommended(fields({ purchase_order_number: null })).passed).toBe(false);
  });
});

describe("ruleVatArithmeticCheck", () => {
  it("passe si HT + TVA = TTC", () => {
    expect(ruleVatArithmeticCheck(FULL).passed).toBe(true);
  });
  it("passe avec un écart ≤ 0.02 (arrondi centimes)", () => {
    // 1000.00 + 200.01 = 1200.01 ≈ 1200.00 (écart 0.01)
    expect(
      ruleVatArithmeticCheck(
        fields({ subtotal_excl_tax: 1000.0, total_tax: 200.01, total_incl_tax: 1200.00 })
      ).passed
    ).toBe(true);
  });
  it("échoue si l'écart dépasse 0.02", () => {
    expect(
      ruleVatArithmeticCheck(
        fields({ subtotal_excl_tax: 1000.0, total_tax: 200.0, total_incl_tax: 1300.0 })
      ).passed
    ).toBe(false);
  });
  it("passe si l'un des montants est null (pas de vérification possible)", () => {
    expect(
      ruleVatArithmeticCheck(fields({ total_incl_tax: null })).passed
    ).toBe(true);
  });
});

describe("ruleKnownVatRates", () => {
  it("passe pour les taux français standards", () => {
    for (const rate of ["0%", "2.1%", "5.5%", "10%", "20%"]) {
      expect(
        ruleKnownVatRates(fields({ vat_rates_detected: [rate] })).passed
      ).toBe(true);
    }
  });
  it("échoue pour un taux inconnu", () => {
    expect(
      ruleKnownVatRates(fields({ vat_rates_detected: ["15%"] })).passed
    ).toBe(false);
  });
  it("échoue si au moins un taux est inconnu", () => {
    expect(
      ruleKnownVatRates(fields({ vat_rates_detected: ["20%", "7%"] })).passed
    ).toBe(false);
  });
  it("passe si vat_rates_detected est null (pas de taux à vérifier)", () => {
    expect(ruleKnownVatRates(fields({ vat_rates_detected: null })).passed).toBe(true);
  });
  it("normalise '20,0%' → '20%'", () => {
    expect(
      ruleKnownVatRates(fields({ vat_rates_detected: ["20,0%"] })).passed
    ).toBe(true);
  });
});

describe("ruleIssueDateNotFuture", () => {
  it("passe pour une date passée", () => {
    expect(
      ruleIssueDateNotFuture(fields({ issue_date: "2020-01-01" })).passed
    ).toBe(true);
  });
  it("échoue pour une date future", () => {
    expect(
      ruleIssueDateNotFuture(fields({ issue_date: "2099-12-31" })).passed
    ).toBe(false);
  });
  it("passe si issue_date est null (pas de date à vérifier)", () => {
    expect(ruleIssueDateNotFuture(fields({ issue_date: null })).passed).toBe(true);
  });
});

// ============================================================================
// Règles de suggestion
// ============================================================================

describe("ruleBuyerIdentifierRecommended", () => {
  it("passe si buyer_siret est présent", () => {
    expect(ruleBuyerIdentifierRecommended(FULL).passed).toBe(true);
  });
  it("passe si seulement buyer_siren est présent", () => {
    expect(
      ruleBuyerIdentifierRecommended(fields({ buyer_siret: null })).passed
    ).toBe(true);
  });
  it("échoue si ni siren ni siret acheteur", () => {
    expect(
      ruleBuyerIdentifierRecommended(
        fields({ buyer_siren: null, buyer_siret: null })
      ).passed
    ).toBe(false);
  });
  it("a un score_impact de 0 (pas de déduction)", () => {
    expect(ruleBuyerIdentifierRecommended(FULL).score_impact).toBe(0);
  });
  it("a une catégorie 'suggestion'", () => {
    expect(ruleBuyerIdentifierRecommended(FULL).category).toBe("suggestion");
  });
});

describe("ruleBuyerVatNumberRecommended", () => {
  it("passe si buyer_vat_number est présent", () => {
    expect(ruleBuyerVatNumberRecommended(FULL).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(ruleBuyerVatNumberRecommended(fields({ buyer_vat_number: null })).passed).toBe(false);
  });
  it("score_impact = 0", () => {
    expect(ruleBuyerVatNumberRecommended(FULL).score_impact).toBe(0);
  });
});

describe("ruleServiceDeliveryDateRecommended", () => {
  it("passe si service_or_delivery_date est présente", () => {
    expect(ruleServiceDeliveryDateRecommended(FULL).passed).toBe(true);
  });
  it("échoue si null", () => {
    expect(
      ruleServiceDeliveryDateRecommended(fields({ service_or_delivery_date: null })).passed
    ).toBe(false);
  });
});

describe("ruleCurrencyStated", () => {
  it("passe si currency est présente", () => {
    expect(ruleCurrencyStated(FULL).passed).toBe(true);
  });
  it("échoue si currency est null", () => {
    expect(ruleCurrencyStated(fields({ currency: null })).passed).toBe(false);
  });
  it("score_impact = 0", () => {
    expect(ruleCurrencyStated(FULL).score_impact).toBe(0);
  });
});
