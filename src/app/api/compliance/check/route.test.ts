import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockDbSingle,
  mockUpdateFn,
  mockUpsertFn,
} = vi.hoisted(() => ({
  mockDbSingle: vi.fn(),
  mockUpdateFn: vi.fn(),
  mockUpsertFn: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    from: (table: string) => {
      if (table === "compliance_results") {
        return {
          // mockUpsertFn controls both call capture and return value
          upsert: (data: unknown) => mockUpsertFn(data),
        };
      }
      return {
        select: () => ({ eq: () => ({ single: mockDbSingle }) }),
        update: (fields: unknown) => {
          mockUpdateFn(fields);
          return { eq: () => ({ error: null }) };
        },
      };
    },
  }),
}));

// Moteur de conformité : mock partiel pour contrôler les résultats
vi.mock("@/lib/compliance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/compliance")>();
  return {
    ...actual,
    // On réutilise le vrai moteur — les résultats sont déterministes
  };
});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const VALID_SECRET = "test-secret-abc";

function makeRequest(body: unknown, secret: string | null = VALID_SECRET): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-internal-secret"] = secret;
  return new Request("http://localhost/api/compliance/check", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const MOCK_UPLOAD_EXTRACTED = {
  id: "upload-1",
  user_id: "user-abc",
  extraction_status: "extracted",
  extracted_fields: {
    invoice_number: "FA-2024-001",
    issue_date: "2024-01-15",
    due_date: "2024-02-15",
    currency: "EUR",
    invoice_type: "FACTURE",
    seller_name: "ACME SAS",
    seller_address: "12 rue de la Paix",
    seller_siren: "123456789",
    seller_siret: "12345678900012",
    seller_vat_number: "FR12123456789",
    buyer_name: "Client SA",
    buyer_address: "1 av. Victor Hugo",
    buyer_siren: null,
    buyer_siret: null,
    buyer_vat_number: null,
    subtotal_excl_tax: 1000,
    total_tax: 200,
    total_incl_tax: 1200,
    amount_due: 1200,
    vat_rates_detected: ["20%"],
    tax_breakdown_raw: null,
    line_items_raw: "Prestation de conseil",
    payment_terms: "30 jours nets",
    purchase_order_number: null,
    service_or_delivery_date: null,
  },
  compliance_status: "pending",
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /api/compliance/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = VALID_SECRET;
    mockDbSingle.mockResolvedValue({ data: MOCK_UPLOAD_EXTRACTED, error: null });
    // mockUpsertFn returns the upsert result AND allows call inspection
    mockUpsertFn.mockResolvedValue({ error: null });
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

  // ── Prérequis extraction ──────────────────────────────────────────────

  it("retourne 200 sans vérification si extraction non terminée", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD_EXTRACTED, extraction_status: "pending" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockUpsertFn).not.toHaveBeenCalled();
  });

  // ── Idempotence ───────────────────────────────────────────────────────

  it("retourne 200 sans retraitement si compliance_status = 'checked'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD_EXTRACTED, compliance_status: "checked" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockUpsertFn).not.toHaveBeenCalled();
  });

  it("retourne 200 sans retraitement si compliance_status = 'processing'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD_EXTRACTED, compliance_status: "processing" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockUpsertFn).not.toHaveBeenCalled();
  });

  // ── Succès ────────────────────────────────────────────────────────────

  it("vérifie la conformité et retourne { success: true }", async () => {
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.uploadId).toBe("upload-1");
    expect(typeof body.score).toBe("number");
    expect(body.band).toBeTruthy();
  });

  it("met le statut à 'processing' avant la vérification", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    const firstUpdateArgs = mockUpdateFn.mock.calls[0]?.[0];
    expect(firstUpdateArgs).toMatchObject({ compliance_status: "processing" });
  });

  it("upsert dans compliance_results avec les données du rapport", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    expect(mockUpsertFn).toHaveBeenCalledOnce();
    const upsertData = mockUpsertFn.mock.calls[0]?.[0];
    expect(upsertData).toMatchObject({
      upload_id: "upload-1",
      user_id: "user-abc",
      rules_version: expect.any(String),
    });
    expect(typeof upsertData.score).toBe("number");
    expect(Array.isArray(upsertData.blocking_errors)).toBe(true);
    expect(Array.isArray(upsertData.warnings)).toBe(true);
    expect(Array.isArray(upsertData.suggestions)).toBe(true);
  });

  it("met le statut à 'checked' après succès avec score et bande", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    const lastUpdateArgs =
      mockUpdateFn.mock.calls[mockUpdateFn.mock.calls.length - 1]?.[0];
    expect(lastUpdateArgs).toMatchObject({
      compliance_status: "checked",
      compliance_score: expect.any(Number),
      compliance_band: expect.any(String),
    });
  });

  it("passe des extracted_fields null au moteur (résultat déterministe)", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD_EXTRACTED, extracted_fields: null },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(0); // Tous les champs manquants → score 0
  });

  // ── Échec upsert ──────────────────────────────────────────────────────

  it("marque 'failed' et retourne 500 si l'upsert DB échoue", async () => {
    mockUpsertFn.mockResolvedValue({ error: { message: "db error" } });
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(500);
    const failedUpdate = mockUpdateFn.mock.calls.find(
      (call) => call[0]?.compliance_status === "failed"
    );
    expect(failedUpdate).toBeDefined();
  });
});
