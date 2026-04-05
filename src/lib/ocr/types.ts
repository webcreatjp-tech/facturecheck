// --------------------------------------------------------------------------
// Contrat du fournisseur OCR
// Toute implémentation concrète doit respecter cette interface.
// T005 (analyse de conformité) consommera OcrResult.text.
// --------------------------------------------------------------------------

export interface OcrResult {
  /** Texte brut extrait du PDF. Peut être vide pour les PDFs scannés sans OCR cloud. */
  text: string;
  /** Identifiant lisible du fournisseur, ex. "pdf-parse" | "azure-form-recognizer" | "mock" */
  provider: string;
  /** ISO 8601 – horodatage de fin de traitement */
  processedAt: string;
}

export interface OcrProvider {
  /** Identifiant unique du fournisseur (correspond à OcrResult.provider) */
  readonly name: string;
  /**
   * Extrait le texte d'un buffer PDF.
   * @throws Error si l'extraction échoue (le pipeline marquera le job en "failed")
   */
  extractText(pdfBuffer: Buffer): Promise<OcrResult>;
}
