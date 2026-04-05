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
