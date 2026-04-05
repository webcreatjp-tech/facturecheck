import type { ExtractionProvider } from "./types";
import { RegexExtractionProvider } from "./regex-provider";
import { MockExtractionProvider } from "./mock-provider";

export type { ExtractionProvider, ExtractionResult, StructuredInvoiceFields } from "./types";

/**
 * Retourne le fournisseur d'extraction actif.
 *
 * Stratégie de sélection :
 *   1. Regex (défaut) — déterministe, sans dépendance externe
 *
 * Extensibilité : ajouter d'autres fournisseurs ici (LLM, service tiers…)
 * en vérifiant leurs variables d'environnement avant le fallback.
 */
export function getExtractionProvider(): ExtractionProvider {
  return new RegexExtractionProvider();
}

/**
 * Retourne le fournisseur mock (tests uniquement).
 */
export function getMockExtractionProvider(
  options?: ConstructorParameters<typeof MockExtractionProvider>[0]
): ExtractionProvider {
  return new MockExtractionProvider(options);
}
