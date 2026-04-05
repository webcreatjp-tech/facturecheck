-- ============================================================
-- Migration 001 – Liste d'attente FactureCheck
-- À exécuter dans l'éditeur SQL Supabase (projet dev puis prod)
-- ============================================================

-- 1. Table principale
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  source     TEXT        NOT NULL DEFAULT 'hero',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Email unique (insensible à la casse via index)
  CONSTRAINT waitlist_email_unique UNIQUE (email),

  -- Valeurs autorisées pour source
  CONSTRAINT waitlist_source_check CHECK (source IN ('hero', 'footer')),

  -- Format email basique côté DB (filet de sécurité supplémentaire)
  CONSTRAINT waitlist_email_format CHECK (
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  )
);

-- Index pour accélérer les recherches par email (unicité + futures requêtes admin)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_lower_idx
  ON waitlist (lower(email));

-- 2. Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Insertion publique autorisée (clé anon ou service role)
CREATE POLICY "waitlist_insert_public"
  ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Lecture réservée au service role (dashboard admin uniquement)
-- La clé anon ne peut pas lire la table
CREATE POLICY "waitlist_select_service_only"
  ON waitlist
  FOR SELECT
  USING (false);

-- Mise à jour et suppression interdites depuis le client
-- (pas de policy FOR UPDATE / DELETE => bloqué par défaut avec RLS activé)

-- 3. Commentaires de documentation
COMMENT ON TABLE  waitlist              IS 'Emails inscrits sur la liste d''attente FactureCheck';
COMMENT ON COLUMN waitlist.email        IS 'Adresse email normalisée en minuscules';
COMMENT ON COLUMN waitlist.source       IS 'Zone d''origine du formulaire : hero | footer';
COMMENT ON COLUMN waitlist.created_at   IS 'Horodatage UTC de l''inscription';
-- ============================================================
-- Migration 002 – Table des téléversements de factures
-- À exécuter dans l'éditeur SQL Supabase après 001_waitlist.sql
-- ============================================================

-- 1. Table principale
CREATE TABLE IF NOT EXISTS uploads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  mime_type    TEXT        NOT NULL DEFAULT 'application/pdf',
  file_size    BIGINT      NOT NULL CHECK (file_size > 0),
  status       TEXT        NOT NULL DEFAULT 'uploaded',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uploads_status_check CHECK (
    status IN ('uploaded', 'processing', 'done', 'error')
  ),
  CONSTRAINT uploads_mime_type_check CHECK (
    mime_type = 'application/pdf'
  )
);

-- Index pour récupérer rapidement les uploads d'un utilisateur
CREATE INDEX IF NOT EXISTS uploads_user_id_created_at_idx
  ON uploads (user_id, created_at DESC);

-- 2. Row Level Security
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne voit que ses propres uploads
CREATE POLICY "uploads_select_own"
  ON uploads FOR SELECT
  USING (auth.uid() = user_id);

-- Un utilisateur ne peut insérer que pour lui-même
CREATE POLICY "uploads_insert_own"
  ON uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour réservée au service role (traitement OCR en T004)
-- Pas de policy FOR UPDATE côté client => bloqué par défaut

-- Suppression interdite depuis le client
-- Pas de policy FOR DELETE côté client => bloqué par défaut

-- 3. Commentaires
COMMENT ON TABLE  uploads              IS 'Métadonnées des factures PDF téléversées par les utilisateurs';
COMMENT ON COLUMN uploads.user_id      IS 'Référence à auth.users.id (Supabase Auth)';
COMMENT ON COLUMN uploads.file_name    IS 'Nom original du fichier tel que fourni par l''utilisateur';
COMMENT ON COLUMN uploads.storage_path IS 'Chemin dans le bucket Supabase Storage (sans le nom du bucket)';
COMMENT ON COLUMN uploads.file_size    IS 'Taille en octets';
COMMENT ON COLUMN uploads.status       IS 'uploaded | processing | done | error';
-- ============================================================
-- Migration 004 – Champs OCR sur la table uploads
-- À exécuter après 002_uploads.sql
-- ============================================================

-- Ajout des colonnes OCR (idempotent avec IF NOT EXISTS)
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS ocr_status       TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ocr_text         TEXT,
  ADD COLUMN IF NOT EXISTS ocr_error        TEXT,
  ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ocr_provider     TEXT;

