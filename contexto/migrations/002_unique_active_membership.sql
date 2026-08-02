-- =====================================================================
-- MIGRACIÓN: Una sola membresía ACTIVA por beneficiario (B-002)
-- Fecha: 2026-08-01
-- Descripción: Normaliza status de membresías vencidas, limpia duplicados
-- activos vigentes (conservando la más reciente) y crea un índice único
-- parcial que impide en BD la doble membresía activa (race en el pago Flow).
--
-- DECISIÓN DE NEGOCIO (2026-08-01):
--   * Ante duplicados activos vigentes, se conserva la MÁS RECIENTE
--     (created_at DESC, id DESC como desempate determinista).
--   * La limpieza de duplicados solo toca membresías VIGENTES
--     (end_date >= hoy); las vencidas se normalizan a status='vencida'
--     (requisito técnico del índice único parcial, coherente con B-001).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Backfill: las membresías ACTIVAS vencidas pasan a status='vencida'.
--    Sin este paso el índice único parcial (WHERE status='activa') no se
--    puede crear si un beneficiario tiene una activa vencida + una vigente.
--    Es una normalización de datos de una sola vez (no un trigger), y
--    coincide con lo que la Fase 1 ya muestra por fecha en la UI.
-- ---------------------------------------------------------------------
UPDATE public.memberships
SET status = 'vencida'
WHERE status = 'activa'
  AND end_date < current_date;

-- ---------------------------------------------------------------------
-- 2. Limpieza de duplicados ACTIVOS VIGENTES: conservar la más reciente.
--    row_number por beneficiario (created_at DESC, id DESC como desempate),
--    se eliminan las que no son la #1. Las vencidas quedan intactas.
-- ---------------------------------------------------------------------
DELETE FROM public.memberships a
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY beneficiary_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.memberships
    WHERE status = 'activa'
      AND end_date >= current_date
  ) ranked
  WHERE rn > 1
) dup
WHERE a.id = dup.id;

-- ---------------------------------------------------------------------
-- 3. Índice único parcial: a lo sumo UNA membresía con status='activa'
--    por beneficiario. Rechaza el segundo insert con error SQLSTATE 23505,
--    que el backend maneja de forma idempotente (linkea el pago a la activa).
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active
  ON public.memberships(beneficiary_id)
  WHERE status = 'activa';

COMMENT ON INDEX public.idx_memberships_one_active IS
'Garantiza una sola membresía activa por beneficiario (B-002).
El backend captura el error 23505 y re-linkea el pago a la membresía activa existente.';
