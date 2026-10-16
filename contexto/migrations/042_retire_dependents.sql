-- ============================================================
-- 042_retire_dependents.sql
-- Fase 6 del plan contexto/requisitos/cuenta-unica-por-alumno.md:
-- retiro del sistema de cargas. Cada alumno tiene su propia cuenta.
--
-- ⚠️ APLICAR SOLO CUANDO TODAS LAS CARGAS ESTÉN MIGRADAS
-- (/admin/migracion-cargas sin pendientes). El primer bloque aborta
-- toda la migración si queda alguna carga o algún beneficiario
-- anclado a una carga.
--
-- Retiro SUAVE (reversible y sin romper lecturas):
-- - La tabla dependents queda VACÍA como legado (solo lectura
--   admin) y beneficiaries.dependent_id se conserva (siempre NULL):
--   los embeds de PostgREST que aún la nombran como respaldo de
--   nombre siguen funcionando y devuelven null.
-- - El historial de cargas migradas queda en dependents_archive.
-- - owns_beneficiary() y la policy de lectura de class_enrollments
--   pasan a considerar solo profile_id = auth.uid().
-- - beneficiaries.profile_id pasa a NOT NULL.
-- - Migrar/revertir quedan deshabilitados con mensaje claro.
-- Idempotente.
-- ============================================================

DO $$
DECLARE
  v_pending integer;
  v_anchored integer;
BEGIN
  SELECT count(*) INTO v_pending FROM public.dependents;
  SELECT count(*) INTO v_anchored FROM public.beneficiaries WHERE dependent_id IS NOT NULL;
  IF v_pending > 0 OR v_anchored > 0 THEN
    RAISE EXCEPTION 'No se puede retirar el sistema de cargas: quedan % cargas sin migrar (% beneficiarios anclados a cargas). Migra todas en /admin/migracion-cargas y vuelve a ejecutar 042.',
      v_pending, v_anchored;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Pertenencia: solo la propia cuenta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owns_beneficiary(b_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beneficiaries
    WHERE id = b_id AND profile_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "enrollments_own_read" ON public.class_enrollments;
CREATE POLICY "enrollments_own_read" ON public.class_enrollments
  FOR SELECT USING (public.is_admin() OR public.owns_beneficiary(beneficiary_id));

-- ------------------------------------------------------------
-- Beneficiarios: siempre de una cuenta.
-- ------------------------------------------------------------
ALTER TABLE public.beneficiaries ALTER COLUMN profile_id SET NOT NULL;

-- ------------------------------------------------------------
-- dependents: legado vacío, sin escritura.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_dependents_create_beneficiary ON public.dependents;
DROP FUNCTION IF EXISTS public.create_beneficiary_for_dependent();

DROP POLICY IF EXISTS "dependents_tutor_read" ON public.dependents;
DROP POLICY IF EXISTS "dependents_tutor_update" ON public.dependents;
DROP POLICY IF EXISTS "dependents_admin_all" ON public.dependents;
DROP POLICY IF EXISTS "dependents_admin_read" ON public.dependents;
CREATE POLICY "dependents_admin_read" ON public.dependents
  FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.dependents IS
  'LEGADO (retirada en la migración 042): una cuenta por alumno. Vacía y de solo lectura. El historial de las cargas migradas está en dependents_archive.';

-- ------------------------------------------------------------
-- Migrar / revertir: deshabilitados (misma firma, mensaje claro).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_dependent_to_profile(
  p_dependent_id uuid,
  p_profile_id uuid
)
RETURNS TABLE (
  archive_id uuid,
  beneficiary_id uuid,
  moved jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El sistema de cargas fue retirado: ya no hay cargas que migrar.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_dependent_migration(p_archive_id uuid)
RETURNS TABLE (
  dependent_id uuid,
  beneficiary_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El sistema de cargas fue retirado: las migraciones ya no se pueden revertir.' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM anon;
