import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinWaitlist } from "./waitlist";
import { isValidEmail } from "@/lib/utils";

// Mock du client Supabase
const mockInsert = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

// --------------------------------------------------------------------------
// isValidEmail
// --------------------------------------------------------------------------

describe("isValidEmail", () => {
  it.each([
    "user@example.com",
    "prenom.nom@domaine.fr",
    "user+tag@sub.domain.io",
    "a@b.co",
  ])("accepte '%s'", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    "",
    "pasdarobase",
    "@domaine.fr",
    "user@",
    "user@domain",
    "user @domain.fr",
    "user@domain..fr",
  ])("rejette '%s'", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

// --------------------------------------------------------------------------
// joinWaitlist
// --------------------------------------------------------------------------

describe("joinWaitlist", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null }); // succès par défaut
  });

  it("retourne { success: true } pour un email valide", async () => {
    const result = await joinWaitlist("test@example.fr", "hero");
    expect(result).toEqual({ success: true });
  });

  it("normalise l'email en minuscules avant l'insertion", async () => {
    await joinWaitlist("UPPER@EXAMPLE.FR", "hero");
    expect(mockInsert).toHaveBeenCalledWith({
      email: "upper@example.fr",
      source: "hero",
    });
  });

  it("retourne invalid_email pour un email mal formaté", async () => {
    const result = await joinWaitlist("pas-un-email", "footer");
    expect(result).toEqual({ success: false, code: "invalid_email" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("retourne invalid_email pour une chaîne vide", async () => {
    const result = await joinWaitlist("", "hero");
    expect(result).toEqual({ success: false, code: "invalid_email" });
  });

  it("retourne duplicate pour une violation de contrainte unique (23505)", async () => {
    mockInsert.mockResolvedValue({ error: { code: "23505", message: "unique" } });
    const result = await joinWaitlist("double@example.fr", "hero");
    expect(result).toEqual({ success: false, code: "duplicate" });
  });

  it("retourne server_error pour toute autre erreur Supabase", async () => {
    mockInsert.mockResolvedValue({
      error: { code: "42P01", message: "relation does not exist" },
    });
    const result = await joinWaitlist("ok@example.fr", "footer");
    expect(result).toEqual({ success: false, code: "server_error" });
  });

  it("passe la source correcte à Supabase", async () => {
    await joinWaitlist("src@test.fr", "footer");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "footer" })
    );
  });
});
