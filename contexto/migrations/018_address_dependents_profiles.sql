-- ============================================================
-- 018_address_dependents_profiles.sql
-- Dirección para perfiles y cargas:
--   profiles.address    text (nullable)
--   dependents.address  text (nullable)
-- Idempotente: ADD COLUMN IF NOT EXISTS. Sin cambios de RLS: los
-- policies select/update own_or_admin existentes ya cubren la
-- columna nueva.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS address text;
