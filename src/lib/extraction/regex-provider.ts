import type {
  ExtractionProvider,
  ExtractionResult,
  StructuredInvoiceFields,
} from "./types";

// --------------------------------------------------------------------------
// Tables de correspondance
// --------------------------------------------------------------------------

const MONTHS_FR: Record<string, string> = {
  janvier: "01", fevrier: "02", février: "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", aout: "08", août: "08",
  septembre: "09", octobre: "10", novembre: "11", decembre: "12", décembre: "12",
};

// --------------------------------------------------------------------------
// Helpers de normalisation
// --------------------------------------------------------------------------

/** DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY → YYYY-MM-DD */
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

/** "02 Mars 2026" → "2026-03-02" */
function normalizeDateFr(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([a-zéàùèêëîïôûü]+)\s+(\d{4})$/i);
  if (m) {
    const key = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const month = MONTHS_FR[key] ?? MONTHS_FR[m[2].toLowerCase()];
    if (month) {
      const iso = `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
    }
  }
  return normalizeDate(raw);
}

/** "1 234,56" ou "1234.56" → 1234.56 */
function normalizeAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "");
  const dotted = cleaned.replace(",", ".");
  const n = parseFloat(dotted);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** Retire les espaces internes d'un identifiant */
function normalizeId(raw: string): string {
  return raw.replace(/\s/g, "");
}

// --------------------------------------------------------------------------
// Numéro de facture
// --------------------------------------------------------------------------

function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    // "n°1450998816 du..." ou "Facture n°1234"
    /(?:facture\s+)?n[°o]\.?\s*(\d[\d\-\/]{1,20})/i,
    // Étiquette explicite : "N° de facture : FA-001"
    /(?:n[°o]\.?\s*(?:de\s+)?(?:facture|fact)|facture\s+n[°o]\.?|num[eé]ro\s+(?:de\s+)?facture)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_ ]{1,30})/i,
    // Formats courants
    /\b(FA[-_]?\d{4,10})\b/,
    /\b(FACT\d{4,10})\b/,
    /\b(INV[-_]?\d{4,10})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

// --------------------------------------------------------------------------
// Dates
// --------------------------------------------------------------------------

function extractIssueDateFromText(text: string): string | null {
  // Labels classiques avec date numérique
  const numericLabels = [
    "date\\s+d(?:'|e\\s+)(?:é|e)mission",
    "date\\s+de\\s+facture",
    "date\\s+de\\s+la\\s+facture",
    "date\\s+d(?:'|'\\s*)édition",
    "émise?\\s+le",
    "date\\s+facturation",
    "le\\s+:",
  ];
  for (const label of numericLabels) {
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

  // "du DD Mois YYYY" dans "n°xxxx du 02 Mars 2026"
  const frMonth = text.match(
    /\bdu\s+(\d{1,2}\s+[a-záàâéèêëîïôùûü]+\s+\d{4})\b/i
  );
  if (frMonth?.[1]) {
    const d = normalizeDateFr(frMonth[1]);
    if (d) return d;
  }

  return null;
}

function extractDueDateFromText(text: string): string | null {
  // "Somme à payer le DD Mois YYYY" (Free, SFR…)
  const frPay = text.match(
    /(?:somme\s+à\s+payer|à\s+payer)\s+le\s+(\d{1,2}\s+[a-záàâéèêëîïôùûü]+\s+\d{4})/i
  );
  if (frPay?.[1]) {
    const d = normalizeDateFr(frPay[1]);
    if (d) return d;
  }

  // Labels classiques avec date numérique
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

// --------------------------------------------------------------------------
// Devise et type
// --------------------------------------------------------------------------

function extractCurrency(text: string): string | null {
  if (/\bEUR\b/.test(text) || /€/.test(text)) return "EUR";
  if (/\bUSD\b/.test(text) || /\$/.test(text)) return "USD";
  if (/\bGBP\b/.test(text) || /£/.test(text)) return "GBP";
  return null;
}

function extractInvoiceType(text: string): string | null {
  const header = text.slice(0, 400).toUpperCase();
  if (/\bAVOIR\b/.test(header)) return "AVOIR";
  if (/\bPROFORMA\b/.test(header)) return "PROFORMA";
  if (/\bDEVIS\b/.test(header)) return "DEVIS";
  if (/\bFACTURE\b/.test(header)) return "FACTURE";
  return null;
}

// --------------------------------------------------------------------------
// Identifiants émetteur
// --------------------------------------------------------------------------

function extractSiret(text: string): string | null {
  const m = text.match(
    /\bSIRET\s*[:\-]?\s*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5})\b/i
  );
  if (!m?.[1]) return null;
  const cleaned = normalizeId(m[1]);
  return cleaned.length === 14 ? cleaned : null;
}

function extractSiren(text: string, siret: string | null): string | null {
  if (siret && siret.length === 14) return siret.slice(0, 9);

  // Label SIREN explicite
  const labeled = text.match(
    /\bSIREN\s*[:\-]?\s*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3})\b/i
  );
  if (labeled?.[1]) {
    const cleaned = normalizeId(labeled[1]);
    if (cleaned.length === 9) return cleaned;
  }

  // Mention RCS : "B 421 938 861 RCS Paris" → SIREN = 421938861
  const rcs = text.match(/\b[AB]?\s*(\d{3}[\s\.]?\d{3}[\s\.]?\d{3})\s+RCS\b/i);
  if (rcs?.[1]) {
    const cleaned = normalizeId(rcs[1]);
    if (cleaned.length === 9) return cleaned;
  }

  return null;
}

function extractVatNumber(text: string): string | null {
  // Label explicite TVA intracommunautaire
  const labeled = text.match(
    /(?:n[°o]?\s*(?:de\s+)?TVA|TVA\s+intra(?:c|communautaire)?|numéro\s+TVA|VAT\s+(?:number|n[°o]?))\s*[:\-]?\s*([A-Z]{2}[\s\d]{9,15})/i
  );
  if (labeled?.[1]) {
    const raw = normalizeId(labeled[1]).toUpperCase();
    // Valider format FR + 11 chars
    if (/^[A-Z]{2}[A-Z0-9]{2}\d{9}$/.test(raw)) return raw;
    // Fallback : retourner tel quel si commence par 2 lettres
    if (/^[A-Z]{2}/.test(raw) && raw.length >= 10) return raw;
  }

  // Standalone : FR suivi de 11 caractères (peut contenir des espaces)
  const raw = text.match(/\bFR[\s\-]?[A-Z0-9]{2}[\s]?\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{2}\b/i);
  if (raw?.[0]) return normalizeId(raw[0]).toUpperCase();

  // Backup court : FR## + 9 chiffres contigus
  const short = text.match(/\bFR[\s\-]?[A-Z0-9]{2}[\s]?\d{9}\b/i);
  if (short?.[0]) return normalizeId(short[0]).toUpperCase();

  return null;
}

// --------------------------------------------------------------------------
// Nom et adresse émetteur
// --------------------------------------------------------------------------

function extractSellerName(text: string): string | null {
  // "Free SAS", "Dupont SARL", etc.
  const legalForms = "(?:SAS|SASU|SARL|SA|SNC|EURL|GIE|SCS|SE|SCOP|EI|EIRL)";
  const m = text.match(
    new RegExp(`([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ0-9\\s\\-\\.&]{1,40}?)\\s+${legalForms}\\b`, "i")
  );
  if (m?.[1]) {
    const name = m[1].trim();
    // Éviter les lignes parasites trop courtes ou trop génériques
    if (name.length >= 2 && !/^(?:total|montant|date|facture|service)$/i.test(name)) {
      return `${name} ${m[0].match(new RegExp(legalForms, "i"))?.[0] ?? ""}`.trim();
    }
  }
  return null;
}

function extractSellerAddress(text: string): string | null {
  // Adresse après mention RCS dans les CGV/pied de page
  // Ex : "B 421 938 861 RCS Paris - 8 rue de la Ville l'Evêque 75008 Paris"
  const rcsLine = text.match(
    /RCS\s+\w+\s*[-–]\s*([^\n-]{5,80}\d{5}[^\n-]{0,30})/i
  );
  if (rcsLine?.[1]) return rcsLine[1].trim().replace(/\s+/g, " ");

  // Pattern générique : numéro + rue/avenue/boulevard + CP + ville
  const street = text.match(
    /(\d{1,4}\s*,?\s*(?:rue|avenue|av\.|boulevard|bd\.|allée|impasse|chemin|place|square)[^,\n]{5,60}\d{5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-]{2,30})/i
  );
  if (street?.[1]) return street[1].trim().replace(/\s+/g, " ");

  return null;
}

// --------------------------------------------------------------------------
// Nom et adresse destinataire
// --------------------------------------------------------------------------

function extractBuyerName(text: string): string | null {
  // Cherche un nom en capitales dans les premières lignes (avant les données techniques)
  // Format : "DUPONT JEAN-PIERRE" ou "SOCIÉTÉ EXEMPLE SARL"
  const lines = text.split("\n").slice(0, 15);
  for (const line of lines) {
    const trimmed = line.trim();
    // Ligne en majuscules de 5 à 60 chars, sans chiffres dominants ni @
    if (
      trimmed.length >= 5 &&
      trimmed.length <= 60 &&
      /^[A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-\.]{4,}$/.test(trimmed) &&
      !/@/.test(trimmed) &&
      !/^\d/.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return null;
}

function extractBuyerAddress(text: string): string | null {
  // Cherche un bloc adresse (numéro + rue en majuscules + CP + ville) dans les 20 premières lignes
  const lines = text.split("\n").slice(0, 20);
  const streetLine = lines.findIndex((l) =>
    /^\d{1,4}\s+[A-ZÀ-Ÿ\s\-]{5,}$/.test(l.trim())
  );
  if (streetLine >= 0) {
    const street = lines[streetLine].trim();
    // Cherche le CP+ville sur la ligne précédente ou suivante
    const cpCandidate = [lines[streetLine - 1], lines[streetLine + 1]];
    for (const cand of cpCandidate) {
      if (cand && /^\d{5}\s+[A-ZÀ-Ÿ]/.test(cand.trim())) {
        return `${street}, ${cand.trim()}`.replace(/\s+/g, " ");
      }
    }
    return street;
  }
  return null;
}

// --------------------------------------------------------------------------
// Montants
// --------------------------------------------------------------------------

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

function extractSubtotalExclTax(text: string): number | null {
  // Pattern standard
  const standard = extractAmount(text, [
    "total\\s+HT",
    "sous-total\\s+HT",
    "montant\\s+HT",
    "base\\s+HT",
    "total\\s+hors\\s+taxes",
  ]);
  if (standard !== null) return standard;

  // Format télécom : "Total64,02€76,77€" (premier montant = HT, second = TTC)
  // Ou "Total HT TTC" en colonnes → ligne "Total X,XX€ Y,YY€"
  const telecom = text.match(
    /\bTotal\s*([\d]+[,\.]\d{2})\s*€\s*[\d]+[,\.]\d{2}\s*€/i
  );
  if (telecom?.[1]) {
    const n = normalizeAmount(telecom[1]);
    if (n !== null) return n;
  }

  return null;
}

function extractTotalTax(text: string): number | null {
  // "Dont TVA 20% : 12,75€" (Free, Bouygues, SFR…)
  const dont = text.match(
    /Dont\s*TVA\s+\d+[\s,\.]*%\s*[:\-]?\s*([\d]+[,\.]\d{2})\s*€/i
  );
  if (dont?.[1]) {
    const n = normalizeAmount(dont[1]);
    if (n !== null) return n;
  }

  // "TVA 20% : 12,75€"
  const tvaRate = text.match(
    /\bTVA\s+\d+\s*%\s*[:\-]\s*([\d\s]+[,\.]\d{2})\s*(?:€|EUR)?/i
  );
  if (tvaRate?.[1]) {
    const n = normalizeAmount(tvaRate[1]);
    if (n !== null) return n;
  }

  return extractAmount(text, [
    "montant\\s+(?:de\\s+la\\s+)?TVA",
    "total\\s+TVA",
  ]);
}

function extractTotalInclTax(text: string): number | null {
  // "Somme à payer le 04 Mars 202676,77€"
  // L'année (ex: 2026) est collée à l'amount (76,77€) → "202676,77€"
  // \b avant \d{4} force le match sur la frontière de mot (espace avant 2026)
  const sommeGlued = text.match(
    /Somme\s+à\s+payer[^\n]*\b\d{4}(\d{1,6}[,\.]\d{2})\s*€/i
  );
  if (sommeGlued?.[1]) {
    const n = normalizeAmount(sommeGlued[1]);
    if (n !== null) return n;
  }

  // "Somme à payer ... 76,77€" (avec espace avant le montant)
  const sommeSpaced = text.match(
    /Somme\s+à\s+payer[^\n]*\s(\d{1,8}[,\.]\d{2})\s*€/i
  );
  if (sommeSpaced?.[1]) {
    const n = normalizeAmount(sommeSpaced[1]);
    if (n !== null) return n;
  }

  // "Total64,02€76,77€" → second montant = TTC
  const totalTtc = text.match(
    /\bTotal\s*[\d,\.]+\s*€\s*([\d,\.]+)\s*€/i
  );
  if (totalTtc?.[1]) {
    const n = normalizeAmount(totalTtc[1]);
    if (n !== null) return n;
  }

  // Patterns standards
  return extractAmount(text, [
    "total\\s+TTC",
    "total\\s+général",
    "montant\\s+TTC",
    "total\\s+à\\s+payer\\s+TTC",
    "net\\s+à\\s+payer\\s+TTC",
  ]);
}

function extractAmountDue(text: string): number | null {
  return extractAmount(text, [
    "net\\s+à\\s+payer",
    "solde\\s+à\\s+payer",
    "montant\\s+dû",
    "reste\\s+à\\s+payer",
  ]);
}

// --------------------------------------------------------------------------
// TVA et divers
// --------------------------------------------------------------------------

function extractVatRates(text: string): string[] | null {
  const matches = [...text.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*%/g)];
  if (matches.length === 0) return null;
  const unique = [...new Set(matches.map((m) => `${m[1].replace(",", ".")}%`))];
  return unique.length > 0 ? unique : null;
}

function extractTaxBreakdownRaw(text: string): string | null {
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

function extractLineItemsRaw(text: string): string | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inItems = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Déclencheurs de section : en-têtes de tableau ou sections de détail
    if (
      /^(?:désignation|description|prestation|article|ref\.?|libellé)/i.test(trimmed) ||
      /^(?:Abonnements?,\s+forfaits|Services\s+de\s+(?:Free|tiers|l'opérateur))/i.test(trimmed)
    ) {
      inItems = true;
      continue;
    }

    // Fin de section
    if (/^(?:total\b|sous-total\b|tva\b|net\s+à\s+payer|montant\s+(?:prélevé|ttc)|somme\s+à\s+payer)/i.test(trimmed) && inItems) {
      break;
    }

    if (inItems && trimmed.length > 3) {
      collected.push(trimmed);
      if (collected.length >= 30) break;
    }
  }

  // Fallback : lignes contenant un prix en € (au moins 5 lignes)
  if (collected.length === 0) {
    const priced = lines
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && /\d+[,\.]\d{2}\s*€/.test(l))
      .slice(0, 20);
    if (priced.length >= 2) return priced.join("\n");
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
      seller_name:       extractSellerName(text),
      seller_address:    extractSellerAddress(text),
      seller_siren:      siren,
      seller_siret:      siret,
      seller_vat_number: extractVatNumber(text),

      // Destinataire
      buyer_name:        extractBuyerName(text),
      buyer_address:     extractBuyerAddress(text),
      buyer_siren:       null,
      buyer_siret:       null,
      buyer_vat_number:  null,

      // Montants
      subtotal_excl_tax: extractSubtotalExclTax(text),
      total_tax:         extractTotalTax(text),
      total_incl_tax:    extractTotalInclTax(text),
      amount_due:        extractAmountDue(text),

      // TVA
      vat_rates_detected: extractVatRates(text),
      tax_breakdown_raw:  extractTaxBreakdownRaw(text),

      // Détails commerciaux
      line_items_raw:          extractLineItemsRaw(text),
      payment_terms:           extractPaymentTerms(text),
      purchase_order_number:   extractPurchaseOrderNumber(text),
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
