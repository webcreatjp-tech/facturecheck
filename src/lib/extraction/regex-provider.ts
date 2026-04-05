import type {
  ExtractionProvider,
  ExtractionResult,
  StructuredInvoiceFields,
} from "./types";

// --------------------------------------------------------------------------
// Helpers de normalisation
// --------------------------------------------------------------------------

/**
 * Convertit une date française (DD/MM/YYYY ou variantes) en YYYY-MM-DD.
 * Retourne null si la date est invalide ou ambiguë.
 */
function normalizeDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  const day = d.padStart(2, "0");
  const month = mo.padStart(2, "0");
  const isoStr = `${y}-${month}-${day}`;
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return null;
  return isoStr;
}

/**
 * Convertit un montant français (espaces, virgule décimale) en number.
 * Ex : "1 234,56" → 1234.56 ; "1234.56" → 1234.56
 * Retourne null si non parseable.
 */
function normalizeAmount(raw: string): number | null {
  // Retire les espaces (séparateur de milliers)
  const cleaned = raw.replace(/\s/g, "");
  // Normalise la virgule décimale
  const dotted = cleaned.replace(",", ".");
  const n = parseFloat(dotted);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/**
 * Retire les espaces internes d'un identifiant (SIRET, SIREN, TVA).
 */
function normalizeId(raw: string): string {
  return raw.replace(/\s/g, "");
}

// --------------------------------------------------------------------------
// Moteurs d'extraction (privés)
// --------------------------------------------------------------------------

function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    // Numéro après étiquette explicite
    /(?:n[°o]\.?\s*(?:de\s+)?(?:facture|fact)|facture\s+n[°o]\.?|num[eé]ro\s+(?:de\s+)?facture)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_ ]{1,30})/i,
    // Patterns courants : FA-001234, FACT2024001, INV-2024-001
    /\b(FA[-_\s]?\d{4,10})\b/,
    /\b(FACT[-_\s]?\d{4,10})\b/,
    /\b(INV[-_\s]?\d{4,10})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

function extractIssueDateFromText(text: string): string | null {
  const labels = [
    "date\\s+d(?:'|e\\s+)(?:é|e)mission",
    "date\\s+de\\s+facture",
    "date\\s+de\\s+la\\s+facture",
    "date\\s+d(?:'|'\\s*)édition",
    "émise?\\s+le",
    "date\\s+facturation",
    "le\\s+:",
  ];
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*(\\d{1,2}[\\.\\/\\-]\\d{1,2}[\\.\\/\\-]\\d{2,4})`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const d = normalizeDate(m[1]);
      if (d) return d;
    }
  }
  return null;
}

function extractDueDateFromText(text: string): string | null {
  const labels = [
    "(?:date\\s+)?d(?:'|')é?ch[eé]ance",
    "payable\\s+(?:le|avant\\s+le|au\\s+plus\\s+tard\\s+le)",
    "à\\s+payer\\s+(?:avant\\s+le|le)",
    "date\\s+limite\\s+de\\s+paiement",
    "due\\s+date",
  ];
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*(\\d{1,2}[\\.\\/\\-]\\d{1,2}[\\.\\/\\-]\\d{2,4})`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const d = normalizeDate(m[1]);
      if (d) return d;
    }
  }
  return null;
}

function extractCurrency(text: string): string | null {
  if (/\bEUR\b/.test(text) || /€/.test(text)) return "EUR";
  if (/\bUSD\b/.test(text) || /\$/.test(text)) return "USD";
  if (/\bGBP\b/.test(text) || /£/.test(text)) return "GBP";
  return null;
}

function extractInvoiceType(text: string): string | null {
  // Cherche le type dans les premières 400 caractères (en-tête)
  const header = text.slice(0, 400).toUpperCase();
  if (/\bAVOIR\b/.test(header)) return "AVOIR";
  if (/\bPROFORMA\b/.test(header)) return "PROFORMA";
  if (/\bDEVIS\b/.test(header)) return "DEVIS";
  if (/\bFACTURE\b/.test(header)) return "FACTURE";
  return null;
}

function extractSiret(text: string): string | null {
  // SIRET = 14 chiffres, souvent formaté par groupes (3+3+3+5)
  const m = text.match(
    /\bSIRET\s*[:\-]?\s*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5})\b/i
  );
  if (!m?.[1]) return null;
  const cleaned = normalizeId(m[1]);
  return cleaned.length === 14 ? cleaned : null;
}

function extractSiren(text: string, siret: string | null): string | null {
  // Si un SIRET est connu, le SIREN en est les 9 premiers chiffres
  if (siret && siret.length === 14) return siret.slice(0, 9);

  const m = text.match(
    /\bSIREN\s*[:\-]?\s*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3})\b/i
  );
  if (!m?.[1]) return null;
  const cleaned = normalizeId(m[1]);
  return cleaned.length === 9 ? cleaned : null;
}

function extractVatNumber(text: string): string | null {
  // Format français : FR + 2 chiffres/lettres + 9 chiffres
  const labeled = text.match(
    /(?:n[°o]?\s*TVA|TVA\s+intrac(?:o|ô)mmunautaire|numéro\s+TVA|VAT\s+(?:number|n[°o]?))\s*[:\-]?\s*([A-Z]{2}[\s\-]?[A-Z0-9]{2}[\s]?\d{9})/i
  );
  if (labeled?.[1]) return normalizeId(labeled[1]).toUpperCase();

  // Backup : séquence FR## ### ### ### en clair
  const raw = text.match(/\bFR[\s\-]?[A-Z0-9]{2}[\s]?\d{9}\b/i);
  if (raw?.[0]) return normalizeId(raw[0]).toUpperCase();

  return null;
}

function extractAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*([\\d\\s]+[,\\.]\\d{2})\\s*(?:€|EUR)?`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const n = normalizeAmount(m[1]);
      if (n !== null) return n;
    }
  }
  return null;
}

function extractVatRates(text: string): string[] | null {
  const matches = [...text.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*%/g)];
  if (matches.length === 0) return null;
  const unique = [...new Set(matches.map((m) => `${m[1].replace(",", ".")}%`))];
  return unique.length > 0 ? unique : null;
}

function extractTaxBreakdownRaw(text: string): string | null {
  // Cherche les lignes contenant TVA ou taux en %
  const lines = text.split("\n").filter((l) => /tva|\d+\s*%/i.test(l));
  return lines.length > 0 ? lines.slice(0, 6).join("\n").trim() : null;
}

function extractPaymentTerms(text: string): string | null {
  const m = text.match(
    /(?:conditions?\s+de\s+paiement|modalités?\s+de\s+paiement|règlement)\s*[:\-]?\s*([^\n]{5,80})/i
  );
  return m?.[1]?.trim() ?? null;
}

function extractPurchaseOrderNumber(text: string): string | null {
  const m = text.match(
    /(?:bon\s+de\s+commande|n[°o]?\s+(?:de\s+)?commande|purchase\s+order|PO\s+n[°o]?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_ ]{1,30})/i
  );
  return m?.[1]?.trim() ?? null;
}

function extractServiceOrDeliveryDate(text: string): string | null {
  const labels = [
    "date\\s+(?:de\\s+)?(?:prestation|livraison|réalisation|service)",
    "prestation\\s+(?:réalisée?|effectuée?)\\s+le",
  ];
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*(\\d{1,2}[\\.\\/\\-]\\d{1,2}[\\.\\/\\-]\\d{2,4})`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const d = normalizeDate(m[1]);
      if (d) return d;
    }
  }
  return null;
}

/**
 * Extrait les lignes de détail (articles / prestations).
 * Retourne les lignes plausibles brutes sous forme de texte.
 */
function extractLineItemsRaw(text: string): string | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inItems = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Début probable : ligne "Désignation", "Description", "Prestation"…
    if (/^(?:désignation|description|prestation|article|ref\.?|libellé)/i.test(trimmed)) {
      inItems = true;
      continue;
    }
    // Fin probable : ligne de total ou TVA
    if (/^(?:total|sous-total|tva|net\s+à\s+payer|montant)/i.test(trimmed) && inItems) {
      break;
    }
    if (inItems && trimmed.length > 3) {
      collected.push(trimmed);
      if (collected.length >= 20) break; // limite raisonnable
    }
  }
  return collected.length > 0 ? collected.join("\n") : null;
}

// --------------------------------------------------------------------------
// Fournisseur regex
// --------------------------------------------------------------------------

export class RegexExtractionProvider implements ExtractionProvider {
  readonly name = "regex";
  readonly version = "1.0";

  async extractFields(ocrText: string): Promise<ExtractionResult> {
    const text = ocrText ?? "";

    const siret = extractSiret(text);
    const siren = extractSiren(text, siret);

    const fields: StructuredInvoiceFields = {
      // Métadonnées
      invoice_number:    extractInvoiceNumber(text),
      issue_date:        extractIssueDateFromText(text),
      due_date:          extractDueDateFromText(text),
      currency:          extractCurrency(text),
      invoice_type:      extractInvoiceType(text),

      // Émetteur
      seller_name:       null, // extraction positionnelle trop risquée sans structure
      seller_address:    null,
      seller_siren:      siren,
      seller_siret:      siret,
      seller_vat_number: extractVatNumber(text),

      // Destinataire
      buyer_name:        null,
      buyer_address:     null,
      buyer_siren:       null,
      buyer_siret:       null,
      buyer_vat_number:  null,

      // Montants
      subtotal_excl_tax: extractAmount(text, [
        "total\\s+HT",
        "sous-total\\s+HT",
        "montant\\s+HT",
        "base\\s+HT",
      ]),
      total_tax: extractAmount(text, [
        "montant\\s+(?:de\\s+la\\s+)?TVA",
        "total\\s+TVA",
        "TVA\\s+\\d",
      ]),
      total_incl_tax: extractAmount(text, [
        "total\\s+TTC",
        "total\\s+général",
        "montant\\s+TTC",
        "total\\s+à\\s+payer\\s+TTC",
      ]),
      amount_due: extractAmount(text, [
        "net\\s+à\\s+payer",
        "solde\\s+à\\s+payer",
        "montant\\s+dû",
        "reste\\s+à\\s+payer",
      ]),

      // TVA
      vat_rates_detected: extractVatRates(text),
      tax_breakdown_raw:  extractTaxBreakdownRaw(text),

      // Détails commerciaux
      line_items_raw:         extractLineItemsRaw(text),
      payment_terms:          extractPaymentTerms(text),
      purchase_order_number:  extractPurchaseOrderNumber(text),
      service_or_delivery_date: extractServiceOrDeliveryDate(text),
    };

    return {
      fields,
      provider: this.name,
      version: this.version,
      processedAt: new Date().toISOString(),
    };
  }
}
