import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// --------------------------------------------------------------------------
// Mocks hoistés
// --------------------------------------------------------------------------

const {
  mockConstructEvent,
  mockUpdateProfileFromStripe,
  mockSubscriptionsRetrieve,
  mockCustomersRetrieve,
  mockRpcFn,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockUpdateProfileFromStripe: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockRpcFn: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockReturnValue({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    customers: { retrieve: mockCustomersRetrieve },
  }),
}));

vi.mock("@/lib/billing", () => ({
  updateProfileFromStripe: mockUpdateProfileFromStripe,
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn().mockReturnValue({
    rpc: (fn: string, args: unknown) => mockRpcFn(fn, args),
  }),
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const WEBHOOK_SECRET = "whsec_test";

function makeRequest(body: unknown, sig = "stripe-sig-valid"): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body: JSON.stringify(body),
  });
}

const MOCK_SUBSCRIPTION = {
  id: "sub_123",
  status: "active",
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  metadata: { supabase_user_id: "user-abc" },
  items: { data: [{ price: { id: "price_starter" } }] },
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    mockUpdateProfileFromStripe.mockResolvedValue(undefined);
    mockRpcFn.mockResolvedValue({ error: null });
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  it("retourne 400 si stripe-signature est absent", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si STRIPE_WEBHOOK_SECRET n'est pas défini", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la signature est invalide", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  // ── checkout.session.completed ────────────────────────────────────────

  it("met à jour le profil après checkout.session.completed", async () => {
    const session = {
      metadata: { supabase_user_id: "user-abc" },
      customer: "cus_123",
      subscription: "sub_123",
    };
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });
    mockSubscriptionsRetrieve.mockResolvedValue(MOCK_SUBSCRIPTION);

    const res = await POST(makeRequest(session));
    expect(res.status).toBe(200);
    expect(mockUpdateProfileFromStripe).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({
        stripe_customer_id: "cus_123",
        subscription_status: "starter",
      })
    );
  });

  it("ignore checkout.session.completed sans supabase_user_id", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: {}, customer: "cus_123", subscription: null } },
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(mockUpdateProfileFromStripe).not.toHaveBeenCalled();
  });

  // ── customer.subscription.updated ────────────────────────────────────

  it("met à jour le profil lors de customer.subscription.updated", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: MOCK_SUBSCRIPTION },
    });

    const res = await POST(makeRequest(MOCK_SUBSCRIPTION));
    expect(res.status).toBe(200);
    expect(mockUpdateProfileFromStripe).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({ subscription_status: "starter" })
    );
  });

  it("identifie le plan Pro via price ID", async () => {
    const proSub = {
      ...MOCK_SUBSCRIPTION,
      items: { data: [{ price: { id: "price_pro" } }] },
    };
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: proSub },
    });

    await POST(makeRequest(proSub));
    expect(mockUpdateProfileFromStripe).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({ subscription_status: "pro" })
    );
  });

  // ── customer.subscription.deleted ────────────────────────────────────

  it("passe à 'canceled' lors de customer.subscription.deleted", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { ...MOCK_SUBSCRIPTION, status: "canceled" } },
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(mockUpdateProfileFromStripe).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({
        subscription_status: "canceled",
        stripe_subscription_id: null,
      })
    );
  });

  // ── invoice.paid ──────────────────────────────────────────────────────

  it("remet à zéro l'usage lors de invoice.paid", async () => {
    const invoice = { customer: "cus_123" };
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: invoice },
    });
    mockCustomersRetrieve.mockResolvedValue({
      id: "cus_123",
      deleted: false,
      metadata: { supabase_user_id: "user-abc" },
    });

    const res = await POST(makeRequest(invoice));
    expect(res.status).toBe(200);
    expect(mockRpcFn).toHaveBeenCalledWith("reset_invoices_used", {
      p_user_id: "user-abc",
    });
  });

  // ── Événements non gérés ──────────────────────────────────────────────

  it("retourne 200 pour un événement non géré", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
