import type { OcrProvider } from "./types";
import { PdfParseProvider } from "./pdf-parse-provider";
import { MockOcrProvider } from "./mock-provider";

export { MockOcrProvider } from "./mock-provider";
export { PdfParseProvider } from "./pdf-parse-provider";
export type { OcrProvider, OcrResult } from "./types";

/**
 * Résout le fournisseur OCR actif selon la configuration d'environnement.
 *
 * Ordre de priorité :
 *   1. Azure Form Recognizer — si AZURE_FORM_RECOGNIZER_ENDPOINT + KEY définis
 *   2. pdf-parse             — fournisseur local par défaut (PDFs texte uniquement)
 *
 * En tests, mocker ce module via vi.mock('@/lib/ocr').
 */
export function getOcrProvider(): OcrProvider {
  // Azure Form Recognizer (PDFs scannés + cloud)
  // Stub : implémentation complète à ajouter quand les credentials sont disponibles
  if (
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT &&
    process.env.AZURE_FORM_RECOGNIZER_KEY
  ) {
    // TODO (post-MVP) : return new AzureFormRecognizerProvider();
    // Pour l'instant, on tombe sur pdf-parse même avec les vars Azure définies
    // (la logique Azure sera ajoutée dans un ticket dédié)
    console.warn(
      "[ocr] Vars Azure détectées mais le fournisseur Azure n'est pas encore implémenté. Utilisation de pdf-parse."
    );
  }

  return new PdfParseProvider();
}

/**
 * Fournisseur de développement/test explicite.
 * À utiliser dans les tests via vi.mock ou pour une démo locale rapide.
 */
export function getMockOcrProvider(
  options?: ConstructorParameters<typeof MockOcrProvider>[0]
): OcrProvider {
  return new MockOcrProvider(options);
}
