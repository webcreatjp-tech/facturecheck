import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockDbSingle,
  mockUpdateFn,
  mockExtractFields,
} = vi.hoisted(() => ({
  mockDbSingle: vi.fn(),
  mockUpdateFn: vi.fn(),
  mockExtractFields: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockDbSingle }) }),
      update: (fields: unknown) => {
        mockUpdateFn(fields);
        return { eq: () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/extraction", () => ({
  getExtractionProvider: vi.fn().mockReturnValue({
    name: "mock",
    version: "1.0",
    extractFields: mockExtractFields,
  }),
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const VALID_SECRET = "test-secret-abc";

function makeRequest(body: unknown, secret: string | null = VALID_SECRET): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-internal-secret"] = secret;
  return new Request("http://localhost/api/extraction/process", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const MOCK_UPLOAD = {
  id: "upload-1",
  ocr_status: "processed",
  ocr_text: "FACTURE N° FA-2024-001\nTotal HT : 1000,00 €",
  extraction_status: "pending",
};

const MOCK_EXTRACTION_RESULT = {
  fields: {
    invoice_number: "FA-2024-001",
    issue_date: null,
    due_date: null,
    currency: "EUR",
    invoice_type: "FACTURE",
    seller_name: null,
    seller_address: null,
    seller_siren: null,
    seller_siret: null,
    seller_vat_number: null,
    buyer_name: null,
    buyer_address: null,
    buyer_siren: null,
    buyer_siret: null,
    buyer_vat_number: null,
    subtotal_excl_tax: 1000.0,
    total_tax: null,
    total_incl_tax: null,
    amount_due: null,
    vat_rates_detected: null,
    tax_breakdown_raw: null,
    line_items_raw: null,
    payment_terms: null,
    purchase_order_number: null,
    service_or_delivery_date: null,
  },
  provider: "mock",
  version: "1.0",
  processedAt: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /api/extraction/process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = VALID_SECRET;
    mockDbSingle.mockResolvedValue({ data: MOCK_UPLOAD, error: null });
    mockExtractFields.mockResolvedValue(MOCK_EXTRACTION_RESULT);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("retourne 401 si le secret est absent", async () => {
    const res = await POST(makeRequest({ uploadId: "u1" }, null));
    expect(res.status).toBe(401);
  });

  it("retourne 401 si le secret est incorrect", async () => {
    const res = await POST(makeRequest({ uploadId: "u1" }, "mauvais-secret"));
    expect(res.status).toBe(401);
  });

  it("retourne 401 si INTERNAL_OCR_SECRET n'est pas défini", async () => {
    delete process.env.INTERNAL_OCR_SECRET;
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(401);
  });

  // ── Validation ────────────────────────────────────────────────────────

  it("retourne 400 si uploadId est absent", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("retourne 404 si l'upload n'existe pas", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await POST(makeRequest({ uploadId: "inexistant" }));
    expect(res.status).toBe(404);
  });

  // ── Prérequis OCR ─────────────────────────────────────────────────────

  it("retourne 200 sans extraction si OCR pas encore terminé", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, ocr_status: "pending" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockExtractFields).not.toHaveBeenCalled();
  });

  // ── Idempotence ───────────────────────────────────────────────────────

  it("retourne 200 sans retraitement si extraction_status = 'extracted'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, extraction_status: "extracted" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockExtractFields).not.toHaveBeenCalled();
  });

  it("retourne 200 sans retraitement si extraction_status = 'processing'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, extraction_status: "processing" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockExtractFields).not.toHaveBeenCalled();
  });

  // ── Succès ────────────────────────────────────────────────────────────

  it("traite le texte OCR et retourne { success: true }", async () => {
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.uploadId).toBe("upload-1");
  });

  it("met le statut à 'processing' avant l'extraction", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    const firstUpdateArgs = mockUpdateFn.mock.calls[0]?.[0];
    expect(firstUpdateArgs).toMatchObject({ extraction_status: "processing" });
  });

  it("met le statut à 'extracted' après une extraction réussie", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    const lastUpdateArgs =
      mockUpdateFn.mock.calls[mockUpdateFn.mock.calls.length - 1]?.[0];
    expect(lastUpdateArgs).toMatchObject({
      extraction_status: "extracted",
      extraction_version: "1.0",
    });
    expect(lastUpdateArgs?.extracted_fields).toBeDefined();
  });

  it("appelle extractFields avec le texte OCR", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    expect(mockExtractFields).toHaveBeenCalledOnce();
    const [arg] = mockExtractFields.mock.calls[0];
    expect(typeof arg).toBe("string");
    expect(arg).toContain("FA-2024-001");
  });

  it("passe une chaîne vide à extractFields si ocr_text est null", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, ocr_text: null },
      error: null,
    });
    await POST(makeRequest({ uploadId: "upload-1" }));
    const [arg] = mockExtractFields.mock.calls[0];
    expect(arg).toBe("");
  });

  // ── Échec extraction ──────────────────────────────────────────────────

  it("marque 'failed' et retourne 500 si le provider lève une erreur", async () => {
    mockExtractFields.mockRejectedValue(new Error("Service indisponible"));
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Service indisponible");
    const failedUpdate = mockUpdateFn.mock.calls.find(
      (call) => call[0]?.extraction_status === "failed"
    );
    expect(failedUpdate).toBeDefined();
  });
});
