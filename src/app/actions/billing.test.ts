import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCheckoutSession,
  createPortalSession,
  getUserProfile,
} from "./billing";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockGetUser,
  mockGetOrCreateProfile,
  mockStripeCustomersCreate,
  mockStripeCheckoutCreate,
  mockStripePortalCreate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetOrCreateProfile: vi.fn(),
  mockStripeCustomersCreate: vi.fn(),
  mockStripeCheckoutCreate: vi.fn(),
  mockStripePortalCreate: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseSessionClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/billing", () => ({
  getOrCreateProfile: mockGetOrCreateProfile,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockReturnValue({
    customers: { create: mockStripeCustomersCreate },
    checkout: { sessions: { create: mockStripeCheckoutCreate } },
    billingPortal: { sessions: { create: mockStripePortalCreate } },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// --------------------------------------------------------------------------
// Données
// --------------------------------------------------------------------------

const USER = { id: "user-abc", email: "test@example.fr" };

const PROFILE_FREE = {
  id: "user-abc",
  stripe_customer_id: null,
  subscription_status: "free",
  invoices_used_this_month: 0,
  invoices_limit: 3,
};

const PROFILE_WITH_CUSTOMER = {
  ...PROFILE_FREE,
  stripe_customer_id: "cus_test123",
  subscription_status: "starter",
};

// --------------------------------------------------------------------------
// createCheckoutSession
// --------------------------------------------------------------------------

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockGetOrCreateProfile.mockResolvedValue(PROFILE_FREE);
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockStripeCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test",
    });
  });

  it("retourne unauthenticated si l'utilisateur n'est pas connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await createCheckoutSession("starter");
    expect(result).toEqual({ success: false, code: "unauthenticated" });
  });

  it("retourne no_price_id si STRIPE_STARTER_PRICE_ID n'est pas défini", async () => {
    delete process.env.STRIPE_STARTER_PRICE_ID;
    const result = await createCheckoutSession("starter");
    expect(result).toEqual({ success: false, code: "no_price_id" });
  });

  it("crée un nouveau customer Stripe si le profil n'en a pas", async () => {
    await createCheckoutSession("starter");
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: USER.email })
    );
  });

  it("réutilise le customer existant sans en créer un nouveau", async () => {
    mockGetOrCreateProfile.mockResolvedValue(PROFILE_WITH_CUSTOMER);
    await createCheckoutSession("starter");
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
  });

  it("retourne l'URL de checkout Stripe", async () => {
    const result = await createCheckoutSession("starter");
    expect(result).toEqual({
      success: true,
      url: "https://checkout.stripe.com/pay/cs_test",
    });
  });

  it("retourne server_error si Stripe lève une exception", async () => {
    mockStripeCheckoutCreate.mockRejectedValue(new Error("stripe down"));
    const result = await createCheckoutSession("pro");
    expect(result).toEqual({ success: false, code: "server_error" });
  });
});

// --------------------------------------------------------------------------
// createPortalSession
// --------------------------------------------------------------------------

describe("createPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockGetOrCreateProfile.mockResolvedValue(PROFILE_WITH_CUSTOMER);
    mockStripePortalCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session/bps_test",
    });
  });

  it("retourne unauthenticated si non connecté", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await createPortalSession();
    expect(result).toEqual({ success: false, code: "unauthenticated" });
  });

  it("retourne server_error si pas de stripe_customer_id", async () => {
    mockGetOrCreateProfile.mockResolvedValue(PROFILE_FREE);
    const result = await createPortalSession();
    expect(result).toEqual({ success: false, code: "server_error" });
  });

  it("retourne l'URL du portail Stripe", async () => {
    const result = await createPortalSession();
    expect(result).toEqual({
      success: true,
      url: "https://billing.stripe.com/session/bps_test",
    });
  });

  it("retourne server_error si Stripe lève une exception", async () => {
    mockStripePortalCreate.mockRejectedValue(new Error("portal down"));
    const result = await createPortalSession();
    expect(result).toEqual({ success: false, code: "server_error" });
  });
});

// --------------------------------------------------------------------------
// getUserProfile
// --------------------------------------------------------------------------

describe("getUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    mockGetOrCreateProfile.mockResolvedValue(PROFILE_FREE);
  });

  it("retourne null si non authentifié", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getUserProfile();
    expect(result).toBeNull();
  });

  it("retourne le profil de l'utilisateur", async () => {
    const result = await getUserProfile();
    expect(result).toMatchObject({ id: "user-abc", subscription_status: "free" });
  });

  it("appelle getOrCreateProfile avec le bon userId", async () => {
    await getUserProfile();
    expect(mockGetOrCreateProfile).toHaveBeenCalledWith(USER.id);
  });
});
