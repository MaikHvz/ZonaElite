-- ============================================================
-- 044_membership_renewal_requests.sql
-- Solicitudes de renovación de membresía (v1.14.0).
-- Requisito + impacto: contexto/requisitos/ficha-usuario-y-renovacion.md
--
-- - El alumno con la membresía vencida (y sin otra activa) pide la
--   renovación desde su panel; el admin la renueva o la rechaza.
-- - Auto-aceptación: si al beneficiario se le inserta una membresía
--   activa por CUALQUIER vía (renovar, asignar, transferencia, Flow),
--   sus solicitudes pendientes se aprueban solas y quedan vinculadas
--   (trigger AFTER INSERT ON memberships).
-- - Escritura solo por RPC SECURITY DEFINER; RLS solo lectura.
-- - Supabase da EXECUTE directo a anon/authenticated: se revoca
--   explícitamente (lección de la migración 039).
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.membership_renewal_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  previous_membership_id uuid,
  plan_id uuid NOT NULL,
  note text,
  status text DEFAULT 'pendiente' NOT NULL,
  resolved_membership_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  admin_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT membership_renewal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT membership_renewal_requests_status_check
    CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  CONSTRAINT membership_renewal_requests_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT membership_renewal_requests_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT membership_renewal_requests_previous_fkey
    FOREIGN KEY (previous_membership_id) REFERENCES public.memberships(id) ON DELETE SET NULL,
  CONSTRAINT membership_renewal_requests_plan_fkey
    FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id),
  CONSTRAINT membership_renewal_requests_resolved_membership_fkey
    FOREIGN KEY (resolved_membership_id) REFERENCES public.memberships(id) ON DELETE SET NULL,
  CONSTRAINT membership_renewal_requests_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.profiles(id)
);

-- Una sola solicitud pendiente por beneficiario.
CREATE UNIQUE INDEX IF NOT EXISTS membership_renewal_one_pending_idx
  ON public.membership_renewal_requests (beneficiary_id)
  WHERE status = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_membership_renewal_status
  ON public.membership_renewal_requests (status, created_at DESC);

ALTER TABLE public.membership_renewal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membership_renewal_select_own_or_admin" ON public.membership_renewal_requests;
CREATE POLICY "membership_renewal_select_own_or_admin" ON public.membership_renewal_requests
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());

-- ------------------------------------------------------------
-- Alumno: pedir la renovación de su membresía vencida.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_membership_renewal(
  p_beneficiary_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last public.memberships%ROWTYPE;
  v_plan_name text;
  v_name text;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.owns_beneficiary(p_beneficiary_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este alumno' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.beneficiary_id = p_beneficiary_id
       AND m.status = 'activa'
       AND m.end_date >= public.chile_today()
  ) THEN
    RAISE EXCEPTION 'Ya tienes una membresía activa' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.membership_renewal_requests r
     WHERE r.beneficiary_id = p_beneficiary_id AND r.status = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya enviaste una solicitud de renovación; la academia la está revisando' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_last
    FROM public.memberships m
   WHERE m.beneficiary_id = p_beneficiary_id
   ORDER BY m.end_date DESC, m.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes una membresía anterior para renovar' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.membership_renewal_requests (beneficiary_id, requested_by, previous_membership_id, plan_id, note)
  VALUES (p_beneficiary_id, auth.uid(), v_last.id, v_last.plan_id, nullif(trim(coalesce(p_note, '')), ''))
  RETURNING id INTO v_request_id;

  SELECT name INTO v_plan_name FROM public.membership_plans WHERE id = v_last.plan_id;
  SELECT coalesce(p.full_name, 'Alumno') INTO v_name
    FROM public.beneficiaries b LEFT JOIN public.profiles p ON p.id = b.profile_id
   WHERE b.id = p_beneficiary_id;

  INSERT INTO public.notifications (type, subject, content, target, sent_by, sent_at)
  VALUES ('sistema', 'Solicitud de renovación de membresía',
          FORMAT('%s solicita renovar su membresía "%s". Revísala en Membresías.', v_name, coalesce(v_plan_name, 'Plan')),
          'staff', auth.uid(), now());

  RETURN v_request_id;
END;
$$;

-- ------------------------------------------------------------
-- Alumno: cancelar su solicitud pendiente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_membership_renewal(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.membership_renewal_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.membership_renewal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.owns_beneficiary(v_req.beneficiary_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'No tienes acceso a esta solicitud' USING ERRCODE = '42501';
  END IF;
  IF v_req.status <> 'pendiente' THEN
    RETURN false;
  END IF;

  UPDATE public.membership_renewal_requests
     SET status = 'cancelada', resolved_at = now(), resolved_by = auth.uid()
   WHERE id = p_request_id;
  RETURN true;
END;
$$;

-- ------------------------------------------------------------
-- Admin: rechazar una solicitud (con motivo visible para el alumno).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_membership_renewal(p_request_id uuid, p_admin_note text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.membership_renewal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.membership_renewal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_req.status <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.membership_renewal_requests
     SET status = 'rechazada',
         admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
         resolved_at = now(),
         resolved_by = auth.uid()
   WHERE id = p_request_id;

  INSERT INTO public.user_notifications (user_id, title, content)
  VALUES (v_req.requested_by, 'Solicitud de renovación rechazada',
          'La academia no pudo procesar tu solicitud de renovación de membresía.'
          || CASE WHEN nullif(trim(coalesce(p_admin_note, '')), '') IS NOT NULL
                  THEN E'\nMotivo: ' || trim(p_admin_note) ELSE '' END);
  RETURN true;
END;
$$;

-- ------------------------------------------------------------
-- Auto-aceptación: cualquier membresía activa nueva resuelve las
-- solicitudes pendientes del beneficiario.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_renewal_requests_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_plan_name text;
BEGIN
  IF NEW.status <> 'activa' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_plan_name FROM public.membership_plans WHERE id = NEW.plan_id;

  FOR v_req IN
    UPDATE public.membership_renewal_requests
       SET status = 'aprobada',
           resolved_membership_id = NEW.id,
           resolved_at = now(),
           resolved_by = auth.uid()
     WHERE beneficiary_id = NEW.beneficiary_id
       AND status = 'pendiente'
    RETURNING requested_by
  LOOP
    INSERT INTO public.user_notifications (user_id, title, content)
    VALUES (v_req.requested_by, 'Membresía renovada',
            FORMAT('Tu solicitud de renovación fue aprobada: membresía "%s" vigente del %s al %s.',
                   coalesce(v_plan_name, 'Plan'),
                   TO_CHAR(NEW.start_date, 'DD/MM/YYYY'),
                   TO_CHAR(NEW.end_date, 'DD/MM/YYYY')));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_resolve_renewals ON public.memberships;
CREATE TRIGGER trg_memberships_resolve_renewals
  AFTER INSERT ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.resolve_renewal_requests_on_membership();

REVOKE ALL ON FUNCTION public.request_membership_renewal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_membership_renewal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_membership_renewal(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_membership_renewal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_membership_renewal(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_membership_renewal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_membership_renewal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_membership_renewal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_membership_renewal(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_renewal_requests_on_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_renewal_requests_on_membership() FROM anon, authenticated;
