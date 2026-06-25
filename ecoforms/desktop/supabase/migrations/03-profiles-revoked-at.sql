-- ============================================================
-- EcoForms — Adiciona coluna revoked_at a public.profiles
-- Requisito: A6 — Revogação centralizada de auth
--
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
