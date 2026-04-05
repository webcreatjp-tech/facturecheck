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
    // Import dynamique pour éviter les problèmes de bundling en Edge
    const pdfParse = (await import("pdf-parse")).default;

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
