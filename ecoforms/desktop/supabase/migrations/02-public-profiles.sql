-- ============================================================
-- EcoForms — Tabela public.profiles (Fase 5)
-- Espelha auth.users do Supabase com dados de perfil
--
-- Execute no SQL Editor do Supabase (painel > SQL Editor)
-- Pré-requisito: Email/Password auth habilitado no Supabase
-- ============================================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'operador',
    ativo BOOLEAN NOT NULL DEFAULT true,
    org_id TEXT DEFAULT 'ecoforms-org-001',
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Trigger: inserir perfil automaticamente ao criar usuário no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, perfil, org_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'operador'),
    COALESCE(NEW.raw_user_meta_data->>'org_id', 'ecoforms-org-001')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir e recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_timestamp();

-- 5. Políticas de leitura (todos authenticated da mesma org podem ler)
CREATE POLICY "profiles_read_own_org"
ON public.profiles FOR SELECT
TO authenticated
USING (org_id = (
  SELECT COALESCE(raw_user_meta_data->>'org_id', 'ecoforms-org-001')
  FROM auth.users WHERE id = auth.uid()
));

-- 6. Política de update (usuário só atualiza o próprio perfil, admin atualiza todos da org)
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'perfil' = 'admin'
    AND raw_user_meta_data->>'org_id' = profiles.org_id
  )
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'perfil' = 'admin'
    AND raw_user_meta_data->>'org_id' = profiles.org_id
  )
);

-- 7. Verificação
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';
