import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryExtraction } from "./extraction";

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
// Données de test
// --------------------------------------------------------------------------

const USER = { id: "user-abc" };

const UPLOAD_PROCESSED_FAILED_EXTRACTION = {
  id: "upload-1",
  user_id: "user-abc",
  ocr_status: "processed",
  extraction_status: "failed",
};

const UPLOAD_OCR_PENDING = {
  id: "upload-2",
  user_id: "user-abc",
  ocr_status: "pending",
  extraction_status: "pending",
};

// --------------------------------------------------------------------------
// retryExtraction
// --------------------------------------------------------------------------

describe("retryExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = "secret-test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockDbSingle.mockResolvedValue({
      data: UPLOAD_PROCESSED_FAILED_EXTRACTION,
      error: null,
    });
    mockUpdateEqResult.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("retourne unauthenticated si l'utilisateur n'est pas connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await retryExtraction("upload-1");
    expect(result).toEqual({ success: false, code: "unauthenticated" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("retourne not_found si l'upload n'existe pas", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "nf" } });
    const result = await retryExtraction("upload-xyz");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne not_found si l'upload appartient à un autre utilisateur", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_PROCESSED_FAILED_EXTRACTION, user_id: "autre-user" },
      error: null,
    });
    const result = await retryExtraction("upload-1");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne ocr_not_ready si l'OCR n'est pas terminé", async () => {
    mockDbSingle.mockResolvedValue({
      data: UPLOAD_OCR_PENDING,
      error: null,
    });
    const result = await retryExtraction("upload-2");
    expect(result).toEqual({ success: false, code: "ocr_not_ready" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("retourne already_processing si l'extraction est déjà en cours", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_PROCESSED_FAILED_EXTRACTION, extraction_status: "processing" },
      error: null,
    });
    const result = await retryExtraction("upload-1");
    expect(result).toEqual({ success: false, code: "already_processing" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("réinitialise les champs d'extraction avant de déclencher", async () => {
    await retryExtraction("upload-1");
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        extraction_status: "pending",
        extracted_fields: null,
        extraction_error: null,
        extraction_processed_at: null,
        extraction_version: null,
      })
    );
  });

  it("déclenche fetch vers /api/extraction/process avec le bon secret", async () => {
    await retryExtraction("upload-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/extraction/process"),
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
    await retryExtraction("upload-1");
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it("retourne { success: true } pour un retry valide", async () => {
    const result = await retryExtraction("upload-1");
    expect(result).toEqual({ success: true });
  });

  it("retourne server_error si la mise à jour DB échoue", async () => {
    mockUpdateEqResult.mockResolvedValue({ error: { message: "db down" } });
    const result = await retryExtraction("upload-1");
    expect(result).toEqual({ success: false, code: "server_error" });
  });
});
