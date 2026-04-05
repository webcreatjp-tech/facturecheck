import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryCompliance, getComplianceResult } from "./compliance";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockGetUser,
  mockDbSingle,
  mockUpdateFn,
  mockUpdateEqResult,
  mockFetch,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDbSingle: vi.fn(),
  mockUpdateFn: vi.fn(),
  mockUpdateEqResult: vi.fn(),
  mockFetch: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => mockRevalidatePath() }));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseSessionClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockDbSingle,
          eq: () => ({ single: mockDbSingle }),
        }),
      }),
      update: (fields: unknown) => {
        mockUpdateFn(fields);
        return { eq: mockUpdateEqResult };
      },
    }),
  }),
}));

vi.stubGlobal("fetch", mockFetch);

// --------------------------------------------------------------------------
// Données
// --------------------------------------------------------------------------

const USER = { id: "user-abc" };

const UPLOAD_EXTRACTED_FAILED = {
  id: "upload-1",
  user_id: "user-abc",
  extraction_status: "extracted",
  compliance_status: "failed",
};

const UPLOAD_NOT_EXTRACTED = {
  id: "upload-2",
  user_id: "user-abc",
  extraction_status: "pending",
  compliance_status: null,
};

const COMPLIANCE_RECORD = {
  id: "result-1",
  upload_id: "upload-1",
  user_id: "user-abc",
  score: 85,
  band: "attention",
  blocking_errors: [],
  warnings: [],
  suggestions: [],
  rules_version: "1.0",
  checked_at: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// retryCompliance
// --------------------------------------------------------------------------

describe("retryCompliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = "secret-test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockDbSingle.mockResolvedValue({ data: UPLOAD_EXTRACTED_FAILED, error: null });
    mockUpdateEqResult.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("retourne unauthenticated si l'utilisateur n'est pas connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await retryCompliance("upload-1");
    expect(result).toEqual({ success: false, code: "unauthenticated" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("retourne not_found si l'upload n'existe pas", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "nf" } });
    const result = await retryCompliance("upload-xyz");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne not_found si l'upload appartient à un autre utilisateur", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_EXTRACTED_FAILED, user_id: "autre-user" },
      error: null,
    });
    const result = await retryCompliance("upload-1");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne extraction_not_ready si extraction non terminée", async () => {
    mockDbSingle.mockResolvedValue({ data: UPLOAD_NOT_EXTRACTED, error: null });
    const result = await retryCompliance("upload-2");
    expect(result).toEqual({ success: false, code: "extraction_not_ready" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("retourne already_processing si conformité déjà en cours", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_EXTRACTED_FAILED, compliance_status: "processing" },
      error: null,
    });
    const result = await retryCompliance("upload-1");
    expect(result).toEqual({ success: false, code: "already_processing" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("remet à zéro les champs de conformité avant de déclencher", async () => {
    await retryCompliance("upload-1");
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        compliance_status: "pending",
        compliance_score: null,
        compliance_band: null,
      })
    );
  });

  it("déclenche fetch vers /api/compliance/check avec le bon secret", async () => {
    await retryCompliance("upload-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/compliance/check"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-internal-secret": "secret-test",
        }),
        body: JSON.stringify({ uploadId: "upload-1" }),
      })
    );
  });

  it("appelle revalidatePath après succès", async () => {
    await retryCompliance("upload-1");
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it("retourne { success: true } pour un retry valide", async () => {
    const result = await retryCompliance("upload-1");
    expect(result).toEqual({ success: true });
  });

  it("retourne server_error si la mise à jour DB échoue", async () => {
    mockUpdateEqResult.mockResolvedValue({ error: { message: "db down" } });
    const result = await retryCompliance("upload-1");
    expect(result).toEqual({ success: false, code: "server_error" });
  });
});

// --------------------------------------------------------------------------
// getComplianceResult
// --------------------------------------------------------------------------

describe("getComplianceResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
  });

  it("retourne null si l'utilisateur n'est pas authentifié", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getComplianceResult("upload-1");
    expect(result).toBeNull();
  });

  it("retourne le résultat si l'utilisateur est propriétaire", async () => {
    mockDbSingle.mockResolvedValue({ data: COMPLIANCE_RECORD, error: null });
    const result = await getComplianceResult("upload-1");
    expect(result).toMatchObject({ score: 85, band: "attention" });
  });

  it("retourne null si aucun résultat trouvé", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const result = await getComplianceResult("upload-xyz");
    expect(result).toBeNull();
  });
});
