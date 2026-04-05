import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockDbSingle,
  mockUpdateFn,
  mockStorageDownload,
  mockExtractText,
} = vi.hoisted(() => ({
  mockDbSingle: vi.fn(),
  mockUpdateFn: vi.fn(),       // reçoit les champs de l'update
  mockStorageDownload: vi.fn(),
  mockExtractText: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    from: () => ({
      // Chaîne SELECT : .select().eq().single()
      select: () => ({ eq: () => ({ single: mockDbSingle }) }),
      // Chaîne UPDATE : .update(fields).eq() → { error }
      update: (fields: unknown) => {
        mockUpdateFn(fields);
        return { eq: () => ({ error: null }) };
      },
    }),
    storage: {
      from: () => ({ download: mockStorageDownload }),
    },
  }),
}));

vi.mock("@/lib/ocr", () => ({
  getOcrProvider: vi.fn().mockReturnValue({
    name: "mock",
    extractText: mockExtractText,
  }),
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const VALID_SECRET = "test-secret-abc";

function makeRequest(body: unknown, secret: string | null = VALID_SECRET): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-internal-secret"] = secret;
  return new Request("http://localhost/api/ocr/process", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const MOCK_UPLOAD = {
  id: "upload-1",
  storage_path: "user-1/123-facture.pdf",
  ocr_status: "pending",
};

const MOCK_OCR_RESULT = {
  text: "Facture test",
  provider: "mock",
  processedAt: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /api/ocr/process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = VALID_SECRET;
    mockDbSingle.mockResolvedValue({ data: MOCK_UPLOAD, error: null });
    mockStorageDownload.mockResolvedValue({
      data: new Blob(["fake pdf content"]),
      error: null,
    });
    mockExtractText.mockResolvedValue(MOCK_OCR_RESULT);
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

  // ── Idempotence ───────────────────────────────────────────────────────

  it("retourne 200 sans retraitement si statut = 'processed'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, ocr_status: "processed" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockExtractText).not.toHaveBeenCalled();
  });

  it("retourne 200 sans retraitement si statut = 'processing'", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...MOCK_UPLOAD, ocr_status: "processing" },
      error: null,
    });
    const res = await POST(makeRequest({ uploadId: "u1" }));
    expect(res.status).toBe(200);
    expect(mockExtractText).not.toHaveBeenCalled();
  });

  // ── Succès ────────────────────────────────────────────────────────────

  it("traite le PDF et retourne { success: true }", async () => {
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.uploadId).toBe("upload-1");
  });

  it("met le statut à 'processing' avant l'extraction", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    // Premier appel à update : { ocr_status: 'processing' }
    const firstUpdateArgs = mockUpdateFn.mock.calls[0]?.[0];
    expect(firstUpdateArgs).toMatchObject({ ocr_status: "processing" });
  });

  it("met le statut à 'processed' après une extraction réussie", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    const lastUpdateArgs =
      mockUpdateFn.mock.calls[mockUpdateFn.mock.calls.length - 1]?.[0];
    expect(lastUpdateArgs).toMatchObject({
      ocr_status: "processed",
      ocr_text: "Facture test",
      ocr_provider: "mock",
    });
  });

  it("appelle extractText avec un Buffer", async () => {
    await POST(makeRequest({ uploadId: "upload-1" }));
    expect(mockExtractText).toHaveBeenCalledOnce();
    const [arg] = mockExtractText.mock.calls[0];
    expect(Buffer.isBuffer(arg)).toBe(true);
  });

  // ── Échec téléchargement ──────────────────────────────────────────────

  it("marque 'failed' si le téléchargement Storage échoue", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "bucket not found" },
    });
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(500);
    expect(mockExtractText).not.toHaveBeenCalled();
    const failedUpdate = mockUpdateFn.mock.calls.find(
      (call) => call[0]?.ocr_status === "failed"
    );
    expect(failedUpdate).toBeDefined();
  });

  // ── Échec OCR ─────────────────────────────────────────────────────────

  it("marque 'failed' et retourne 500 si le provider lève une erreur", async () => {
    mockExtractText.mockRejectedValue(new Error("Quota dépassé"));
    const res = await POST(makeRequest({ uploadId: "upload-1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Quota dépassé");
    const failedUpdate = mockUpdateFn.mock.calls.find(
      (call) => call[0]?.ocr_status === "failed"
    );
    expect(failedUpdate).toBeDefined();
  });
});
