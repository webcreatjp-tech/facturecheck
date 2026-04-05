// --------------------------------------------------------------------------
// Types de facturation (T007)
// --------------------------------------------------------------------------

export type SubscriptionStatus = "free" | "starter" | "pro" | "canceled";

export interface UserProfile {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_period_end: string | null;
  invoices_used_this_month: number;
  invoices_limit: number | null; // null = illimité (plan Pro)
  created_at: string;
  updated_at: string;
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number | null; // null = illimité
  remaining: number | null; // null = illimité
}

export interface Plan {
  id: SubscriptionStatus;
  name: string;
  priceEur: number; // 0 = gratuit
  limit: number | null; // factures/mois, null = illimité
  stripePriceId: string | null; // null pour le plan gratuit
  features: string[];
}

// Plans disponibles — les IDs Stripe Price sont lus depuis les variables d'env.
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    priceEur: 0,
    limit: 3,
    stripePriceId: null,
    features: ["3 factures / mois", "Rapport de conformité", "Export PDF"],
  },
  {
    id: "starter",
    name: "Starter",
    priceEur: 9,
    limit: 10,
    stripePriceId: null, // résolu dynamiquement depuis STRIPE_STARTER_PRICE_ID
    features: [
      "10 factures / mois",
      "Rapport de conformité",
      "Export PDF",
      "Support email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 29,
    limit: null,
    stripePriceId: null, // résolu dynamiquement depuis STRIPE_PRO_PRICE_ID
    features: [
      "Factures illimitées",
      "Rapport de conformité",
      "Export PDF",
      "Support prioritaire",
      "API access",
    ],
  },
];
