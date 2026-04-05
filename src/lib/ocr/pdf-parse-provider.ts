import type { OcrProvider, OcrResult } from "./types";

/**
 * Fournisseur OCR basé sur pdf-parse (extraction de texte intégrée).
 *
 * Avantages :
 *   - Gratuit, sans appel réseau
 *   - Fonctionne parfaitement pour les PDFs générés numériquement
 *
 * Limitations :
 *   - Ne peut pas extraire le texte des PDFs scannés (images)
 *   - Pour les scans, utiliser AzureFormRecognizerProvider (T004+)
 *
 * Runtime : Node.js uniquement (ne fonctionne pas en Edge runtime)
 */
export class PdfParseProvider implements OcrProvider {
  readonly name = "pdf-parse";

  async extractText(pdfBuffer: Buffer): Promise<OcrResult> {
    // pdf-parse est un module CJS — utiliser require() est plus fiable que import()
    // car certains bundlers enveloppent le module.exports dans { default: ... }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (
      buf: Buffer,
      opts?: { max?: number }
    ) => Promise<{ text?: string }>;

    const data = await pdfParse(pdfBuffer, {
      // Désactive le chargement des tests internes de pdf-parse
      max: 0,
    });

    const text = (data.text ?? "").trim();

    return {
      text,
      provider: this.name,
      processedAt: new Date().toISOString(),
    };
  }
}
