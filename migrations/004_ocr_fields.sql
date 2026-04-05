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
