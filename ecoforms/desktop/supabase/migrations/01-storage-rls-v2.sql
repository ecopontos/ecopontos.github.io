-- ============================================================
-- EcoForms — Storage RLS v2 (Fase 2 + Fase 3)
-- Migração: anon wide-open → dual-auth com paths org-scoped
--
-- Execute no SQL Editor do Supabase (painel > SQL Editor)
-- Pré-requisito: Fase 1 (Supabase Auth paralela) ativa no desktop
-- ============================================================

-- 1. Registrar políticas atuais (auditoria pré-migração)
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 2. Remover políticas anon antigas (bucket-wide)
DROP POLICY IF EXISTS "anon_read"   ON storage.objects;
DROP POLICY IF EXISTS "anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete" ON storage.objects;

-- 3. Remover políticas antigas com outros nomes
DROP POLICY IF EXISTS "Allow all operations (DEV ONLY)" ON storage.objects;

-- ============================================================
-- POLÍTICAS AUTHENTICATED — Desktop (paths org-scoped + legados)
-- ============================================================

-- Leitura
CREATE POLICY "auth_read_desktop"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR
  name LIKE 'orgs/%/manifests/%' OR
  name = 'shared/org_config.json' OR
  name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%' OR
  name = 'shared/.bootstrap_marker'
));

-- Inserção (upload de eventos, manifests, bootstrap)
CREATE POLICY "auth_insert_desktop"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR
  name LIKE 'orgs/%/manifests/%' OR
  name = 'shared/org_config.json' OR
  name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%' OR
  name = 'shared/.bootstrap_marker'
));

-- Atualização (upsert)
CREATE POLICY "auth_update_desktop"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR
  name LIKE 'orgs/%/manifests/%' OR
  name = 'shared/org_config.json' OR
  name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%' OR
  name = 'shared/.bootstrap_marker'
))
WITH CHECK (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR
  name LIKE 'orgs/%/manifests/%' OR
  name = 'shared/org_config.json' OR
  name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%' OR
  name = 'shared/.bootstrap_marker'
));

-- Remoção (limpeza de eventos/manifests antigos)
CREATE POLICY "auth_delete_desktop"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'orgs/%/eventos/%' OR
  name LIKE 'orgs/%/manifests/%' OR
  name LIKE 'eventos/%' OR
  name LIKE 'shared/manifests/%'
));

-- ============================================================
-- POLÍTICAS ANON — Mobile/PWA (paths não sensíveis)
-- Mantém compatibilidade com mobile que não tem Supabase Auth
-- ============================================================

CREATE POLICY "anon_read_mobile"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'shared/users.json' OR
  name LIKE 'shared/form_%' OR
  name LIKE 'shared/data_%' OR
  name LIKE 'shared/tasks.json' OR
  name LIKE 'shared/ecoponto_%' OR
  name LIKE 'shared/app-version.json' OR
  name LIKE 'shared/inbox/%' OR
  name LIKE 'shared/adhoc/%' OR
  name LIKE 'users/%/images/%' OR
  name LIKE 'users/%' OR
  name LIKE 'archive/%' OR
  name LIKE 'forms/%' OR
  name LIKE 'data/%'
));

CREATE POLICY "anon_insert_mobile"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'sync-bucket' AND (
  name LIKE 'shared/inbox/%' OR
  name LIKE 'users/%/images/%' OR
  name LIKE 'archive/%'
));

CREATE POLICY "anon_update_mobile"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'shared/inbox/%' OR
  name LIKE 'users/%/images/%' OR
  name LIKE 'archive/%'
))
WITH CHECK (bucket_id = 'sync-bucket' AND (
  name LIKE 'shared/inbox/%' OR
  name LIKE 'users/%/images/%' OR
  name LIKE 'archive/%'
));

CREATE POLICY "anon_delete_mobile"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'sync-bucket' AND (
  name LIKE 'shared/inbox/%' OR
  name LIKE 'users/%/images/%' OR
  name LIKE 'archive/%'
));

-- ============================================================
-- ROLLBACK (execute em caso de rollback)
-- ============================================================
/*
DROP POLICY IF EXISTS "auth_read_desktop"    ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_desktop"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_desktop"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_desktop"  ON storage.objects;
DROP POLICY IF EXISTS "anon_read_mobile"     ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_mobile"   ON storage.objects;
DROP POLICY IF EXISTS "anon_update_mobile"   ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_mobile"   ON storage.objects;

CREATE POLICY "anon_read"   ON storage.objects FOR SELECT  TO anon USING (bucket_id = 'sync-bucket');
CREATE POLICY "anon_insert" ON storage.objects FOR INSERT  TO anon WITH CHECK (bucket_id = 'sync-bucket');
CREATE POLICY "anon_update" ON storage.objects FOR UPDATE  TO anon USING (bucket_id = 'sync-bucket') WITH CHECK (bucket_id = 'sync-bucket');
CREATE POLICY "anon_delete" ON storage.objects FOR DELETE  TO anon USING (bucket_id = 'sync-bucket');
*/

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
