-- ============================================================
-- 035_security_hardening.sql
-- Endurecimiento de seguridad de la BD real (auditoría 2026-10-16,
-- contexto/auditoria-esquema-real.md, hallazgos S-1…S-6, F-1, F-2).
-- Requisito + análisis de impacto: contexto/requisitos/hardening-seguridad-bd.md
--
-- Contexto: hay dos canales para obtener beneficios (transferencia
-- validada por el admin y Flow). Ambos escriben `payments` desde el
-- servidor con el service role, y la asignación manual del admin usa
-- `payments_staff_write`, así que las policies de escritura de
-- usuario que se eliminan aquí no las usa ningún flujo legítimo.
--
-- Idempotente: DROP ... IF EXISTS + CREATE, CREATE OR REPLACE,
-- CREATE INDEX IF NOT EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- S-1: un usuario no puede cambiar su propio rol, estado, email ni id.
-- La policy profiles_update_own_or_admin no tiene WITH CHECK y el rol
-- authenticated tiene UPDATE sobre todas las columnas, así que el
-- bloqueo se hace con un trigger. is_admin() lee la fila ya
-- confirmada (el rol anterior), por lo que no se puede autoconceder.
-- auth.uid() nulo = service role / SQL Editor -> se permite.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role_id IS DISTINCT FROM OLD.role_id
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'No tienes permisos para modificar el rol, el estado o el correo de la cuenta'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_protect_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- S-2: el usuario ya no escribe pagos desde el browser.
-- create-order (Flow) escribe con el service role; transfer/review
-- también. El admin conserva payments_staff_write.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "payments_user_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_owner_update_flow" ON public.payments;
DROP POLICY IF EXISTS "payments_flow_update" ON public.payments;

-- Lookup del callback de Flow por token.
CREATE INDEX IF NOT EXISTS idx_payments_flow_token ON public.payments(flow_token);

-- ------------------------------------------------------------
-- S-3: sin inscripciones/desinscripciones directas del alumno.
-- Alumno -> RPC enroll_class (SECURITY DEFINER, valida membresía,
-- matrícula y aforo). QR -> /api/checkin (service role).
-- Admin -> enrollments_admin_all + RPC cancel_class_enrollment.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_own_insert" ON public.class_enrollments;
DROP POLICY IF EXISTS "enrollments_own_delete" ON public.class_enrollments;
DROP POLICY IF EXISTS "class_enrollments_insert_admin_or_self" ON public.class_enrollments;

-- ------------------------------------------------------------
-- S-4: escritura en el bucket "public" solo para el admin.
-- Los vouchers de transferencia se suben con el service role
-- (policy "Service role full access", que se mantiene).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

DROP POLICY IF EXISTS "public_bucket_admin_insert" ON storage.objects;
CREATE POLICY "public_bucket_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public' AND public.is_admin());

DROP POLICY IF EXISTS "public_bucket_admin_update" ON storage.objects;
CREATE POLICY "public_bucket_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'public' AND public.is_admin())
  WITH CHECK (bucket_id = 'public' AND public.is_admin());

DROP POLICY IF EXISTS "public_bucket_admin_delete" ON storage.objects;
CREATE POLICY "public_bucket_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'public' AND public.is_admin());

-- ------------------------------------------------------------
-- S-5: nadie inserta notificaciones personales desde el browser.
-- flow-helpers usa el service role; notify_token_return y
-- cancel_class_enrollment son SECURITY DEFINER.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.user_notifications;

-- ------------------------------------------------------------
-- S-6: roles con RLS (solo lectura pública).
-- ------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_public_read" ON public.roles;
CREATE POLICY "roles_public_read" ON public.roles FOR SELECT USING (true);

-- ------------------------------------------------------------
-- F-1: alertas de sistema al staff (notifyPaymentWithoutMembership,
-- aviso de nueva transferencia) usan type='sistema' / target='staff'.
-- ------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('correo_masivo', 'aviso', 'recordatorio', 'comunicado', 'sistema'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_check
  CHECK (target IN ('todos', 'segmento', 'staff'));

-- ------------------------------------------------------------
-- F-2: método "cortesia" (ofrecido en /admin/inscripciones).
-- ------------------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('efectivo', 'transferencia', 'flow', 'otro', 'cortesia'));
