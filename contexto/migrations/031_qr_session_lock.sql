-- ============================================================
-- 031_qr_session_lock.sql
-- Contraseña de protección para la pantalla de sesión QR de
-- asistencia (/admin/asistencia).
--
-- Tabla singleton con el hash scrypt de la contraseña. La fila
-- NO se crea en esta migración: si no existe, el panel QR
-- funciona sin protección (fail-open) y la UI lo avisa.
--
-- Por qué NO en academy_settings: esa tabla tiene el policy
--   academy_settings_select_all ... USING (true)
-- o sea que cualquier cliente REST (incluso anónimo) puede
-- leer sus columnas. Un hash de contraseña nunca puede vivir
-- ahí. Acá la única policy es admin-only.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP/CREATE
-- POLICY + trigger reusado update_updated_at().
-- ============================================================

CREATE TABLE IF NOT EXISTS public.qr_session_lock (
  id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid,
  CONSTRAINT qr_session_lock_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.qr_session_lock IS
  'Contraseña (hash scrypt) que protege la pantalla de sesión QR en /admin/asistencia. Singleton: la existencia de la fila indica que la protección está activa.';

ALTER TABLE public.qr_session_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_session_lock_admin_all" ON public.qr_session_lock;
CREATE POLICY "qr_session_lock_admin_all" ON public.qr_session_lock
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS qr_session_lock_updated_at ON public.qr_session_lock;
CREATE TRIGGER qr_session_lock_updated_at
  BEFORE UPDATE ON public.qr_session_lock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
