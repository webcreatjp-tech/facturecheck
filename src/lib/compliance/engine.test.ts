import { describe, it, expect } from "vitest";
import { checkCompliance, getScoreBand } from "./engine";
import type { StructuredInvoiceFields } from "@/lib/extraction/types";

// --------------------------------------------------------------------------
// Fixture
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
  line_items_raw:           "Prestation de conseil",
  payment_terms:            "30 jours nets",
  purchase_order_number:    "BC-42",
  service_or_delivery_date: "2024-01-10",
};

const EMPTY: StructuredInvoiceFields = {
  invoice_number: null, issue_date: null, due_date: null, currency: null,
  invoice_type: null, seller_name: null, seller_address: null, seller_siren: null,
  seller_siret: null, seller_vat_number: null, buyer_name: null, buyer_address: null,
  buyer_siren: null, buyer_siret: null, buyer_vat_number: null,
  subtotal_excl_tax: null, total_tax: null, total_incl_tax: null, amount_due: null,
  vat_rates_detected: null, tax_breakdown_raw: null, line_items_raw: null,
  payment_terms: null, purchase_order_number: null, service_or_delivery_date: null,
};

// --------------------------------------------------------------------------
// getScoreBand
// --------------------------------------------------------------------------

describe("getScoreBand", () => {
  it("100 → conforme", () => expect(getScoreBand(100)).toBe("conforme"));
  it("90 → conforme",  () => expect(getScoreBand(90)).toBe("conforme"));
  it("89 → attention", () => expect(getScoreBand(89)).toBe("attention"));
  it("70 → attention", () => expect(getScoreBand(70)).toBe("attention"));
  it("69 → non_conforme_corrections", () =>
    expect(getScoreBand(69)).toBe("non_conforme_corrections"));
  it("50 → non_conforme_corrections", () =>
    expect(getScoreBand(50)).toBe("non_conforme_corrections"));
  it("49 → non_conforme_invalide", () =>
    expect(getScoreBand(49)).toBe("non_conforme_invalide"));
  it("0 → non_conforme_invalide",  () =>
    expect(getScoreBand(0)).toBe("non_conforme_invalide"));
});

// --------------------------------------------------------------------------
// checkCompliance – champs complets
// --------------------------------------------------------------------------

describe("checkCompliance – facture idéale (tous champs présents)", () => {
  it("retourne score 100", () => {
    expect(checkCompliance(FULL).score).toBe(100);
  });
  it("retourne band 'conforme'", () => {
    expect(checkCompliance(FULL).band).toBe("conforme");
  });
  it("aucune erreur bloquante", () => {
    expect(checkCompliance(FULL).blocking_errors).toHaveLength(0);
  });
  it("aucun avertissement", () => {
    expect(checkCompliance(FULL).warnings).toHaveLength(0);
  });
  it("retourne rules_version", () => {
    expect(checkCompliance(FULL).rules_version).toBeTruthy();
  });
  it("retourne checked_at en ISO 8601 valide", () => {
    const r = checkCompliance(FULL);
    expect(() => new Date(r.checked_at)).not.toThrow();
    expect(new Date(r.checked_at).toISOString()).toBe(r.checked_at);
  });
});

// --------------------------------------------------------------------------
// checkCompliance – tous les champs absents
// --------------------------------------------------------------------------

describe("checkCompliance – tous champs absents", () => {
  it("retourne score 0 (plancher)", () => {
    expect(checkCompliance(EMPTY).score).toBe(0);
  });
  it("retourne band 'non_conforme_invalide'", () => {
    expect(checkCompliance(EMPTY).band).toBe("non_conforme_invalide");
  });
  it("a 13 erreurs bloquantes", () => {
    expect(checkCompliance(EMPTY).blocking_errors).toHaveLength(13);
  });
});

// --------------------------------------------------------------------------
// checkCompliance – null / undefined en entrée
// --------------------------------------------------------------------------

describe("checkCompliance – champs null ou undefined", () => {
  it("ne plante pas si fields est null", () => {
    expect(() => checkCompliance(null)).not.toThrow();
    expect(checkCompliance(null).score).toBe(0);
  });
  it("ne plante pas si fields est undefined", () => {
    expect(() => checkCompliance(undefined)).not.toThrow();
  });
});

// --------------------------------------------------------------------------
// checkCompliance – une erreur bloquante
// --------------------------------------------------------------------------

