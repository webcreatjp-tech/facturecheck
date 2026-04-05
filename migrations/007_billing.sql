-- ============================================================
-- T007 – Billing : table profiles + champs Stripe
-- À exécuter dans : Dashboard Supabase → SQL Editor
-- ============================================================

-- ----------------------------------------------------------
-- Table profiles
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  stripe_customer_id        TEXT UNIQUE,
  stripe_subscription_id    TEXT UNIQUE,
  subscription_status       TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'starter', 'pro', 'canceled')),
  subscription_period_end   TIMESTAMPTZ,
  invoices_used_this_month  INTEGER NOT NULL DEFAULT 0,
  invoices_limit            INTEGER,           -- NULL = illimité (plan Pro)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Service role (utilisé côté serveur) bypasse le RLS — aucune politique INSERT/UPDATE
-- nécessaire pour le client service role.

-- ----------------------------------------------------------
-- Trigger updated_at
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ----------------------------------------------------------
-- Fonction atomique d'incrément d'usage
-- Appelée après chaque upload réussi pour éviter les race conditions.
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_invoices_used(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE profiles
  SET invoices_used_this_month = invoices_used_this_month + 1
  WHERE id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ----------------------------------------------------------
-- Fonction de remise à zéro mensuelle
-- Appelée par le webhook Stripe invoice.paid.
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION reset_invoices_used(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE profiles
  SET invoices_used_this_month = 0
  WHERE id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;
