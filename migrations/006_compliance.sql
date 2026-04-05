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