describe("checkCompliance – une seule erreur bloquante", () => {
  it("score < 90 (hors bande conforme)", () => {
    const report = checkCompliance({ ...FULL, invoice_number: null });
    expect(report.score).toBeLessThan(90);
  });
  it("a exactement 1 erreur bloquante", () => {
    const report = checkCompliance({ ...FULL, invoice_number: null });
    expect(report.blocking_errors).toHaveLength(1);
    expect(report.blocking_errors[0].rule_id).toBe("invoice_number_present");
  });
  it("band 'attention' si 1 erreur bloquante", () => {
    const report = checkCompliance({ ...FULL, invoice_number: null });
    expect(report.band).toBe("attention");
  });
});

// --------------------------------------------------------------------------
// checkCompliance – arithmétique TVA incorrecte
// --------------------------------------------------------------------------

describe("checkCompliance – mismatch TVA", () => {
  it("génère un avertissement vat_arithmetic_check", () => {
    const report = checkCompliance({
      ...FULL,
      subtotal_excl_tax: 1000,
      total_tax: 200,
      total_incl_tax: 1350, // incorrect
    });
    const w = report.warnings.find((r) => r.rule_id === "vat_arithmetic_check");
    expect(w).toBeDefined();
    expect(w!.passed).toBe(false);
  });
  it("ne génère pas d'avertissement si les montants correspondent", () => {
    const report = checkCompliance(FULL);
    const w = report.warnings.find((r) => r.rule_id === "vat_arithmetic_check");
    expect(w).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// checkCompliance – date d'émission future
// --------------------------------------------------------------------------

describe("checkCompliance – date future", () => {
  it("génère un avertissement issue_date_not_future", () => {
    const report = checkCompliance({ ...FULL, issue_date: "2099-12-31" });
    const w = report.warnings.find((r) => r.rule_id === "issue_date_not_future");
    expect(w).toBeDefined();
    expect(w!.passed).toBe(false);
  });
});

// --------------------------------------------------------------------------
// checkCompliance – taux de TVA inconnu
// --------------------------------------------------------------------------

describe("checkCompliance – taux TVA inconnu", () => {
  it("génère un avertissement vat_rate_known pour taux inhabituel", () => {
    const report = checkCompliance({
      ...FULL,
      vat_rates_detected: ["15%"],
    });
    const w = report.warnings.find((r) => r.rule_id === "vat_rate_known");
    expect(w).toBeDefined();
  });
  it("pas d'avertissement pour les taux français standards", () => {
    for (const rate of ["0%", "2.1%", "5.5%", "10%", "20%"]) {
      const report = checkCompliance({ ...FULL, vat_rates_detected: [rate] });
      const w = report.warnings.find((r) => r.rule_id === "vat_rate_known");
      expect(w).toBeUndefined();
    }
  });
});

// --------------------------------------------------------------------------
// checkCompliance – suggestions
// --------------------------------------------------------------------------

describe("checkCompliance – suggestions", () => {
  it("aucune suggestion si tous les champs sont présents", () => {
    expect(checkCompliance(FULL).suggestions).toHaveLength(0);
  });

  it("génère des suggestions pour les champs acheteur manquants", () => {
    const report = checkCompliance({
      ...FULL,
      buyer_siren: null,
      buyer_siret: null,
      buyer_vat_number: null,
      service_or_delivery_date: null,
      currency: null,
    });
    expect(report.suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("les suggestions n'affectent pas le score", () => {
    const withSuggestions = checkCompliance({
      ...FULL,
      buyer_siren: null,
      buyer_siret: null,
    });
    const without = checkCompliance(FULL);
    expect(withSuggestions.score).toBe(without.score);
  });
});

// --------------------------------------------------------------------------
// checkCompliance – déterminisme
// --------------------------------------------------------------------------

describe("checkCompliance – déterminisme", () => {
  it("produit le même résultat pour la même entrée", () => {
    const r1 = checkCompliance(FULL);
    const r2 = checkCompliance(FULL);
    expect(r1.score).toBe(r2.score);
    expect(r1.band).toBe(r2.band);
    expect(r1.blocking_errors.length).toBe(r2.blocking_errors.length);
  });

  it("ne modifie pas l'objet fields passé en entrée", () => {
    const copy = { ...FULL };
    checkCompliance(FULL);
    expect(FULL).toEqual(copy);
  });
});

// --------------------------------------------------------------------------
// checkCompliance – score planché et plafond
// --------------------------------------------------------------------------

describe("checkCompliance – bornes du score", () => {
  it("score ne dépasse jamais 100", () => {
    expect(checkCompliance(FULL).score).toBeLessThanOrEqual(100);
  });
  it("score ne descend jamais en dessous de 0", () => {
    expect(checkCompliance(EMPTY).score).toBeGreaterThanOrEqual(0);
  });
});
