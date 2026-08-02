-- =====================================================================
-- MIGRACIÓN: fecha chilena en RLS (B-005)
-- Fecha: 2026-08-01
-- Descripción: crea el helper public.chile_today() (fecha local de
-- America/Santiago) y reemplaza current_date (fecha UTC del servidor
-- PostgreSQL) en la policy de inserción de class_enrollments. Sin esto,
-- en la franja 20:00-23:59 hora Chile una membresía que vence HOY se
-- valida contra el día de MAÑANA (UTC) y el insert se rechaza.
--
-- Fuera de alcance (documentado): body_metrics.recorded_at usa
-- DEFAULT CURRENT_DATE, pero la columna no se usa en el código de la app;
-- si se usa a futuro debe migrarse a public.chile_today().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper de fecha chilena. STABLE + timezone() para ser DST-safe
--    (America/Santiago tiene 2 cambios de hora al año).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chile_today() RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT (timezone('America/Santiago', now()))::date;
$$;

COMMENT ON FUNCTION public.chile_today() IS
'Fecha de hoy en America/Santiago, para policies RLS y defaults que dependen del día local (B-005).';

-- ---------------------------------------------------------------------
-- 2. Regenerar la policy de inscripción a clases: en vez de
--    ae.end_date >= current_date / m.end_date >= current_date (UTC),
--    compara contra la fecha chilena real.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "class_enrollments_insert_admin_or_self" ON public.class_enrollments;

CREATE POLICY "class_enrollments_insert_admin_or_self"
ON public.class_enrollments
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR (
    public.owns_beneficiary(beneficiary_id)
    AND EXISTS (
      SELECT 1 FROM public.academy_enrollments ae
      WHERE ae.beneficiary_id = class_enrollments.beneficiary_id
        AND ae.status = 'activa'
        AND ae.end_date >= public.chile_today()
    )
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.beneficiary_id = class_enrollments.beneficiary_id
        AND m.status = 'activa'
        AND m.end_date >= public.chile_today()
    )
  )
);
