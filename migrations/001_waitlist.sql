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
