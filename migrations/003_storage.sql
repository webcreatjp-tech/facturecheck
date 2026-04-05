-- ============================================================
-- Migration 003 – Bucket Supabase Storage pour les factures
-- ============================================================
-- IMPORTANT : la création du bucket doit se faire via l'API Supabase
-- ou le Dashboard. Les politiques RLS sur storage.objects s'appliquent
-- après la création du bucket.
--
-- Étapes manuelles (Dashboard Supabase → Storage) :
--   1. Cliquer sur "New bucket"
--   2. Nom du bucket : invoices
--   3. Décocher "Public bucket" (bucket PRIVÉ)
--   4. Sauvegarder
--
-- Ou via l'API service role (dans un script d'init) :
--   const { data } = await supabase.storage.createBucket('invoices', {
--     public: false,
--     fileSizeLimit: 10485760,   -- 10 Mo
--     allowedMimeTypes: ['application/pdf'],
--   });
-- ============================================================

-- Politiques RLS sur storage.objects
-- (à exécuter une fois le bucket "invoices" créé)

-- Lecture : un utilisateur authentifié ne peut lire
-- que les fichiers de son propre dossier
CREATE POLICY "invoices_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Écriture (upload) : un utilisateur authentifié ne peut écrire
-- que dans son propre dossier
CREATE POLICY "invoices_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Suppression : uniquement dans son propre dossier
CREATE POLICY "invoices_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoices'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Note : les uploads sont réalisés via le service role côté serveur,
-- ces politiques constituent une défense en profondeur si la clé
-- anon est jamais utilisée directement.
