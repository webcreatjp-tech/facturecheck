import type { OcrProvider, OcrResult } from "./types";

/**
 * Fournisseur OCR fictif pour les tests et le développement local.
 * Retourne un texte générique sans appel réseau.
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = "mock";

  constructor(
    private readonly options: {
      /** Texte à retourner (par défaut : texte de facture générique) */
      text?: string;
      /** Si true, lève une erreur au lieu de retourner un résultat */
      shouldFail?: boolean;
      /** Message d'erreur personnalisé si shouldFail = true */
      errorMessage?: string;
    } = {}
  ) {}

  async extractText(_pdfBuffer: Buffer): Promise<OcrResult> {
    if (this.options.shouldFail) {
      throw new Error(
        this.options.errorMessage ?? "Mock OCR failure"
      );
    }

    return {
      text:
        this.options.text ??
        [
          "FACTURE N° 2026-001",
          "Date : 01/01/2026",
          "Vendeur : Société Example SAS",
          "SIRET : 123 456 789 00012",
          "N° TVA intracommunautaire : FR 12 345678901",
          "",
          "Acheteur : Client Test SARL",
          "SIRET : 987 654 321 00098",
          "",
          "Désignation : Prestation de conseil",
          "Quantité : 1 | Prix unitaire HT : 1 000,00 € | TVA 20% : 200,00 €",
          "Total TTC : 1 200,00 €",
          "",
          "Conditions de paiement : 30 jours net",
          "Mode de règlement : Virement bancaire",
          "IBAN : FR76 0000 0000 0000 0000 0000 000",
        ].join("\n"),
      provider: this.name,
      processedAt: new Date().toISOString(),
    };
  }
}
