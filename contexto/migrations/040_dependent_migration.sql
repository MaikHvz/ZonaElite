-- ============================================================
-- 040_dependent_migration.sql
-- Fase 2 del plan contexto/requisitos/cuenta-unica-por-alumno.md:
-- migrar cada carga (dependents) a una cuenta propia del alumno,
-- conservando todo su historial.
--
-- Diseño: el historial (membresías, matrículas, packs, inscripciones,
-- asistencia, deudas, pagos, eventos, ficha médica, perfil deportivo,
-- podios) cuelga de beneficiaries.id, no de dependents.id. Migrar es
-- RE-ANCLAR la fila de beneficiaries de la carga a la cuenta nueva
-- (profile_id = cuenta, dependent_id = NULL). No se copia ni se
-- mueve ninguna fila de historial.
--
-- Cuidados verificados en la BD real (2026-10-16):
-- - beneficiaries.dependent_id es FK ON DELETE CASCADE: borrar una
--   carga borra su beneficiario y TODO su historial. Por eso se
--   desengancha el beneficiario ANTES de archivar/borrar la carga, y
--   se quita a los tutores el permiso de borrar cargas.
-- - CHECK chk_beneficiary_exactly_one + UNIQUE(profile_id): la cuenta
--   nueva ya tiene un beneficiario vacío (trigger
--   trg_profiles_create_beneficiary); se borra antes de re-anclar y
--   solo si no tiene datos.
-- - trg_dependents_create_beneficiary: al revertir, crea un
--   beneficiario automático que hay que borrar.
-- - Supabase da EXECUTE directo a anon/authenticated: se revoca
--   explícitamente (lección de la migración 039).
--
-- Las cargas quedan guardadas: la fila de dependents se conserva hasta
-- que el admin la migra, y al migrarla pasa completa a
-- dependents_archive (reversible).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Datos del apoderado en el perfil del alumno (decisión D4).
-- Solo informativos: no dan acceso a la cuenta.
-- ------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_email text;

