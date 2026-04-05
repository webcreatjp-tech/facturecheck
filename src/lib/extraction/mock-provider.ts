import type {
  ExtractionProvider,
  ExtractionResult,
  StructuredInvoiceFields,
} from "./types";

// --------------------------------------------------------------------------
// Options
// --------------------------------------------------------------------------

interface MockExtractionOptions {
  /** Si true, extractFields() rejette avec une erreur */
  shouldFail?: boolean;
  /** Message d'erreur personnalisé (nécessite shouldFail: true) */
  errorMessage?: string;
  /** Champs partiels à retourner (les autres restent null) */
  fields?: Partial<StructuredInvoiceFields>;
}

// --------------------------------------------------------------------------
// Données de test par défaut
// --------------------------------------------------------------------------

export const MOCK_DEFAULT_FIELDS: StructuredInvoiceFields = {
  invoice_number:          "FA-2024-001",
  issue_date:              "2024-01-15",
  due_date:                "2024-02-15",
  currency:                "EUR",
  invoice_type:            "FACTURE",
  seller_name:             "ACME SAS",
  seller_address:          "12 rue de la Paix, 75001 Paris",
  seller_siren:            "123456789",
  seller_siret:            "12345678900012",
  seller_vat_number:       "FR12123456789",
  buyer_name:              "Client SA",
  buyer_address:           "1 avenue Victor Hugo, 69001 Lyon",
  buyer_siren:             null,
  buyer_siret:             null,
  buyer_vat_number:        "FR99987654321",
  subtotal_excl_tax:       1000.00,
  total_tax:               200.00,
  total_incl_tax:          1200.00,
  amount_due:              1200.00,
  vat_rates_detected:      ["20%"],
  tax_breakdown_raw:       "TVA 20% : 200,00 €",
  line_items_raw:          "Prestation de conseil : 1 000,00 €",
  payment_terms:           "30 jours nets",
  purchase_order_number:   null,
  service_or_delivery_date: "2024-01-10",
};

// --------------------------------------------------------------------------
// Provider mock
// --------------------------------------------------------------------------

export class MockExtractionProvider implements ExtractionProvider {
  readonly name = "mock";
  readonly version = "1.0";

  private readonly options: MockExtractionOptions;

  constructor(options: MockExtractionOptions = {}) {
    this.options = options;
  }

  async extractFields(_ocrText: string): Promise<ExtractionResult> {
    if (this.options.shouldFail) {
      throw new Error(this.options.errorMessage ?? "Mock extraction failure");
    }

    const fields: StructuredInvoiceFields = {
      ...MOCK_DEFAULT_FIELDS,
      ...this.options.fields,
    };

    return {
      fields,
      provider: this.name,
      version: this.version,
      processedAt: new Date().toISOString(),
    };
  }
}
