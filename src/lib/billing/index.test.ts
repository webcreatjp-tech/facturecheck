import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOrCreateProfile,
  checkUploadQuota,
  incrementUsage,
  updateProfileFromStripe,
} from "./index";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockDbSingle,
  mockDbInsertSingle,
  mockUpsertFn,
  mockRpcFn,
} = vi.hoisted(() => ({
  mockDbSingle: vi.fn(),
  mockDbInsertSingle: vi.fn(),
  mockUpsertFn: vi.fn(),
  mockRpcFn: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: mockDbSingle }) }),
          insert: () => ({ select: () => ({ single: mockDbInsertSingle }) }),
          upsert: (data: unknown, opts: unknown) => mockUpsertFn(data, opts),
          update: () => ({ eq: () => ({ error: null }) }),
        };
      }
      return {};
    },
    rpc: (fn: string, args: unknown) => mockRpcFn(fn, args),
  }),
}));

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const FREE_PROFILE = {
  id: "user-1",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "free",
  subscription_period_end: null,
  invoices_used_this_month: 0,
  invoices_limit: 3,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const PRO_PROFILE = {
  ...FREE_PROFILE,
  subscription_status: "pro",
  invoices_limit: null,
};

// --------------------------------------------------------------------------
// getOrCreateProfile
// --------------------------------------------------------------------------

describe("getOrCreateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le profil existant", async () => {
    mockDbSingle.mockResolvedValue({ data: FREE_PROFILE, error: null });
    const result = await getOrCreateProfile("user-1");
    expect(result).toMatchObject({ id: "user-1", subscription_status: "free" });
    expect(mockDbInsertSingle).not.toHaveBeenCalled();
  });

  it("crée et retourne un nouveau profil si inexistant", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    mockDbInsertSingle.mockResolvedValue({ data: FREE_PROFILE, error: null });
    const result = await getOrCreateProfile("user-new");
    expect(result).toMatchObject({ subscription_status: "free" });
    expect(mockDbInsertSingle).toHaveBeenCalledOnce();
  });

  it("retourne null si la création échoue", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "nf" } });
    mockDbInsertSingle.mockResolvedValue({ data: null, error: { message: "db error" } });
    const result = await getOrCreateProfile("user-fail");
    expect(result).toBeNull();
  });
});

// --------------------------------------------------------------------------
// checkUploadQuota
// --------------------------------------------------------------------------

describe("checkUploadQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autorise si used < limit (plan free)", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...FREE_PROFILE, invoices_used_this_month: 2 },
      error: null,
    });
    const quota = await checkUploadQuota("user-1");
    expect(quota.allowed).toBe(true);
    expect(quota.used).toBe(2);
    expect(quota.limit).toBe(3);
    expect(quota.remaining).toBe(1);
  });

  it("refuse si used >= limit (quota atteint)", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...FREE_PROFILE, invoices_used_this_month: 3 },
      error: null,
    });
    const quota = await checkUploadQuota("user-1");
    expect(quota.allowed).toBe(false);
    expect(quota.remaining).toBe(0);
  });

  it("autorise sans limite pour le plan Pro", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...PRO_PROFILE, invoices_used_this_month: 999 },
      error: null,
    });
    const quota = await checkUploadQuota("user-pro");
    expect(quota.allowed).toBe(true);
    expect(quota.limit).toBeNull();
    expect(quota.remaining).toBeNull();
  });

  it("autorise (fail-open) si le profil est inaccessible", async () => {
    mockDbSingle.mockResolvedValue({ data: null, error: { message: "nf" } });
    mockDbInsertSingle.mockResolvedValue({ data: null, error: { message: "err" } });
    const quota = await checkUploadQuota("user-broken");
    expect(quota.allowed).toBe(true);
  });

  it("retourne remaining=0 si exactement à la limite", async () => {
    mockDbSingle.mockResolvedValue({
      data: { ...FREE_PROFILE, invoices_used_this_month: 3 },
      error: null,
    });
    const quota = await checkUploadQuota("user-1");
    expect(quota.remaining).toBe(0);
  });
});

// --------------------------------------------------------------------------
// incrementUsage
// --------------------------------------------------------------------------

describe("incrementUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcFn.mockResolvedValue({ error: null });
  });

  it("appelle la fonction RPC increment_invoices_used", async () => {
    await incrementUsage("user-1");
    expect(mockRpcFn).toHaveBeenCalledWith("increment_invoices_used", {
      p_user_id: "user-1",
    });
  });

  it("ne lance pas d'erreur si le RPC échoue", async () => {
    mockRpcFn.mockResolvedValue({ error: { message: "rpc error" } });
    await expect(incrementUsage("user-1")).resolves.toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// updateProfileFromStripe
// --------------------------------------------------------------------------

describe("updateProfileFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertFn.mockResolvedValue({ error: null });
  });

  it("appelle upsert avec les champs de mise à jour", async () => {
    await updateProfileFromStripe("user-1", {
      stripe_customer_id: "cus_abc",
      stripe_subscription_id: "sub_xyz",
      subscription_status: "starter",
      subscription_period_end: "2026-05-01T00:00:00.000Z",
    });
    expect(mockUpsertFn).toHaveBeenCalledOnce();
    const payload = mockUpsertFn.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      id: "user-1",
      subscription_status: "starter",
      stripe_customer_id: "cus_abc",
    });
  });

  it("réinitialise invoices_used_this_month si reset_usage=true", async () => {
    await updateProfileFromStripe("user-1", {
      subscription_status: "starter",
      reset_usage: true,
    });
    const payload = mockUpsertFn.mock.calls[0]?.[0];
    expect(payload.invoices_used_this_month).toBe(0);
  });

  it("ne réinitialise pas l'usage si reset_usage est absent", async () => {
    await updateProfileFromStripe("user-1", {
      subscription_status: "pro",
    });
    const payload = mockUpsertFn.mock.calls[0]?.[0];
    expect("invoices_used_this_month" in payload).toBe(false);
  });
});
