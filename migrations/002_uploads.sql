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
