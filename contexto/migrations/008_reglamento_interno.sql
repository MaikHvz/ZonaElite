-- ============================================================
-- 008_reglamento_interno.sql
-- Tabla de contenido único: reglamento interno de la academia.
-- Admin edita (FOR ALL is_admin), usuarios autenticados leen
-- (SELECT true). Idempotente: puede correrse más de una vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reglamento_interno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.reglamento_interno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reglamento_interno_select_all"
  ON public.reglamento_interno FOR SELECT USING (true);

CREATE POLICY "reglamento_interno_admin_all"
  ON public.reglamento_interno FOR ALL USING (public.is_admin());
