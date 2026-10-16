-- ============================================================
-- 2026-10-16_eliminar_cargas.sql
-- Script de DATOS (no es migración de esquema): elimina las cargas
-- (dependents) que quedan y todo su historial, por decisión del
-- usuario de no migrarlas a cuentas propias.
--
-- ORDEN: 1) este script  2) migrations/042_retire_dependents.sql
--        3) migrations/043_changelog_v1_13_0.sql
--
-- Qué hace (todo en una transacción):
-- 1. Respaldo: copia cada carga + todo su historial (membresías,
--    matrículas, packs, inscripciones, asistencia, deudas, pagos,
--    eventos, ficha médica, perfil deportivo, podios) como JSON en
--    dependents_deleted_backup (solo admin).
-- 2. Desvincula los pagos que apuntan a membresías de cargas
--    (payments.membership_id es NO ACTION): EL PAGO SE CONSERVA en el
--    historial de quien pagó; solo pierde el vínculo a la membresía.
-- 3. Borra las inscripciones a eventos de las cargas
--    (event_attendees es NO ACTION).
-- 4. Borra las cargas: el CASCADE elimina su beneficiario y todo su
--    historial; payments.beneficiary_id queda en NULL (SET NULL).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.dependents_deleted_backup (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  dependent_id uuid NOT NULL,
  tutor_id uuid,
  full_name text,
  beneficiary_id uuid,
  snapshot jsonb NOT NULL,
  deleted_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT dependents_deleted_backup_pkey PRIMARY KEY (id)
);
ALTER TABLE public.dependents_deleted_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dependents_deleted_backup_admin_read" ON public.dependents_deleted_backup;
CREATE POLICY "dependents_deleted_backup_admin_read" ON public.dependents_deleted_backup
  FOR SELECT USING (public.is_admin());
COMMENT ON TABLE public.dependents_deleted_backup IS
  'Respaldo JSON de las cargas eliminadas el 2026-10-16 (sin migrar a cuenta propia) y de todo su historial.';

-- 1. Respaldo
INSERT INTO public.dependents_deleted_backup (dependent_id, tutor_id, full_name, beneficiary_id, snapshot)
SELECT d.id, d.tutor_id, d.full_name, b.id,
  jsonb_build_object(
    'dependent',           to_jsonb(d),
    'beneficiary',         to_jsonb(b),
    'tutor',               (SELECT jsonb_build_object('id', t.id, 'full_name', t.full_name, 'email', t.email, 'phone', t.phone) FROM public.profiles t WHERE t.id = d.tutor_id),
    'memberships',         (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.memberships x WHERE x.beneficiary_id = b.id),
    'academy_enrollments', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.academy_enrollments x WHERE x.beneficiary_id = b.id),
    'personalized_packs',  (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.personalized_packs x WHERE x.beneficiary_id = b.id),
    'class_enrollments',   (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.class_enrollments x WHERE x.beneficiary_id = b.id),
    'personalized_enrollments', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.personalized_enrollments x WHERE x.beneficiary_id = b.id),
    'attendance',          (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.attendance x WHERE x.beneficiary_id = b.id),
    'debts',               (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.debts x WHERE x.beneficiary_id = b.id),
    'payments',            (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.payments x WHERE x.beneficiary_id = b.id),
    'event_attendees',     (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.event_attendees x WHERE x.beneficiary_id = b.id),
    'medical_records',     (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.medical_records x WHERE x.beneficiary_id = b.id),
    'sport_profiles',      (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.sport_profiles x WHERE x.beneficiary_id = b.id),
    'sports_podiums',      (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.sports_podiums x WHERE x.beneficiary_id = b.id),
    'consent_forms',       (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.consent_forms x WHERE x.beneficiary_id = b.id),
    'body_metrics',        (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.body_metrics x WHERE x.beneficiary_id = b.id),
    'renewal_requests',    (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.membership_renewal_requests x WHERE x.beneficiary_id = b.id)
  )
FROM public.dependents d
LEFT JOIN public.beneficiaries b ON b.dependent_id = d.id;

-- 2. Pagos: conservarlos, sin vínculo a la membresía que se borra.
UPDATE public.payments
   SET membership_id = NULL
 WHERE membership_id IN (
   SELECT m.id FROM public.memberships m
   JOIN public.beneficiaries b ON b.id = m.beneficiary_id
   WHERE b.dependent_id IS NOT NULL
 );

-- Deudas que apunten a esas membresías (hoy 0; por seguridad).
UPDATE public.debts
   SET membership_id = NULL
 WHERE membership_id IN (
   SELECT m.id FROM public.memberships m
   JOIN public.beneficiaries b ON b.id = m.beneficiary_id
   WHERE b.dependent_id IS NOT NULL
 );

-- 3. Inscripciones a eventos de las cargas.
DELETE FROM public.event_attendees
 WHERE beneficiary_id IN (SELECT id FROM public.beneficiaries WHERE dependent_id IS NOT NULL);

-- 4. Cargas (CASCADE: beneficiario + historial).
DELETE FROM public.dependents;

-- Verificación: debe quedar todo en 0 antes de confirmar.
DO $$
DECLARE
  v_deps integer;
  v_bens integer;
  v_backup integer;
BEGIN
  SELECT count(*) INTO v_deps FROM public.dependents;
  SELECT count(*) INTO v_bens FROM public.beneficiaries WHERE dependent_id IS NOT NULL;
  SELECT count(*) INTO v_backup FROM public.dependents_deleted_backup WHERE deleted_at::date = now()::date;
  IF v_deps > 0 OR v_bens > 0 OR v_backup = 0 THEN
    RAISE EXCEPTION 'Verificación fallida: dependents=%, beneficiarios de cargas=%, respaldos=%', v_deps, v_bens, v_backup;
  END IF;
  RAISE NOTICE 'Cargas eliminadas. Respaldos guardados: %', v_backup;
END;
$$;

COMMIT;
