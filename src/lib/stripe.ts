import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Retourne une instance Stripe singleton (côté serveur uniquement).
 * Lance une erreur si STRIPE_SECRET_KEY n'est pas définie.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia" });
  }
  return _stripe;
}
