import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  slugify,
  buildStoragePath,
  uploadInvoice,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
} from "./upload";

// --------------------------------------------------------------------------
// Mocks hoistés (doivent être déclarés avant vi.mock pour éviter le TDZ)
// --------------------------------------------------------------------------

const {
  mockGetUser,
  mockStorageUpload,
  mockStorageRemove,
  mockDbInsert,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockDbInsert: vi.fn(),
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
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
    from: () => ({
      insert: () => ({
        select: () => ({ single: mockDbInsert }),
      }),
    }),
  }),
}));

// --------------------------------------------------------------------------
// Helper : crée un File simulé
// --------------------------------------------------------------------------

function makePdf(name = "facture.pdf", size = 1024): File {
  const content = new Uint8Array(size).fill(0x25); // '%' = début d'un PDF
  return new File([content], name, { type: UPLOAD_ALLOWED_MIME });
}

function makeFormData(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

// --------------------------------------------------------------------------
// slugify
// --------------------------------------------------------------------------

describe("slugify", () => {
  it.each([
    ["facture.pdf", "facture"],
    ["Facture 2026-01.pdf", "facture-2026-01"],
    ["mon fichier (v2).pdf", "mon-fichier-v2"],
    ["été-été.pdf", "ete-ete"],
    [".pdf", "facture"],                          // nom vide → fallback
    ["----.pdf", "facture"],                      // tirets seuls → fallback
    ["a".repeat(100) + ".pdf", "a".repeat(80)],  // troncature à 80 chars
  ])("slugify('%s') → '%s'", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

// --------------------------------------------------------------------------
// buildStoragePath
// --------------------------------------------------------------------------

describe("buildStoragePath", () => {
  it("génère un chemin au format {userId}/{timestamp}-{slug}.pdf", () => {
    const path = buildStoragePath("user-123", "Facture Test.pdf");
    expect(path).toMatch(/^user-123\/\d+-facture-test\.pdf$/);
  });

  it("ne contient pas de double-slash", () => {
    expect(buildStoragePath("uid", "facture.pdf")).not.toContain("//");
  });
});

// --------------------------------------------------------------------------
// uploadInvoice
// --------------------------------------------------------------------------

describe("uploadInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc", email: "test@example.fr" } },
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({});
    mockDbInsert.mockResolvedValue({
      data: {
        id: "upload-1",
        user_id: "user-abc",
        file_name: "facture.pdf",
        storage_path: "user-abc/123-facture.pdf",
        mime_type: UPLOAD_ALLOWED_MIME,
        file_size: 1024,
        status: "uploaded",
        created_at: new Date().toISOString(),
      },
      error: null,
    });
  });

  it("retourne { success: true } pour un PDF valide", async () => {
    const result = await uploadInvoice(makeFormData(makePdf()));
    expect(result.success).toBe(true);
  });

  it("retourne unauthenticated si aucun utilisateur connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await uploadInvoice(makeFormData(makePdf()));
    expect(result).toEqual({ success: false, code: "unauthenticated" });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("retourne invalid_type pour un fichier non-PDF", async () => {
    const notPdf = new File(["<html>"], "page.html", { type: "text/html" });
    const result = await uploadInvoice(makeFormData(notPdf));
    expect(result).toEqual({ success: false, code: "invalid_type" });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("retourne too_large si le fichier dépasse la limite", async () => {
    const big = makePdf("big.pdf", UPLOAD_MAX_BYTES + 1);
    const result = await uploadInvoice(makeFormData(big));
    expect(result).toEqual({ success: false, code: "too_large" });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("retourne upload_error si le Storage échoue", async () => {
    mockStorageUpload.mockResolvedValue({
      error: { message: "bucket not found" },
    });
    const result = await uploadInvoice(makeFormData(makePdf()));
    expect(result).toEqual({ success: false, code: "upload_error" });
  });

  it("supprime le fichier Storage si l'insertion DB échoue", async () => {
    mockDbInsert.mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });
    const result = await uploadInvoice(makeFormData(makePdf()));
    expect(result).toEqual({ success: false, code: "upload_error" });
    expect(mockStorageRemove).toHaveBeenCalledOnce();
  });

  it("appelle revalidatePath('/dashboard') après un upload réussi", async () => {
    await uploadInvoice(makeFormData(makePdf()));
    expect(mockRevalidatePath).toHaveBeenCalledOnce();
  });

  it("accepte un fichier exactement à la limite de taille", async () => {
    const exact = makePdf("limit.pdf", UPLOAD_MAX_BYTES);
    const result = await uploadInvoice(makeFormData(exact));
    expect(result.success).toBe(true);
  });
});
