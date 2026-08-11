-- ============================================================
-- Migración 022 — expire_benefits(): vencimiento automático
--
-- Problema: las membresías, inscripciones a la academia y packs
-- de clases personalizadas vencen por fecha (end_date < hoy Chile)
-- pero su columna `status` nunca cambia de 'activa' a 'vencida'.
-- La UI deriva el estado efectivo en runtime, pero el valor
-- persistido sigue diciendo 'activa' (visible en perfiles/paneles
-- que leen `status` directo, p. ej. MembershipCard).
--
-- Solución: RPC transaccional e idempotente que pasa a 'vencida'
-- todo beneficio 'activa' con end_date vencido, usando la fecha
-- chilena (chile_today, DST-safe) — mismo criterio que la UI.
-- SECURITY DEFINER (bypass RLS, solo corrige vencidos) y expuesto
-- a authenticated para que la app lo dispare de forma best-effort
-- al cargar el dashboard. La operación es determinista: solo toca
-- filas vencidas, no puede dañar beneficios vigentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_benefits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_total integer := 0;
  v_updated integer;
BEGIN
  -- 1. Membresías vencidas.
  UPDATE public.memberships
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  -- 2. Inscripciones a la academia vencidas.
  UPDATE public.academy_enrollments
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  -- 3. Packs de clases personalizadas vencidos (los agotados por
  --    uso ya se marcan 'agotada' en enroll_personalized_class).
  UPDATE public.personalized_packs
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  RETURN v_total;
END;
$$;

-- Exponer a usuarios autenticados (operación idempotente y segura).
REVOKE ALL ON FUNCTION public.expire_benefits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_benefits() TO authenticated;

-- Backfill inmediato (una vez): normaliza lo ya vencido.
SELECT public.expire_benefits();
