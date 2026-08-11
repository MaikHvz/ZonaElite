-- =============================================================
-- Migración 004 — RPC enroll_class (B-006)
-- Capacidad de clase validada SERVER-SIDE, atómica y con lock.
--
-- Problema: EnrollModal validaba capacity solo en el cliente
-- (remaining = capacity - enrolled). Dos usuarios inscribiéndose
-- en paralelo al último cupo sobrepasaban el aforo.
--
-- Solución: RPC transaccional que serializa por sesión con
-- SELECT ... FOR UPDATE y valida en una sola operación:
--   1. La sesión existe y no está en el pasado (session_date >=
--      chile_today()). NOTA: NO se exige status='activa' porque
--      generate-sessions crea sesiones futuras como 'cerrada'
--      y el admin las activa al momento de la clase (checkin);
--      exigir el status rompería la inscripción anticipada.
--   2. El beneficiario pertenece al usuario (owns_beneficiary)
--      o es admin.
--   3. Tiene membresía activa vigente y inscripción de academia
--      vigente (misma regla que la policy de INSERT).
--   4. No supera la capacidad de la sesión (aforo).
--   5. No está ya inscrito (idempotente: success=true).
--
-- El cliente (EnrollModal) reemplaza el insert directo por esta
-- RPC y muestra los errores por beneficiario (CLASS_FULL, etc.).
--
-- Volatility: VOLATILE (NO STABLE) porque la función hace
-- SELECT ... FOR UPDATE (lock de la sesión) e INSERT. PostgreSQL
-- lanza "SELECT FOR UPDATE is not allowed in a non-volatile
-- function" si se declara STABLE/IMMUTABLE.
-- =============================================================

CREATE OR REPLACE FUNCTION public.enroll_class(
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
  v_is_admin boolean;
  v_bid uuid;
  v_membership_ok boolean;
  v_enrollment_ok boolean;
BEGIN
  SELECT s.capacity, cs.session_date, cs.schedule_id
    INTO v_capacity, v_session_date, v_schedule_id
    FROM public.class_sessions cs
    JOIN public.schedules s ON s.id = cs.schedule_id
    WHERE cs.id = p_session_id;

  IF v_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_session_date < public.chile_today() THEN
    RAISE EXCEPTION 'La sesión ya pasó' USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.is_admin();

  -- Lock de la sesión: serializa el conteo de cupos entre
  -- transacciones concurrentes (B-006).
  PERFORM 1 FROM public.class_sessions WHERE id = p_session_id FOR UPDATE;

  SELECT count(*) INTO v_enrolled
    FROM public.class_enrollments
    WHERE session_id = p_session_id;

  FOREACH v_bid IN ARRAY p_beneficiary_ids LOOP
    -- Idempotente: si ya está inscrito, success=true.
    IF EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.session_id = p_session_id AND ce.beneficiary_id = v_bid
    ) THEN
      RETURN QUERY SELECT v_bid, true, NULL, 'Ya inscrito';
      CONTINUE;
    END IF;

    -- Autorización: solo admin o dueño del beneficiario.
    IF NOT (v_is_admin OR public.owns_beneficiary(v_bid)) THEN
      RETURN QUERY SELECT v_bid, false, 'UNAUTHORIZED', 'No tienes acceso a este beneficiario';
      CONTINUE;
    END IF;

    -- Membresía activa vigente (fecha chilena, B-005).
    SELECT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.beneficiary_id = v_bid
        AND m.status = 'activa'
        AND m.end_date >= public.chile_today()
    ) INTO v_membership_ok;
    IF NOT v_membership_ok THEN
      RETURN QUERY SELECT v_bid, false, 'NO_MEMBERSHIP', 'Sin membresía activa';
      CONTINUE;
    END IF;

    -- Inscripción de academia activa vigente.
    SELECT EXISTS (
      SELECT 1 FROM public.academy_enrollments ae
      WHERE ae.beneficiary_id = v_bid
        AND ae.status = 'activa'
        AND ae.end_date >= public.chile_today()
    ) INTO v_enrollment_ok;
    IF NOT v_enrollment_ok THEN
      RETURN QUERY SELECT v_bid, false, 'NO_ENROLLMENT', 'Sin inscripción a la academia';
      CONTINUE;
    END IF;

    -- Aforo: la sesión no debe superar su capacidad.
    IF v_enrolled >= v_capacity THEN
      RETURN QUERY SELECT v_bid, false, 'CLASS_FULL', 'Clase llena';
      CONTINUE;
    END IF;

    INSERT INTO public.class_enrollments (session_id, beneficiary_id, source)
    VALUES (p_session_id, v_bid, 'horarios');

    v_enrolled := v_enrolled + 1;
    RETURN QUERY SELECT v_bid, true, NULL, 'Inscrito';
  END LOOP;
END;
$$;

-- Exponer solo a usuarios autenticados (la función valida todo por dentro).
REVOKE ALL ON FUNCTION public.enroll_class(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_class(UUID, UUID[]) TO authenticated;
