import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryOcr, getUploadWithOcr } from "./ocr";

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
  /** Résultat du .single() final après la chaîne .select().eq()...single() */
  mockDbSingle: vi.fn(),
  /** Capture les champs passés à .update(fields) */
  mockUpdateFn: vi.fn(),
  /** Résultat du .eq() terminal après .update() — configurable par test */
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
      // SELECT : chaîne .select().eq().{single | eq().single}
      select: () => ({
        eq: () => ({
          single: mockDbSingle,
          // Deuxième .eq() pour getUploadWithOcr (deux filtres)
          eq: () => ({ single: mockDbSingle }),
        }),
      }),
      // UPDATE : .update(fields).eq() → { error }
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

const USER = { id: "user-abc", email: "test@example.fr" };

const UPLOAD_FAILED = {
  id: "upload-1",
  user_id: "user-abc",
  ocr_status: "failed",
};

const UPLOAD_PROCESSED = {
  id: "upload-2",
  user_id: "user-abc",
  ocr_status: "processed",
  ocr_text: "Texte extrait",
  ocr_error: null,
  ocr_provider: "mock",
  ocr_processed_at: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// retryOcr
// --------------------------------------------------------------------------

describe("retryOcr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_OCR_SECRET = "secret-test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockDbSingle.mockResolvedValue({ data: UPLOAD_FAILED, error: null });
    mockUpdateEqResult.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("retourne unauthenticated si l'utilisateur n'est pas connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await retryOcr("upload-1");
    expect(result).toEqual({ success: false, code: "unauthenticated" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("retourne not_found si l'upload n'existe pas", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "nf" } });
    const result = await retryOcr("upload-xyz");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne not_found si l'upload appartient à un autre utilisateur", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_FAILED, user_id: "autre-user" },
      error: null,
    });
    const result = await retryOcr("upload-1");
    expect(result).toEqual({ success: false, code: "not_found" });
  });

  it("retourne already_processing si l'OCR est déjà en cours", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...UPLOAD_FAILED, ocr_status: "processing" },
      error: null,
    });
    const result = await retryOcr("upload-1");
    expect(result).toEqual({ success: false, code: "already_processing" });
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("réinitialise les champs OCR avant de déclencher", async () => {
    await retryOcr("upload-1");
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ocr_status: "pending",
        ocr_text: null,
        ocr_error: null,
        ocr_processed_at: null,
        ocr_provider: null,
      })
    );
  });

  it("déclenche fetch vers /api/ocr/process avec le bon secret", async () => {
    await retryOcr("upload-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ocr/process"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-internal-secret": "secret-test",
        }),
        body: JSON.stringify({ uploadId: "upload-1" }),
      })
    );
  });

  it("appelle revalidatePath('/dashboard') après succès", async () => {
    await retryOcr("upload-1");
    expect(mockRevalidatePath).toHaveBeenCalledOnce();
  });

  it("retourne { success: true } pour un retry valide", async () => {
    const result = await retryOcr("upload-1");
    expect(result).toEqual({ success: true });
  });

  it("retourne server_error si la mise à jour DB échoue", async () => {
    mockUpdateEqResult.mockResolvedValue({ error: { message: "db down" } });
    const result = await retryOcr("upload-1");
    expect(result).toEqual({ success: false, code: "server_error" });
  });
});

// --------------------------------------------------------------------------
// getUploadWithOcr
// --------------------------------------------------------------------------

describe("getUploadWithOcr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
  });

  it("retourne null si l'utilisateur n'est pas authentifié", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getUploadWithOcr("upload-2");
    expect(result).toBeNull();
  });

  it("retourne le record si l'utilisateur en est le propriétaire", async () => {
    mockDbSingle.mockResolvedValue({ data: UPLOAD_PROCESSED, error: null });
    const result = await getUploadWithOcr("upload-2");
    expect(result).toMatchObject({
      id: "upload-2",
      ocr_status: "processed",
      ocr_text: "Texte extrait",
    });
  });

  it("retourne null si le record n'est pas trouvé (accès refusé)", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const result = await getUploadWithOcr("upload-xyz");
    expect(result).toBeNull();
  });

  it("retourne les champs OCR complets", async () => {
    mockDbSingle.mockResolvedValue({ data: UPLOAD_PROCESSED, error: null });
    const result = await getUploadWithOcr("upload-2");
    expect(result).toHaveProperty("ocr_provider", "mock");
    expect(result).toHaveProperty("ocr_error", null);
    expect(result).toHaveProperty("ocr_processed_at");
  });
});
