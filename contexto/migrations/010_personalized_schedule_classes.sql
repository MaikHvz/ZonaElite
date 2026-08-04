-- ============================================================
-- 010_personalized_schedule_classes.sql
-- Clases de Horario para Modalidad Personalizada — Módulo independiente
-- Extiende schedules con modalidad (legacy = 'normal') y agrega
-- tablas/RPC propios. NO toca class_enrollments/enroll_class/
-- checkin/tokens/membresías. Idempotente en lo posible.
-- ============================================================

-- 1. Modalidad en schedules (default 'normal' -> filas legacy intactas)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedules_mode_check'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_mode_check
      CHECK (mode IN ('normal', 'personalizado'));
  END IF;
END $$;

-- 2. Enlace schedule <-> planes personalizados (vacío = todos permitidos)
CREATE TABLE IF NOT EXISTS public.personalized_schedule_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id) ON DELETE CASCADE,
  CONSTRAINT personalized_schedule_plans_pkey PRIMARY KEY (id)
);

-- 3. Inscripciones de personalizadas (no toca class_enrollments)
CREATE TABLE IF NOT EXISTS public.personalized_enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.personalized_packs(id),
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT personalized_enrollments_session_beneficiary_unique UNIQUE (session_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_personalized_schedule_plans_schedule ON public.personalized_schedule_plans(schedule_id);
CREATE INDEX IF NOT EXISTS idx_personalized_schedule_plans_plan ON public.personalized_schedule_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_personalized_enrollments_session ON public.personalized_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_personalized_enrollments_beneficiary ON public.personalized_enrollments(beneficiary_id);

-- RLS
ALTER TABLE public.personalized_schedule_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_schedule_plans_select_all" ON public.personalized_schedule_plans FOR SELECT USING (true);
CREATE POLICY "personalized_schedule_plans_admin_write" ON public.personalized_schedule_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_enrollments_select_own_or_admin" ON public.personalized_enrollments FOR SELECT USING (
  public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_enrollments_admin_write" ON public.personalized_enrollments FOR ALL USING (public.is_admin());

-- ============================================================
-- RPC enroll_personalized_class: inscripción con consumo atómico
-- de pack (equivalente desacoplado de enroll_class). Volatility
-- VOLATILE porque escribe (a diferencia de enroll_class que es
-- STABLE en el repo; aquí se usa el valor semánticamente correcto).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enroll_personalized_class(
  p_session_id uuid,
  p_beneficiary_ids uuid[]
)
RETURNS TABLE (
  beneficiary_id uuid,
  success boolean,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_capacity integer;
  v_enrolled bigint;
  v_session_date date;
  v_schedule_id uuid;
  v_schedule_mode text;
  v_is_admin boolean;
  v_bid uuid;
  v_pack_id uuid;
  v_pack_plan_id uuid;
  v_plan_allowed boolean;
BEGIN
  SELECT s.capacity, cs.session_date, cs.schedule_id, s.mode
    INTO v_capacity, v_session_date, v_schedule_id, v_schedule_mode
    FROM public.class_sessions cs
    JOIN public.schedules s ON s.id = cs.schedule_id
    WHERE cs.id = p_session_id;

  IF v_schedule_id IS NULL OR v_schedule_mode IS DISTINCT FROM 'personalizado' THEN
    RAISE EXCEPTION 'Sesión no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_session_date < public.chile_today() THEN
    RAISE EXCEPTION 'La sesión ya pasó' USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.is_admin();

  -- Lock de la sesión: serializa el conteo de cupos (mismo patrón B-006).
  PERFORM 1 FROM public.class_sessions WHERE id = p_session_id FOR UPDATE;

  SELECT count(*) INTO v_enrolled
    FROM public.personalized_enrollments
    WHERE session_id = p_session_id;

  FOREACH v_bid IN ARRAY p_beneficiary_ids LOOP
    -- Idempotente: si ya está inscrito, success=true.
    IF EXISTS (
      SELECT 1 FROM public.personalized_enrollments pe
      WHERE pe.session_id = p_session_id AND pe.beneficiary_id = v_bid
    ) THEN
      RETURN QUERY SELECT v_bid, true, NULL, 'Ya inscrito';
      CONTINUE;
    END IF;

    -- Autorización: solo admin o dueño del beneficiario.
    IF NOT (v_is_admin OR public.owns_beneficiary(v_bid)) THEN
      RETURN QUERY SELECT v_bid, false, 'UNAUTHORIZED', 'No tienes acceso a este beneficiario';
      CONTINUE;
    END IF;

    -- Pack activo con clases disponibles (el más próximo a vencer).
    SELECT p.id, p.plan_id
      INTO v_pack_id, v_pack_plan_id
      FROM public.personalized_packs p
      WHERE p.beneficiary_id = v_bid
        AND p.status = 'activa'
        AND p.end_date >= public.chile_today()
        AND p.used_classes < p.total_classes
      ORDER BY p.end_date
      LIMIT 1;

    IF v_pack_id IS NULL THEN
      RETURN QUERY SELECT v_bid, false, 'NO_PACK', 'Sin pack activo de clases personalizadas';
      CONTINUE;
    END IF;

    -- Restricción de plan: si la clase define planes permitidos, el plan
    -- del pack debe estar entre ellos. Vacío = todos permitidos.
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM public.personalized_schedule_plans psp
        WHERE psp.schedule_id = v_schedule_id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.personalized_schedule_plans psp
        WHERE psp.schedule_id = v_schedule_id AND psp.plan_id = v_pack_plan_id
      ) THEN false
      ELSE true
    END INTO v_plan_allowed;

    IF NOT v_plan_allowed THEN
      RETURN QUERY SELECT v_bid, false, 'PLAN_NOT_ALLOWED', 'Tu plan no está habilitado para esta clase';
      CONTINUE;
    END IF;

    -- Aforo.
    IF v_enrolled >= v_capacity THEN
      RETURN QUERY SELECT v_bid, false, 'CLASS_FULL', 'Clase llena';
      CONTINUE;
    END IF;

    -- Consumo atómico del pack: el UPDATE toma el lock de fila y solo
    -- descuenta si aún hay clases; re-evalúa contra la fila actual.
    UPDATE public.personalized_packs
      SET used_classes = used_classes + 1,
          status = CASE WHEN used_classes + 1 >= total_classes THEN 'agotada' ELSE status END
      WHERE id = v_pack_id
        AND status = 'activa'
        AND end_date >= public.chile_today()
        AND used_classes < total_classes;

    IF NOT FOUND THEN
      RETURN QUERY SELECT v_bid, false, 'NO_PACK', 'El pack ya no tiene clases disponibles';
      CONTINUE;
    END IF;

    INSERT INTO public.personalized_enrollments (session_id, beneficiary_id, pack_id)
    VALUES (p_session_id, v_bid, v_pack_id);

    v_enrolled := v_enrolled + 1;
    RETURN QUERY SELECT v_bid, true, NULL, 'Inscrito';
  END LOOP;
END;
$$;

-- Exponer solo a usuarios autenticados (la función valida todo por dentro).
REVOKE ALL ON FUNCTION public.enroll_personalized_class(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_personalized_class(UUID, UUID[]) TO authenticated;
