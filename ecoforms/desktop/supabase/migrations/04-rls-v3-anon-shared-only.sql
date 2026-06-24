-- ============================================================
-- EcoForms — Storage RLS v3 (ADR-025 Fase 0)
-- Restringe anon a shared/* apenas; authenticated acessa tudo
-- incluindo o novo namespace attachments/{domain}/{hash}.ext
--
-- Execute no SQL Editor do Supabase (painel > SQL Editor)
-- Pré-requisito: 01-storage-rls-v2.sql aplicado
-- ============================================================

-- 1. Remover policies anon write/read existentes
DROP POLICY IF EXISTS "anon_read_mobile"     ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_mobile"   ON storage.objects;
DROP POLICY IF EXISTS "anon_update_mobile"   ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_mobile"   ON storage.objects;

-- 2. Ampliar policies authenticated para incluir attachments/
DROP POLICY IF EXISTS "auth_read_desktop"    ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_desktop"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_desktop"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_desktop"  ON storage.objects;

CREATE POLICY "auth_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'sync-bucket');

CREATE POLICY "auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sync-bucket');

CREATE POLICY "auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING  (bucket_id = 'sync-bucket')
WITH CHECK (bucket_id = 'sync-bucket');

CREATE POLICY "auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sync-bucket');

-- 3. Anon: leitura restrita a shared/* apenas
--    Paths users/{userId}/images/ e attachments/* exigem sessão authenticated.
--    Mobile continua lendo shared/users.json, shared/tasks.json etc. sem impacto.
CREATE POLICY "anon_read_shared"
ON storage.objects FOR SELECT
TO anon
USING (
    bucket_id = 'sync-bucket'
    AND name LIKE 'shared/%'
);

-- 4. Verificação pós-migração
SELECT
    policyname,
    roles,
    cmd,
    qual IS NOT NULL AS has_using,
    with_check IS NOT NULL AS has_check
FROM pg_policies
WHERE tablename  = 'objects'
  AND schemaname = 'storage'
ORDER BY roles, cmd;

-- ============================================================
-- ROLLBACK
-- ============================================================
/*
DROP POLICY IF EXISTS "auth_read"         ON storage.objects;
DROP POLICY IF EXISTS "auth_insert"       ON storage.objects;
DROP POLICY IF EXISTS "auth_update"       ON storage.objects;
DROP POLICY IF EXISTS "auth_delete"       ON storage.objects;
DROP POLICY IF EXISTS "anon_read_shared"  ON storage.objects;

-- restaurar v2
CREATE POLICY "auth_read_desktop" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR name LIKE 'orgs/%/manifests/%' OR
  name = 'shared/org_config.json' OR name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%' OR name = 'shared/.bootstrap_marker'
));
-- ... (restaurar demais políticas de 01-storage-rls-v2.sql)
*/
