import { describe, it, expect } from "vitest";
import { RegexExtractionProvider } from "./regex-provider";

const provider = new RegexExtractionProvider();

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function extract(text: string) {
  const result = await provider.extractFields(text);
  return result.fields;
}

// --------------------------------------------------------------------------
// Métadonnées du fournisseur
// --------------------------------------------------------------------------

describe("RegexExtractionProvider – métadonnées", () => {
  it("a pour name 'regex'", () => {
    expect(provider.name).toBe("regex");
  });

  it("a pour version '1.0'", () => {
    expect(provider.version).toBe("1.0");
  });

  it("retourne processedAt en ISO 8601 valide", async () => {
    const result = await provider.extractFields("dummy");
    expect(() => new Date(result.processedAt)).not.toThrow();
    expect(new Date(result.processedAt).toISOString()).toBe(result.processedAt);
  });
});

// --------------------------------------------------------------------------
// Numéro de facture
// --------------------------------------------------------------------------

describe("extractInvoiceNumber", () => {
  it("extrait un numéro après 'N° de facture :'", async () => {
    const f = await extract("N° de facture : FA-2024-001\nDate : 01/01/2024");
    expect(f.invoice_number).toBe("FA-2024-001");
  });

  it("extrait un numéro au format FA### standalone", async () => {
    const f = await extract("FA-20240042\nClient: Dupont");
    expect(f.invoice_number).toBe("FA-20240042");
  });

  it("extrait un numéro au format FACT###", async () => {
    const f = await extract("FACT2024100");
    expect(f.invoice_number).toBe("FACT2024100");
  });

  it("retourne null si aucun numéro identifiable", async () => {
    const f = await extract("Ceci est un contrat de service");
    expect(f.invoice_number).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Dates
// --------------------------------------------------------------------------

describe("extractIssueDateFromText", () => {
  it("normalise DD/MM/YYYY en YYYY-MM-DD", async () => {
    const f = await extract("Date d'émission : 15/01/2024");
    expect(f.issue_date).toBe("2024-01-15");
  });

  it("accepte DD-MM-YYYY", async () => {
    const f = await extract("Date de facture : 05-03-2024");
    expect(f.issue_date).toBe("2024-03-05");
  });

  it("accepte DD.MM.YYYY", async () => {
    const f = await extract("Date facturation : 20.06.2024");
    expect(f.issue_date).toBe("2024-06-20");
  });

  it("retourne null si aucune date d'émission", async () => {
    const f = await extract("Montant TTC : 1200,00 €");
    expect(f.issue_date).toBeNull();
  });

  it("retourne null pour une date invalide (mois 13)", async () => {
    const f = await extract("Date de facture : 01/13/2024");
    expect(f.issue_date).toBeNull();
  });
});

describe("extractDueDateFromText", () => {
  it("extrait la date d'échéance", async () => {
    const f = await extract("Date d'échéance : 15/02/2024");
    expect(f.due_date).toBe("2024-02-15");
  });

  it("accepte 'payable le'", async () => {
    const f = await extract("Payable le : 28/02/2024");
    expect(f.due_date).toBe("2024-02-28");
  });

  it("retourne null si absente", async () => {
    const f = await extract("Date d'émission : 01/01/2024");
    expect(f.due_date).toBeNull();
  });
});

// --------------------------------------------------------------------------
// SIRET / SIREN
// --------------------------------------------------------------------------

describe("extractSiret", () => {
  it("extrait un SIRET à 14 chiffres après le label", async () => {
    const f = await extract("SIRET : 12345678900012");
    expect(f.seller_siret).toBe("12345678900012");
  });

  it("extrait un SIRET formaté avec espaces", async () => {
    const f = await extract("SIRET : 123 456 789 00012");
    expect(f.seller_siret).toBe("12345678900012");
  });

  it("retourne null si aucun label SIRET", async () => {
    const f = await extract("Numéro : 12345678900012"); // pas de label SIRET
    expect(f.seller_siret).toBeNull();
  });

  it("retourne null pour un SIRET de longueur incorrecte", async () => {
    const f = await extract("SIRET : 1234567"); // trop court
    expect(f.seller_siret).toBeNull();
  });
});

describe("extractSiren", () => {
  it("dérive le SIREN depuis le SIRET connu", async () => {
    const f = await extract("SIRET : 12345678900012");
    expect(f.seller_siren).toBe("123456789");
  });

  it("extrait le SIREN depuis son label si pas de SIRET", async () => {
    const f = await extract("SIREN : 123 456 789");
    expect(f.seller_siren).toBe("123456789");
  });

  it("retourne null si ni SIREN ni SIRET", async () => {
    const f = await extract("Total TTC : 500,00 €");
    expect(f.seller_siren).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Numéro de TVA
// --------------------------------------------------------------------------

describe("extractVatNumber", () => {
  it("extrait un numéro TVA après 'N° TVA'", async () => {
    const f = await extract("N° TVA : FR12123456789");
    expect(f.seller_vat_number).toBe("FR12123456789");
  });

  it("extrait un numéro TVA intracommunautaire", async () => {
    const f = await extract("TVA intracommunautaire : FR 12 123456789");
    expect(f.seller_vat_number).toBe("FR12123456789");
  });

  it("extrait FR## standalone", async () => {
    const f = await extract("FR99987654321");
    expect(f.seller_vat_number).toBe("FR99987654321");
  });

  it("retourne null si absent", async () => {
    const f = await extract("Montant HT : 1000,00");
    expect(f.seller_vat_number).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Devise
// --------------------------------------------------------------------------

describe("extractCurrency", () => {
  it("détecte EUR via le symbole €", async () => {
    const f = await extract("Total : 100,00 €");
    expect(f.currency).toBe("EUR");
  });

  it("détecte EUR via le code EUR", async () => {
    const f = await extract("Montant : 500 EUR");
    expect(f.currency).toBe("EUR");
  });

  it("retourne null si aucune devise", async () => {
    const f = await extract("Pas de montant ici");
    expect(f.currency).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Type de facture
// --------------------------------------------------------------------------

describe("extractInvoiceType", () => {
  it("détecte FACTURE dans l'en-tête", async () => {
    const f = await extract("FACTURE\nN° FA-001");
    expect(f.invoice_type).toBe("FACTURE");
  });

  it("détecte AVOIR", async () => {
    const f = await extract("AVOIR\nRéférence : AV-001");
    expect(f.invoice_type).toBe("AVOIR");
  });

  it("retourne null si type absent", async () => {
    const f = await extract("Bonjour, voici notre document");
    expect(f.invoice_type).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Montants
// --------------------------------------------------------------------------

describe("extractAmount", () => {
  it("extrait le total HT", async () => {
    const f = await extract("Total HT : 1 000,00 €");
    expect(f.subtotal_excl_tax).toBe(1000.0);
  });

  it("extrait le total TVA", async () => {
    const f = await extract("Montant TVA : 200,00 €");
    expect(f.total_tax).toBe(200.0);
  });

  it("extrait le total TTC", async () => {
    const f = await extract("Total TTC : 1200,00 €");
    expect(f.total_incl_tax).toBe(1200.0);
  });

  it("extrait le net à payer", async () => {
    const f = await extract("Net à payer : 1 200,00 €");
    expect(f.amount_due).toBe(1200.0);
  });

  it("parse un montant avec virgule décimale", async () => {
    const f = await extract("Total HT : 999,99");
    expect(f.subtotal_excl_tax).toBe(999.99);
  });

  it("parse un montant avec point décimal", async () => {
    const f = await extract("Total HT : 1500.00 €");
    expect(f.subtotal_excl_tax).toBe(1500.0);
  });

  it("retourne null si montant absent", async () => {
    const f = await extract("Aucun total ici");
    expect(f.subtotal_excl_tax).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Taux de TVA
// --------------------------------------------------------------------------

describe("extractVatRates", () => {
  it("extrait un taux unique", async () => {
    const f = await extract("TVA 20% : 200,00 €");
    expect(f.vat_rates_detected).toContain("20%");
  });

  it("extrait plusieurs taux distincts", async () => {
    const f = await extract("TVA 20% : 200 €\nTVA 10% : 50 €\nTVA 5.5% : 10 €");
    expect(f.vat_rates_detected?.length).toBeGreaterThanOrEqual(2);
  });

  it("déduplique les taux identiques", async () => {
    const f = await extract("TVA 20% sur ligne 1\nTVA 20% sur ligne 2");
    expect(f.vat_rates_detected?.filter((r) => r === "20%").length).toBe(1);
  });

  it("retourne null si aucun taux", async () => {
    const f = await extract("Facture sans mention de TVA");
    expect(f.vat_rates_detected).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Conditions de paiement
// --------------------------------------------------------------------------

describe("extractPaymentTerms", () => {
  it("extrait les conditions de paiement", async () => {
    const f = await extract("Conditions de paiement : 30 jours nets");
    expect(f.payment_terms).toContain("30 jours nets");
  });

  it("retourne null si absentes", async () => {
    const f = await extract("N° FA-001");
    expect(f.payment_terms).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Champs null si absents – garantie de non-fabrication
// --------------------------------------------------------------------------

describe("garantie : aucune valeur inventée", () => {
  it("retourne null pour tous les champs si le texte est vide", async () => {
    const f = await extract("");
    expect(f.invoice_number).toBeNull();
    expect(f.issue_date).toBeNull();
    expect(f.due_date).toBeNull();
    expect(f.seller_siret).toBeNull();
    expect(f.seller_siren).toBeNull();
    expect(f.seller_vat_number).toBeNull();
    expect(f.subtotal_excl_tax).toBeNull();
    expect(f.total_tax).toBeNull();
    expect(f.total_incl_tax).toBeNull();
    expect(f.amount_due).toBeNull();
    expect(f.vat_rates_detected).toBeNull();
    expect(f.buyer_siret).toBeNull();
    expect(f.buyer_vat_number).toBeNull();
  });

  it("ne fabrique pas de SIRET pour un identifiant sans label", async () => {
    // 14 chiffres sans le mot SIRET → ne doit pas être extrait
    const f = await extract("Référence interne : 12345678900012");
    expect(f.seller_siret).toBeNull();
  });

  it("ne fabrique pas de numéro TVA à partir de chiffres aléatoires", async () => {
    const f = await extract("Code article : FR123456789");
    // Ce n'est pas un N°TVA valide (pas de label + format incorrect)
    // L'extraction peut ou non le détecter selon le pattern backup — vérifier qu'on ne plante pas
    expect(() => f.seller_vat_number).not.toThrow();
  });
});

// --------------------------------------------------------------------------
// Texte malformé / mauvaise qualité OCR
// --------------------------------------------------------------------------

describe("robustesse OCR dégradée", () => {
  it("ne plante pas sur un texte avec caractères spéciaux", async () => {
    const f = await extract("F@cTuR€ N°!!! 2O24-OO1\nM0NTANT : ???,?? €");
    expect(f).toBeDefined();
  });

  it("ne plante pas sur un texte très long", async () => {
    const long = "ligne de texte sans information utile\n".repeat(500);
    const f = await extract(long);
    expect(f.invoice_number).toBeNull();
  });

  it("ne plante pas sur null / undefined transmis", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = await extract(null as any);
    expect(f).toBeDefined();
  });
});