-- Contrainte sur les valeurs autorisées
-- (à exécuter séparément si la contrainte existe déjà)
DO $$ BEGIN
  ALTER TABLE uploads ADD CONSTRAINT uploads_ocr_status_check
    CHECK (ocr_status IN ('pending', 'processing', 'processed', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index pour retrouver les uploads en attente de traitement
CREATE INDEX IF NOT EXISTS uploads_ocr_status_idx
  ON uploads (ocr_status)
  WHERE ocr_status IN ('pending', 'processing');

-- Commentaires
COMMENT ON COLUMN uploads.ocr_status       IS 'pending | processing | processed | failed';
COMMENT ON COLUMN uploads.ocr_text         IS 'Texte brut extrait par l''OCR (null si non traité)';
COMMENT ON COLUMN uploads.ocr_error        IS 'Message d''erreur OCR si ocr_status = failed';
COMMENT ON COLUMN uploads.ocr_processed_at IS 'Horodatage UTC de fin de traitement OCR';
COMMENT ON COLUMN uploads.ocr_provider     IS 'Identifiant du fournisseur OCR utilisé';

-- Mise à jour des lignes existantes pour qu'elles soient en attente de traitement
UPDATE uploads SET ocr_status = 'pending' WHERE ocr_status IS NULL;
-- T005 – Extraction structurée des champs de facture
-- Ajoute les colonnes d'extraction à la table uploads existante.
-- Exécuter dans : Supabase Dashboard → SQL Editor

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS extraction_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'processing', 'extracted', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_error       TEXT,
  ADD COLUMN IF NOT EXISTS extraction_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_version     TEXT,
  ADD COLUMN IF NOT EXISTS extracted_fields       JSONB;

-- Index pour filtrer rapidement les extractions en attente / en cours
CREATE INDEX IF NOT EXISTS uploads_extraction_status_idx
  ON uploads (extraction_status)
  WHERE extraction_status IN ('pending', 'processing');

-- Commentaires explicatifs
COMMENT ON COLUMN uploads.extraction_status       IS 'Statut du pipeline d''extraction : pending | processing | extracted | failed';
COMMENT ON COLUMN uploads.extraction_error        IS 'Message d''erreur si extraction_status = failed';
COMMENT ON COLUMN uploads.extraction_processed_at IS 'Horodatage UTC de fin de traitement';
COMMENT ON COLUMN uploads.extraction_version      IS 'Version du fournisseur d''extraction utilisé';
COMMENT ON COLUMN uploads.extracted_fields        IS 'Champs structurés extraits du texte OCR (JSON)';
-- T006 – Moteur de conformité des factures françaises
-- Exécuter dans : Supabase Dashboard → SQL Editor

-- ── 1. Colonnes de conformité sur uploads (pour le badge dashboard) ────────

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS compliance_status TEXT
    CHECK (compliance_status IN ('pending', 'processing', 'checked', 'failed')),
  ADD COLUMN IF NOT EXISTS compliance_score  INTEGER
    CHECK (compliance_score >= 0 AND compliance_score <= 100),
  ADD COLUMN IF NOT EXISTS compliance_band   TEXT
    CHECK (compliance_band IN ('conforme', 'attention', 'non_conforme_corrections', 'non_conforme_invalide'));

COMMENT ON COLUMN uploads.compliance_status IS 'Statut du contrôle de conformité : pending | processing | checked | failed';
COMMENT ON COLUMN uploads.compliance_score  IS 'Score de conformité (0-100), NULL si pas encore vérifié';
COMMENT ON COLUMN uploads.compliance_band   IS 'Bande de conformité : conforme | attention | non_conforme_corrections | non_conforme_invalide';

-- ── 2. Table des résultats de conformité ───────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       UUID        NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score           INTEGER     NOT NULL CHECK (score >= 0 AND score <= 100),
  band            TEXT        NOT NULL
    CHECK (band IN ('conforme', 'attention', 'non_conforme_corrections', 'non_conforme_invalide')),
  blocking_errors JSONB       NOT NULL DEFAULT '[]',
  warnings        JSONB       NOT NULL DEFAULT '[]',
  suggestions     JSONB       NOT NULL DEFAULT '[]',
  rules_version   TEXT        NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul résultat courant par upload (upsert sur upload_id)
CREATE UNIQUE INDEX IF NOT EXISTS compliance_results_upload_id_idx
  ON compliance_results (upload_id);

-- Index pour filtrages par statut rapides (dashboard)
CREATE INDEX IF NOT EXISTS uploads_compliance_status_idx
  ON uploads (compliance_status)
  WHERE compliance_status IN ('pending', 'processing');

-- ── 3. RLS sur compliance_results ─────────────────────────────────────────

ALTER TABLE compliance_results ENABLE ROW LEVEL SECURITY;

-- Lecture : propriétaire uniquement
CREATE POLICY "compliance_results_select_own"
  ON compliance_results FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE : service role uniquement (routes API internes)
-- Aucune policy client ajoutée → opérations bloquées pour les rôles anon/authenticated
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
