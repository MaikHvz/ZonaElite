-- =============================================================
-- Migración 006 — Deudas por check-in sin tokens + RLS restringidas
--                  + constraint legacy (B-013, B-014, Fase 10)
--
-- 1. Tabla `debts` (deuda materializada por clase sin tokens).
-- 2. RLS de `debts` (admin/staff write, usuario solo lectura propia).
-- 3. B-013: restringe 3 policies de INSERT a admin/staff (se cierra
--    la auto-inscripción / auto-asistencia por REST directa).
-- 4. B-014: backfill de filas legacy (schedule_id sin session_id)
--    y drop del UNIQUE legacy (beneficiary_id, schedule_id).
-- =============================================================

-- =====================================================
-- 1. TABLA: debts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id),
  session_id uuid REFERENCES public.class_sessions(id),
  class_enrollment_id uuid REFERENCES public.class_enrollments(id),
  amount integer NOT NULL DEFAULT 1 CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagada','condonada')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_debts_beneficiary_status ON public.debts(beneficiary_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_session ON public.debts(session_id);

-- =====================================================
-- 2. RLS: debts
-- =====================================================
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debts_admin_all" ON public.debts
  FOR ALL USING (public.is_admin());

CREATE POLICY "debts_staff_read" ON public.debts
  FOR SELECT USING (public.is_staff());

-- Usuario: solo lectura de las deudas de sus propios beneficiarios.
CREATE POLICY "debts_user_read_own" ON public.debts
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id));

-- =====================================================
-- 3. B-013: RLS restringidas (INSERT solo admin/staff)
-- =====================================================

-- academy_enrollments: ya no se permite auto-matrícula por REST.
DROP POLICY IF EXISTS "user_insert_enrollment_flow" ON public.academy_enrollments;
CREATE POLICY "academy_enrollments_insert_admin_staff" ON public.academy_enrollments
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_staff());

-- class_enrollments: walk-in QR ahora exige admin/staff (el flujo
-- legítimo pasa por /api/checkin con service role).
DROP POLICY IF EXISTS "class_enrollments_insert_qr_walkin" ON public.class_enrollments;
CREATE POLICY "class_enrollments_insert_qr_admin_staff" ON public.class_enrollments
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_staff());

-- attendance: ya no se permite auto-asistencia por REST.
DROP POLICY IF EXISTS "attendance_insert_own_beneficiary" ON public.attendance;
CREATE POLICY "attendance_insert_admin_staff" ON public.attendance
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_staff());

-- =====================================================
-- 4. B-014: backfill legacy + drop constraint
-- =====================================================

-- 4.1 Backfill: filas con schedule_id y sin session_id se mapean a la
--     sesión futura más próxima del mismo horario. Guard NOT EXISTS para
--     no violar el UNIQUE (beneficiary_id, session_id) si el beneficiario
--     ya tiene otra inscripción en esa sesión.
UPDATE public.class_enrollments ce
SET session_id = sub.target_session_id
FROM (
  SELECT
    legacy.id AS enrollment_id,
    (
      SELECT cs.id
      FROM public.class_sessions cs
      WHERE cs.schedule_id = legacy.schedule_id
        AND cs.session_date >= public.chile_today()
      ORDER BY cs.session_date ASC, cs.id ASC
      LIMIT 1
    ) AS target_session_id
  FROM public.class_enrollments legacy
  WHERE legacy.session_id IS NULL
    AND legacy.schedule_id IS NOT NULL
) sub
WHERE ce.id = sub.enrollment_id
  AND sub.target_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.class_enrollments existing
    WHERE existing.session_id = sub.target_session_id
      AND existing.beneficiary_id = ce.beneficiary_id
  );

-- 4.2 Drop del UNIQUE legacy (beneficiary_id, schedule_id). El modelo
--     per-session (UNIQUE beneficiary_id+session_id) queda como fuente.
ALTER TABLE public.class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_beneficiary_schedule_key;

-- En caso de que exista como índice en lugar de constraint:
DROP INDEX IF EXISTS class_enrollments_beneficiary_schedule_key;
