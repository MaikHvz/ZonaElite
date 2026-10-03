-- ============================================================
-- 033_event_attendees.sql
-- Lista de asistencia por evento: el usuario (y sus cargas) se
-- inscribe desde /eventos/[id] y el administrador ve/gestiona esa
-- lista desde /admin/eventos.
--
-- Decisiones de diseño (ver contexto/requisitos/lista-asistencia-eventos.md):
-- - El ancla es beneficiaries (titular + cargas), igual que
--   memberships / attendance / class_enrollments / academy_enrollments.
-- - NO consume tokens ni exige membresía o inscripción a la academia
--   (un evento es actividad de comunidad, no una clase de horario).
-- - SIN aforo: events no tiene columna de capacidad.
-- - Escritura SOLO por RPC SECURITY DEFINER: no hay policies
--   INSERT/UPDATE/DELETE, así que el browser client no puede
--   escribir directo aunque alguien manipule el front.
-- - Módulo DESACOPLADO: no toca class_enrollments, personalized_
--   enrollments, attendance, debts ni memberships.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY +
-- CREATE OR REPLACE FUNCTION.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  beneficiary_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT event_attendees_event_beneficiary_key UNIQUE (event_id, beneficiary_id),
  -- CASCADE: borrar el evento en /admin/eventos limpia su lista.
  CONSTRAINT event_attendees_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_attendees_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id)
);

COMMENT ON TABLE public.event_attendees IS
  'Lista de asistencia por evento: beneficiario (titular o carga) inscrito en un evento de public.events. La escritura pasa solo por enroll_event / cancel_event_attendance.';

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id
  ON public.event_attendees (event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_beneficiary_id
  ON public.event_attendees (beneficiary_id);

-- ------------------------------------------------------------
-- RLS: SOLO lectura desde el cliente.
-- El usuario ve sus propias filas (él y sus cargas) para poder
-- mostrar el CTA "Inscrito"; staff/admin ve todas para mostrar la
-- lista en el panel. Sin policy INSERT/UPDATE/DELETE -> la
-- escritura es exclusiva de las RPC (SECURITY DEFINER).
-- ------------------------------------------------------------
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_attendees_select_own_or_staff" ON public.event_attendees;
CREATE POLICY "event_attendees_select_own_or_staff" ON public.event_attendees
  FOR SELECT
  USING (public.is_staff() OR public.owns_beneficiary(beneficiary_id));

-- ------------------------------------------------------------
-- RPC enroll_event: alta en la lista de asistencia de un evento.
-- Espejo de enroll_class (migración 004): idempotente, con
-- autorización por beneficiario y sin aforo.
-- Devuelve una fila por beneficiario con el resultado individual.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_event(
  p_event_id uuid,
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
  v_is_admin boolean;
  v_event_date date;
  v_bid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para inscribirte a un evento' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.event_date
    INTO v_event_date
    FROM public.events e
    WHERE e.id = p_event_id;

  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Evento no encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- No se puede pasar lista de un evento que ya ocurrió.
  IF v_event_date < public.chile_today() THEN
    RAISE EXCEPTION 'Este evento ya fue' USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.is_admin();

  -- Guard de concurrencia (mismo patrón B-006 que enroll_class).
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  FOREACH v_bid IN ARRAY p_beneficiary_ids LOOP
    -- Idempotencia: doble clic o reintento no duplica ni falla.
    IF EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = p_event_id AND beneficiary_id = v_bid
    ) THEN
      RETURN QUERY SELECT v_bid, true, NULL, 'Ya inscrito';
      CONTINUE;
    END IF;

    -- Autorización: admin, o el propio titular/carga del beneficiario.
    IF NOT (v_is_admin OR public.owns_beneficiary(v_bid)) THEN
      RETURN QUERY SELECT v_bid, false, 'UNAUTHORIZED',
        'No tienes acceso a este beneficiario';
      CONTINUE;
    END IF;

    INSERT INTO public.event_attendees (event_id, beneficiary_id)
      VALUES (p_event_id, v_bid);

    RETURN QUERY SELECT v_bid, true, NULL, 'Inscrito';
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_event(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_event(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.enroll_event(UUID, UUID[]) IS
  'Inscribe uno o varios beneficiarios en la lista de asistencia de un evento. Idempotente (ya inscrito devuelve success sin error), valida que el evento exista y no haya pasado, y exige is_admin() u owns_beneficiary(). No consume tokens ni exige membresía.';

-- ------------------------------------------------------------
-- RPC cancel_event_attendance: baja de la lista de asistencia.
-- Dos autores: el admin (panel /admin/eventos) y el propio
-- titular/carga (quien pasa el mouse por sobre "Inscrito" y
-- pulsa "Eliminar asistencia").
-- Idempotente: si no estaba, devuelve removed=false con mensaje.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_event_attendance(
  p_event_id uuid,
  p_beneficiary_id uuid
)
RETURNS TABLE (
  removed boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_event_date date;
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para modificar tu asistencia' USING ERRCODE = 'P0001';
  END IF;

  -- Autorización: admin (panel) o el dueño del beneficiario (usuario).
  IF NOT (public.is_admin() OR public.owns_beneficiary(p_beneficiary_id)) THEN
    RAISE EXCEPTION 'No tienes acceso a este beneficiario' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.event_date
    INTO v_event_date
    FROM public.events e
    WHERE e.id = p_event_id;

  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Evento no encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- La lista de un evento que ya ocurrió es histórica: no se toca.
  IF v_event_date < public.chile_today() THEN
    RAISE EXCEPTION 'Este evento ya fue y su lista es histórica' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.event_attendees
    WHERE event_id = p_event_id
      AND beneficiary_id = p_beneficiary_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN QUERY SELECT false, 'Ese beneficiario no estaba en la lista de asistencia';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Participación eliminada de la lista de asistencia';
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_event_attendance(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_event_attendance(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_event_attendance(UUID, UUID) IS
  'Elimina a un beneficiario de la lista de asistencia de un evento. Autorizado para is_admin() (panel admin) y para owns_beneficiary() (el usuario saca su propia participación). Idempotente y bloqueado para eventos ya ocurridos.';