-- ------------------------------------------------------------
-- Archivo de cargas migradas (copia completa + trazabilidad).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dependents_archive (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  dependent_id uuid NOT NULL,
  tutor_id uuid NOT NULL,
  full_name text NOT NULL,
  rut text,
  birth_date date NOT NULL,
  category text NOT NULL,
  address text,
  weight numeric,
  height numeric,
  dominant_hand text,
  dependent_created_at timestamptz,
  dependent_updated_at timestamptz,
  beneficiary_id uuid,
  migrated_to_profile_id uuid NOT NULL,
  migrated_by uuid,
  migrated_at timestamptz DEFAULT now() NOT NULL,
  moved_summary jsonb,
  reverted_at timestamptz,
  reverted_by uuid,
  CONSTRAINT dependents_archive_pkey PRIMARY KEY (id),
  CONSTRAINT dependents_archive_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id),
  CONSTRAINT dependents_archive_profile_fkey FOREIGN KEY (migrated_to_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT dependents_archive_migrated_by_fkey FOREIGN KEY (migrated_by) REFERENCES public.profiles(id),
  CONSTRAINT dependents_archive_reverted_by_fkey FOREIGN KEY (reverted_by) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_dependents_archive_dependent ON public.dependents_archive(dependent_id);
CREATE INDEX IF NOT EXISTS idx_dependents_archive_profile ON public.dependents_archive(migrated_to_profile_id);

ALTER TABLE public.dependents_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dependents_archive_admin_all" ON public.dependents_archive;
CREATE POLICY "dependents_archive_admin_all" ON public.dependents_archive
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Congelar cargas: el tutor puede ver y editar las existentes, pero
-- ya no crear ni borrar (borrar arrasaría el historial por el
-- CASCADE). El admin conserva todo.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "dependents_owner_or_admin" ON public.dependents;
DROP POLICY IF EXISTS "dependents_tutor_read" ON public.dependents;
CREATE POLICY "dependents_tutor_read" ON public.dependents
  FOR SELECT USING (tutor_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "dependents_tutor_update" ON public.dependents;
CREATE POLICY "dependents_tutor_update" ON public.dependents
  FOR UPDATE USING (tutor_id = auth.uid() OR public.is_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "dependents_admin_all" ON public.dependents;
CREATE POLICY "dependents_admin_all" ON public.dependents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Resumen de historial de un beneficiario (uso interno).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.beneficiary_data_summary(p_beneficiary_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'memberships',              (SELECT count(*) FROM public.memberships WHERE beneficiary_id = p_beneficiary_id),
    'memberships_active',       (SELECT count(*) FROM public.memberships WHERE beneficiary_id = p_beneficiary_id AND status = 'activa' AND end_date >= public.chile_today()),
    'academy_enrollments',      (SELECT count(*) FROM public.academy_enrollments WHERE beneficiary_id = p_beneficiary_id),
    'personalized_packs',       (SELECT count(*) FROM public.personalized_packs WHERE beneficiary_id = p_beneficiary_id),
    'class_enrollments',        (SELECT count(*) FROM public.class_enrollments WHERE beneficiary_id = p_beneficiary_id),
    'personalized_enrollments', (SELECT count(*) FROM public.personalized_enrollments WHERE beneficiary_id = p_beneficiary_id),
    'attendance',               (SELECT count(*) FROM public.attendance WHERE beneficiary_id = p_beneficiary_id),
    'debts',                    (SELECT count(*) FROM public.debts WHERE beneficiary_id = p_beneficiary_id),
    'payments',                 (SELECT count(*) FROM public.payments WHERE beneficiary_id = p_beneficiary_id),
    'event_attendees',          (SELECT count(*) FROM public.event_attendees WHERE beneficiary_id = p_beneficiary_id),
    'medical_records',          (SELECT count(*) FROM public.medical_records WHERE beneficiary_id = p_beneficiary_id),
    'sport_profiles',           (SELECT count(*) FROM public.sport_profiles WHERE beneficiary_id = p_beneficiary_id),
    'sports_podiums',           (SELECT count(*) FROM public.sports_podiums WHERE beneficiary_id = p_beneficiary_id),
    'consent_forms',            (SELECT count(*) FROM public.consent_forms WHERE beneficiary_id = p_beneficiary_id),
    'body_metrics',             (SELECT count(*) FROM public.body_metrics WHERE beneficiary_id = p_beneficiary_id)
  );
$$;

-- true si el beneficiario tiene cualquier dato (excluye el contador
-- derivado memberships_active).
CREATE OR REPLACE FUNCTION public.beneficiary_has_data(p_beneficiary_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_each_text(public.beneficiary_data_summary(p_beneficiary_id)) s
     WHERE s.key <> 'memberships_active' AND s.value::int > 0
  );
$$;

REVOKE ALL ON FUNCTION public.beneficiary_data_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beneficiary_data_summary(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.beneficiary_has_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.beneficiary_has_data(uuid) FROM anon, authenticated;

-- ------------------------------------------------------------
-- Panel admin: cargas pendientes con datos del tutor e historial.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_dependents()
RETURNS TABLE (
  dependent_id uuid,
  full_name text,
  rut text,
  birth_date date,
  category text,
  address text,
  weight numeric,
  height numeric,
  dominant_hand text,
  tutor_id uuid,
  tutor_name text,
  tutor_email text,
  tutor_phone text,
  beneficiary_id uuid,
  summary jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT d.id, d.full_name, d.rut, d.birth_date, d.category, d.address,
         d.weight, d.height, d.dominant_hand,
         t.id, t.full_name, t.email, t.phone,
         b.id,
         CASE WHEN b.id IS NULL THEN '{}'::jsonb ELSE public.beneficiary_data_summary(b.id) END
    FROM public.dependents d
    JOIN public.profiles t ON t.id = d.tutor_id
    LEFT JOIN public.beneficiaries b ON b.dependent_id = d.id
   ORDER BY t.full_name, d.full_name;
END;
$$;

-- ------------------------------------------------------------
-- Migrar una carga a una cuenta (solo admin, transaccional).
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
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.dependents%ROWTYPE;
  v_tutor public.profiles%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_dep_bid uuid;
  v_target_bid uuid;
  v_archive_id uuid;
  v_moved jsonb := '{}'::jsonb;
  v_is_minor boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_dep FROM public.dependents WHERE id = p_dependent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La carga no existe o ya fue migrada' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta destino no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_target.role_id <> 4 THEN
    RAISE EXCEPTION 'La cuenta destino debe ser de un alumno' USING ERRCODE = 'P0001';
  END IF;
  IF v_target.id = v_dep.tutor_id THEN
    RAISE EXCEPTION 'La cuenta destino no puede ser la del tutor de la carga' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_tutor FROM public.profiles WHERE id = v_dep.tutor_id;

  SELECT b.id INTO v_dep_bid FROM public.beneficiaries b WHERE b.dependent_id = v_dep.id FOR UPDATE;
  SELECT b.id INTO v_target_bid FROM public.beneficiaries b WHERE b.profile_id = p_profile_id FOR UPDATE;

  -- La cuenta destino debe estar vacía: la fusión de historiales no
  -- está soportada (con 12 cargas se resuelve caso a caso).
  IF v_target_bid IS NOT NULL AND public.beneficiary_has_data(v_target_bid) THEN
    RAISE EXCEPTION 'La cuenta destino ya tiene historial (membresías, asistencia u otros). Usa una cuenta nueva o vacía.'
      USING ERRCODE = 'P0001';
  END IF;

  -- El RUT de la carga no puede pertenecer a OTRA cuenta (índice único).
  IF public.normalize_rut(v_dep.rut) <> ''
     AND public.normalize_rut(v_target.rut) = ''
     AND EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id <> p_profile_id
          AND public.normalize_rut(p.rut) = public.normalize_rut(v_dep.rut)
     ) THEN
    RAISE EXCEPTION 'El RUT de la carga ya pertenece a otra cuenta: migra la carga a esa cuenta.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_dep_bid IS NOT NULL THEN
    v_moved := public.beneficiary_data_summary(v_dep_bid);
    -- Orden obligatorio: liberar UNIQUE(profile_id) y luego re-anclar.
    IF v_target_bid IS NOT NULL THEN
      DELETE FROM public.beneficiaries WHERE id = v_target_bid;
    END IF;
    UPDATE public.beneficiaries
       SET profile_id = p_profile_id, dependent_id = NULL
     WHERE id = v_dep_bid;
  ELSE
    -- Carga sin beneficiario (sin historial posible): la cuenta
    -- conserva el suyo.
    IF v_target_bid IS NULL THEN
      INSERT INTO public.beneficiaries (profile_id) VALUES (p_profile_id)
        RETURNING id INTO v_dep_bid;
    ELSE
      v_dep_bid := v_target_bid;
    END IF;
  END IF;

  -- Completar el perfil con los datos de la carga (solo campos vacíos).
  v_is_minor := v_dep.category IN ('nino', 'juvenil');
  UPDATE public.profiles p
     SET full_name     = CASE WHEN coalesce(trim(p.full_name), '') = '' THEN v_dep.full_name ELSE p.full_name END,
         rut           = CASE WHEN public.normalize_rut(p.rut) = '' AND public.normalize_rut(v_dep.rut) <> '' THEN v_dep.rut ELSE p.rut END,
         birth_date    = coalesce(p.birth_date, v_dep.birth_date),
         address       = coalesce(nullif(trim(p.address), ''), v_dep.address),
         weight        = coalesce(p.weight, v_dep.weight),
         height        = coalesce(p.height, v_dep.height),
         dominant_hand = coalesce(p.dominant_hand, v_dep.dominant_hand),
         guardian_name  = CASE WHEN v_is_minor THEN coalesce(nullif(trim(p.guardian_name), ''), v_tutor.full_name) ELSE p.guardian_name END,
         guardian_phone = CASE WHEN v_is_minor THEN coalesce(nullif(trim(p.guardian_phone), ''), v_tutor.phone) ELSE p.guardian_phone END,
         guardian_email = CASE WHEN v_is_minor THEN coalesce(nullif(trim(p.guardian_email), ''), v_tutor.email) ELSE p.guardian_email END
   WHERE p.id = p_profile_id;

  INSERT INTO public.dependents_archive (
    dependent_id, tutor_id, full_name, rut, birth_date, category, address,
    weight, height, dominant_hand, dependent_created_at, dependent_updated_at,
    beneficiary_id, migrated_to_profile_id, migrated_by, moved_summary
  ) VALUES (
    v_dep.id, v_dep.tutor_id, v_dep.full_name, v_dep.rut, v_dep.birth_date, v_dep.category, v_dep.address,
    v_dep.weight, v_dep.height, v_dep.dominant_hand, v_dep.created_at, v_dep.updated_at,
    v_dep_bid, p_profile_id, auth.uid(), v_moved
  ) RETURNING id INTO v_archive_id;

  -- Seguro: el beneficiario ya no apunta a la carga, el CASCADE no lo toca.
  DELETE FROM public.dependents WHERE id = v_dep.id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'migrate_dependent', 'dependents', v_dep.id,
          jsonb_build_object('archive_id', v_archive_id, 'profile_id', p_profile_id,
                             'beneficiary_id', v_dep_bid, 'tutor_id', v_dep.tutor_id, 'moved', v_moved));

  INSERT INTO public.user_notifications (user_id, title, content)
  VALUES (v_dep.tutor_id, 'Cuenta propia para ' || v_dep.full_name,
          FORMAT('%s ahora tiene su propia cuenta en ZonaElite (%s). Sus membresías, asistencia e historial se trasladaron a esa cuenta.',
                 v_dep.full_name, v_target.email));

  INSERT INTO public.user_notifications (user_id, title, content)
  VALUES (p_profile_id, 'Tu historial ya está en tu cuenta',
          'Trasladamos a tu cuenta tus membresías, asistencia e historial que antes estaban como carga de tu apoderado.');

  RETURN QUERY SELECT v_archive_id, v_dep_bid, v_moved;
END;
$$;

-- ------------------------------------------------------------
-- Revertir una migración (solo admin). Solo si la cuenta no generó
-- historial nuevo desde la migración.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_dependent_migration(p_archive_id uuid)
RETURNS TABLE (
  dependent_id uuid,
  beneficiary_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arc public.dependents_archive%ROWTYPE;
  v_now jsonb;
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_arc FROM public.dependents_archive WHERE id = p_archive_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Migración no encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_arc.reverted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta migración ya fue revertida' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dependents WHERE id = v_arc.dependent_id) THEN
    RAISE EXCEPTION 'La carga ya existe de nuevo' USING ERRCODE = 'P0001';
  END IF;

  -- El beneficiario debe seguir anclado a la cuenta migrada.
  PERFORM 1 FROM public.beneficiaries b
   WHERE b.id = v_arc.beneficiary_id AND b.profile_id = v_arc.migrated_to_profile_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El historial ya no está en la cuenta migrada; no se puede revertir' USING ERRCODE = 'P0001';
  END IF;

  -- Sin historial nuevo: ningún contador puede haber crecido.
  v_now := public.beneficiary_data_summary(v_arc.beneficiary_id);
  FOR v_key IN SELECT jsonb_object_keys(v_now) LOOP
    IF v_key <> 'memberships_active'
       AND (v_now->>v_key)::int > coalesce((v_arc.moved_summary->>v_key)::int, 0) THEN
      RAISE EXCEPTION 'La cuenta ya registró historial nuevo (%); no se puede revertir', v_key
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.dependents (id, tutor_id, full_name, rut, birth_date, category,
                                 address, weight, height, dominant_hand, created_at)
  VALUES (v_arc.dependent_id, v_arc.tutor_id, v_arc.full_name, v_arc.rut, v_arc.birth_date,
          v_arc.category, v_arc.address, v_arc.weight, v_arc.height, v_arc.dominant_hand,
          coalesce(v_arc.dependent_created_at, now()));

  -- trg_dependents_create_beneficiary creó uno vacío: se descarta.
  DELETE FROM public.beneficiaries b
   WHERE b.dependent_id = v_arc.dependent_id AND b.id <> v_arc.beneficiary_id;

  UPDATE public.beneficiaries
     SET profile_id = NULL, dependent_id = v_arc.dependent_id
   WHERE id = v_arc.beneficiary_id;

  -- La cuenta vuelve a tener su propio beneficiario vacío.
  INSERT INTO public.beneficiaries (profile_id) VALUES (v_arc.migrated_to_profile_id);

  UPDATE public.dependents_archive
     SET reverted_at = now(), reverted_by = auth.uid()
   WHERE id = v_arc.id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'revert_dependent_migration', 'dependents', v_arc.dependent_id,
          jsonb_build_object('archive_id', v_arc.id, 'profile_id', v_arc.migrated_to_profile_id,
                             'beneficiary_id', v_arc.beneficiary_id));

  RETURN QUERY SELECT v_arc.dependent_id, v_arc.beneficiary_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_dependents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pending_dependents() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pending_dependents() TO authenticated;

REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revert_dependent_migration(uuid) TO authenticated;
