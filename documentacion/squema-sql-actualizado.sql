-- =====================================================================
-- SCHEMA COMPLETO DE LA BASE DE DATOS: ZonaElite
-- Proyecto: sfkkfcticgqdqvzthimz
-- Generado automaticamente desde PostgREST OpenAPI + contexto SQL
--
-- ADVERTENCIA (auditoría 2026-10-16, contexto/auditoria-esquema-real.md):
-- tablas y columnas coinciden con la BD real, pero las POLICIES RLS,
-- TRIGGERS, CHECK e índices de este archivo NO reflejan producción
-- (allí tienen otros nombres/definiciones). Para RLS consultar la BD
-- real. La migración 035 (al final) sí está escrita contra la BD real.
-- =====================================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================
-- Nota: Supabase no expone ENUMs via PostgREST.
-- Los valores de texto se usan en lugar de ENUMs nativos:
--   dependents.category: 'nino' | 'juvenil' | 'adulto'
-- membership_plans.category: 'adulto' | 'nino' | 'juvenil'
--   schedules.category: text[] — '{ninos}' | '{juveniles}' | '{adultos}' | '{ninos,juveniles,adultos}'
--   attendance.status: 'presente' | 'ausente' | 'justificado'
--   blog_posts.status: 'borrador' | 'publicado' | 'programado'
--   product_orders.status: 'borrador' | 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado'
--   (valores siguientes verificados contra los CHECK de la BD real, 2026-10-16)
--   payments.status: 'pendiente' | 'pagado' | 'rechazado' | 'expirado' | 'cancelado'
--   payments.method: 'efectivo' | 'transferencia' | 'flow' | 'otro' | 'cortesia' (cortesia desde 035)
--   memberships.status: 'activa' | 'vencida' | 'cancelada'
--   notifications.type: 'correo_masivo' | 'aviso' | 'recordatorio' | 'comunicado' | 'sistema' (sistema desde 035)
--   notifications.target: 'todos' | 'segmento' | 'staff' (staff desde 035)
--   events.type: 'torneo' | 'graduacion' | 'seminario' | 'clase_especial'
--   academy_enrollments.status: 'activa' | 'vencida' | 'cancelada'

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Verifica si el usuario actual tiene role_id = 1 (admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_id = 1
  );
$$;

-- Verifica si el usuario actual es staff (role_id IN (1,2,3))
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_id IN (1, 2, 3)
  );
$$;

-- Verifica si el usuario es dueÃ±o de un beneficiario
CREATE OR REPLACE FUNCTION public.owns_beneficiary(b_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beneficiaries
    WHERE id = b_id AND (
      profile_id = auth.uid() OR
      dependent_id IN (
        SELECT id FROM public.dependents WHERE tutor_id = auth.uid()
      )
    )
  );
$$;

-- Fecha de hoy en America/Santiago (para policies RLS y defaults
-- que dependen del dÃ­a local; current_date serÃ­a UTC en el servidor).
CREATE OR REPLACE FUNCTION public.chile_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/Santiago', now()))::date;
$$;

-- Migración 022: vencimiento automático de beneficios (membresías,
-- inscripciones a la academia y packs de clases personalizadas).
-- Pasa a 'vencida' todo beneficio 'activa' con end_date anterior a hoy
-- (fecha chilena). Idempotente y transaccional; SECURITY DEFINER.
-- Ejecutado best-effort por la app al cargar el dashboard.
CREATE OR REPLACE FUNCTION public.expire_benefits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_total integer := 0;
  v_updated integer;
BEGIN
  UPDATE public.memberships
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  UPDATE public.academy_enrollments
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  UPDATE public.personalized_packs
     SET status = 'vencida'
   WHERE status = 'activa'
     AND end_date < public.chile_today();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_benefits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_benefits() TO authenticated;

-- Trigger function: auto-create profile on user signup.
-- Definición vigente en la migración 037 (guarda rut y birth_date del
-- registro); ver bloque "UNA CUENTA POR PERSONA" al final del archivo.

-- Trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id integer NOT NULL,
  name text NOT NULL,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  role_id integer DEFAULT 4 NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  birth_date date,
  photo_url text,
  active boolean DEFAULT true NOT NULL,
  rut text,
  address text,
  weight numeric,
  height numeric,
  dominant_hand text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_weight_check CHECK (weight > 0 AND weight <= 300),
  CONSTRAINT profiles_height_check CHECK (height > 0 AND height <= 250),
  CONSTRAINT profiles_dominant_hand_check CHECK (dominant_hand IN ('diestro', 'zurdo'))
);

CREATE TABLE IF NOT EXISTS public.academy_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text DEFAULT 'Bio Kenpo La Serena' NOT NULL,
  logo_url text,
  address text,
  whatsapp text,
  social_links jsonb,
  integrations jsonb,
  qr_alert_duration integer DEFAULT 4 NOT NULL,
  payment_settings jsonb,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT academy_settings_pkey PRIMARY KEY (id)
);

UPDATE public.academy_settings
SET payment_settings = '{"memberships":"online","personalized":"online","enrollment":"online","bank":null}'::jsonb
WHERE payment_settings IS NULL;

-- Contraseña (hash scrypt) que protege la pantalla de sesión QR en /admin/asistencia.
-- Singleton: la existencia de la fila indica que la protección está activa (si no hay
-- fila, el panel funciona sin bloqueo = fail-open). No puede vivir en academy_settings
-- porque esa tabla tiene el policy academy_settings_select_all USING (true).
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

CREATE TABLE IF NOT EXISTS public.disciplines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  color_hex text DEFAULT '#000000' NOT NULL,
  description text,
  active boolean DEFAULT true NOT NULL,
  icon text DEFAULT 'sports_martial_arts',
  CONSTRAINT disciplines_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  discipline_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  room text,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer DEFAULT 20 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  category text[] DEFAULT '{ninos,juveniles,adultos}' NOT NULL,
  active boolean DEFAULT true NOT NULL,
  description text,
  mode text DEFAULT 'normal' NOT NULL,
  CONSTRAINT schedules_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL,
  session_date date NOT NULL,
  status text DEFAULT 'cerrada' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT class_sessions_status_check CHECK (status IN ('activa', 'cerrada'))
);

CREATE TABLE IF NOT EXISTS public.class_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  CONSTRAINT class_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid,
  beneficiary_id uuid NOT NULL,
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  schedule_id uuid,
  source text DEFAULT 'horarios' NOT NULL,
  CONSTRAINT class_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT class_enrollments_source_check CHECK (source IN ('horarios', 'admin', 'qr'))
);

CREATE TABLE IF NOT EXISTS public.dependents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tutor_id uuid NOT NULL,
  full_name text NOT NULL,
  rut text,
  birth_date date NOT NULL,
  category text NOT NULL,
  address text,
  weight numeric,
  height numeric,
  dominant_hand text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT dependents_pkey PRIMARY KEY (id),
  CONSTRAINT dependents_weight_check CHECK (weight > 0 AND weight <= 300),
  CONSTRAINT dependents_height_check CHECK (height > 0 AND height <= 250),
  CONSTRAINT dependents_dominant_hand_check CHECK (dominant_hand IN ('diestro', 'zurdo')),
  CONSTRAINT dependents_category_check CHECK (category IN ('nino', 'juvenil', 'adulto'))
);

CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid,
  dependent_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT beneficiaries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.belt_grades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  discipline_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT belt_grades_pkey PRIMARY KEY (id),
  CONSTRAINT belt_grades_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE,
  CONSTRAINT belt_grades_discipline_position_key UNIQUE (discipline_id, position),
  CONSTRAINT belt_grades_position_check CHECK (position > 0)
);

INSERT INTO public.belt_grades (discipline_id, name, color, position)
SELECT d.id, g.name, g.color, g.position
FROM public.disciplines d
CROSS JOIN (
  VALUES
    ('Blanco',   '#F5F5F5', 1),
    ('Amarillo', '#FBC02D', 2),
    ('Naranja',  '#F57C00', 3),
    ('Verde',    '#388E3C', 4),
    ('Azul',     '#1976D2', 5),
    ('Morado',   '#7B1FA2', 6),
    ('Marrón',   '#5D4037', 7),
    ('Negro',    '#212121', 8)
) AS g(name, color, position)
WHERE d.active = true
ON CONFLICT (discipline_id, position) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sport_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  discipline_id uuid NOT NULL,
  grade_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT sport_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT sport_profiles_beneficiary_discipline_key UNIQUE (beneficiary_id, discipline_id),
  CONSTRAINT sport_profiles_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT sport_profiles_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE,
  CONSTRAINT sport_profiles_grade_id_fkey
    FOREIGN KEY (grade_id) REFERENCES public.belt_grades(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.sport_profile_validate_grade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discipline_id IS NULL THEN
    NEW.grade_id := NULL;
  ELSIF NEW.grade_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.belt_grades bg
    WHERE bg.id = NEW.grade_id
      AND bg.discipline_id = NEW.discipline_id
  ) THEN
    RAISE EXCEPTION 'El grado no pertenece a la disciplina seleccionada';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sport_profile_validate_grade
  BEFORE INSERT OR UPDATE ON public.sport_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sport_profile_validate_grade();

CREATE TABLE IF NOT EXISTS public.sports_podiums (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  tournament text NOT NULL,
  event_date date NOT NULL,
  discipline_id uuid NOT NULL,
  category text,
  position text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT sports_podiums_pkey PRIMARY KEY (id),
  CONSTRAINT sports_podiums_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT sports_podiums_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  CONSTRAINT sports_podiums_position_check
    CHECK (position IN ('1', '2', '3', 'participacion'))
);

CREATE INDEX IF NOT EXISTS idx_sports_podiums_beneficiary_date
  ON public.sports_podiums (beneficiary_id, event_date DESC);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  beneficiary_id uuid NOT NULL,
  status text DEFAULT 'presente' NOT NULL,
  marked_by uuid,
  marked_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT attendance_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.membership_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  duration_days integer NOT NULL,
  category text NOT NULL,
  benefits jsonb,
  tokens integer, -- NULL = ilimitado, nÃºmero = clases incluidas
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT membership_plans_pkey PRIMARY KEY (id),
  CONSTRAINT membership_plans_category_check CHECK (category IN ('nino', 'juvenil', 'adulto'))
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  purchased_by uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'activa' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT memberships_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  price numeric NOT NULL,
  stock integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  url text NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  CONSTRAINT product_images_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  status text DEFAULT 'borrador' NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  guest_email text,
  guest_phone text,
  guest_name text,
  reference text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT product_orders_pkey PRIMARY KEY (id),
  CONSTRAINT product_orders_status_check CHECK (status IN ('borrador', 'pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  membership_id uuid,
  order_id uuid,
  concept text NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  status text DEFAULT 'pendiente' NOT NULL,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  commerce_order text,
  flow_token text,
  flow_order bigint,
  beneficiary_id uuid,
  include_enrollment boolean DEFAULT false NOT NULL,
  enrollment_plan_id uuid,
  membership_plan_id uuid REFERENCES public.membership_plans(id),
  personalized_plan_id uuid REFERENCES public.personalized_plans(id),
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_note text,
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  image text,
  location_name text,
  location_url text,
  location_lat numeric,
  location_lng numeric,
  event_date date NOT NULL,
  extra jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);

-- Migración 033: lista de asistencia por evento (titular + cargas).
-- Escritura SOLO por las RPC enroll_event / cancel_event_attendance
-- (SECURITY DEFINER); sin policies INSERT/UPDATE/DELETE.
-- ON DELETE CASCADE en event_id: borrar el evento limpia su lista.
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  beneficiary_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT event_attendees_event_beneficiary_key UNIQUE (event_id, beneficiary_id),
  CONSTRAINT event_attendees_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_attendees_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id)
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL,
  cover_image text,
  gallery jsonb,
  author_id uuid NOT NULL,
  status text DEFAULT 'borrador' NOT NULL,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  target text DEFAULT 'todos' NOT NULL,
  sent_by uuid NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.gallery_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  url text NOT NULL,
  alt text DEFAULT '',
  position integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT gallery_images_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.consent_forms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  data jsonb NOT NULL,
  pdf_url text,
  signed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT consent_forms_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.body_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  recorded_at date DEFAULT CURRENT_DATE NOT NULL,
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  muscle_mass_pct numeric,
  body_fat_pct numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT body_metrics_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  enfermedades text,
  lesiones text,
  medicamentos text,
  alergias text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT medical_records_pkey PRIMARY KEY (id)
);

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

ALTER TABLE public.class_enrollments
  ADD CONSTRAINT class_enrollments_beneficiary_session_key
  UNIQUE (beneficiary_id, session_id);

-- B-014: el UNIQUE legacy (beneficiary_id, schedule_id) fue eliminado
-- en la migración 006 (el modelo per-session es la fuente de verdad).
-- El backfill mapeó las filas legacy schedule_id -> session_id.

-- =====================================================
-- CHECK CONSTRAINTS
-- =====================================================

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_category_check
  CHECK (category <@ ARRAY['ninos', 'juveniles', 'adultos']);

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_mode_check
  CHECK (mode IN ('normal', 'personalizado'));

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);
ALTER TABLE public.schedules ADD CONSTRAINT schedules_discipline_id_fkey FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id);
ALTER TABLE public.schedules ADD CONSTRAINT schedules_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.profiles(id);
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);
ALTER TABLE public.class_plans ADD CONSTRAINT class_plans_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);
ALTER TABLE public.class_plans ADD CONSTRAINT class_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id);
ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id);
ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);
ALTER TABLE public.dependents ADD CONSTRAINT dependents_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.profiles(id);
ALTER TABLE public.beneficiaries ADD CONSTRAINT beneficiaries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);
ALTER TABLE public.beneficiaries ADD CONSTRAINT beneficiaries_dependent_id_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_purchased_by_fkey FOREIGN KEY (purchased_by) REFERENCES public.profiles(id);
ALTER TABLE public.product_images ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.product_orders ADD CONSTRAINT product_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.product_orders(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE public.consent_forms ADD CONSTRAINT consent_forms_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.personalized_packs ADD CONSTRAINT personalized_packs_purchased_by_fkey FOREIGN KEY (purchased_by) REFERENCES public.profiles(id);
ALTER TABLE public.body_metrics ADD CONSTRAINT body_metrics_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_dependents_tutor_id ON public.dependents(tutor_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_profile_id ON public.beneficiaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_dependent_id ON public.beneficiaries(dependent_id);
CREATE INDEX IF NOT EXISTS idx_memberships_beneficiary_id ON public.memberships(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active ON public.memberships(beneficiary_id) WHERE status = 'activa';
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_flow_token ON public.payments(flow_token);
CREATE INDEX IF NOT EXISTS idx_payments_manual_pending ON public.payments(method) WHERE method = 'transferencia' AND status = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by ON public.payments(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_payments_membership_plan ON public.payments(membership_plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_personalized_plan ON public.payments(personalized_plan_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_user_id ON public.product_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_reference ON public.product_orders(reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_orders_reference_unique ON public.product_orders(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_schedules_discipline_id ON public.schedules(discipline_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day_of_week ON public.schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule_id ON public.class_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_session_date ON public.class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON public.class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_session_id ON public.class_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary_id ON public.class_enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_schedule_id ON public.class_enrollments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_id ON public.attendance(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_body_metrics_beneficiary_id ON public.body_metrics(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_beneficiary_id ON public.medical_records(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_position ON public.gallery_images(position);
CREATE INDEX IF NOT EXISTS idx_gallery_images_active ON public.gallery_images(active);
CREATE INDEX IF NOT EXISTS idx_consent_forms_beneficiary_id ON public.consent_forms(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON public.event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_beneficiary_id ON public.event_attendees(beneficiary_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-create profile on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Auto-update updated_at on dependents
CREATE OR REPLACE TRIGGER set_dependents_updated_at
  BEFORE UPDATE ON public.dependents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Auto-update updated_at on products
CREATE OR REPLACE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Auto-update updated_at on medical_records
CREATE OR REPLACE TRIGGER set_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.is_admin());
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_all" ON public.roles FOR SELECT USING (true);
CREATE POLICY "roles_admin_all" ON public.roles FOR ALL USING (public.is_admin());
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academy_settings_select_all" ON public.academy_settings FOR SELECT USING (true);
CREATE POLICY "academy_settings_admin_write" ON public.academy_settings FOR ALL USING (public.is_admin());
ALTER TABLE public.qr_session_lock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_session_lock_admin_all" ON public.qr_session_lock FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplines_select_all" ON public.disciplines FOR SELECT USING (true);
CREATE POLICY "disciplines_admin_write" ON public.disciplines FOR ALL USING (public.is_admin());
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select_all" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "schedules_admin_write" ON public.schedules FOR ALL USING (public.is_admin());
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_sessions_select_all" ON public.class_sessions FOR SELECT USING (true);
CREATE POLICY "class_sessions_admin_write" ON public.class_sessions FOR ALL USING (public.is_admin());
ALTER TABLE public.class_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_plans_select_all" ON public.class_plans FOR SELECT USING (true);
CREATE POLICY "class_plans_admin_write" ON public.class_plans FOR ALL USING (public.is_admin());
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_enrollments_select_own_or_admin" ON public.class_enrollments FOR SELECT USING (public.is_admin() OR public.owns_beneficiary(beneficiary_id));
CREATE POLICY "class_enrollments_insert_admin_or_self" ON public.class_enrollments FOR INSERT WITH CHECK (
  public.is_admin()
  OR (
    public.owns_beneficiary(beneficiary_id)
    AND EXISTS (SELECT 1 FROM public.academy_enrollments ae WHERE ae.beneficiary_id = class_enrollments.beneficiary_id AND ae.status = 'activa' AND ae.end_date >= public.chile_today())
    AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.beneficiary_id = class_enrollments.beneficiary_id AND m.status = 'activa' AND m.end_date >= public.chile_today())
  )
);
-- B-013: walk-in QR restringido a admin/staff (el flujo legítimo pasa por /api/checkin con service role)
CREATE POLICY "class_enrollments_insert_qr_admin_staff" ON public.class_enrollments FOR INSERT WITH CHECK (
  public.is_admin() OR public.is_staff()
);
CREATE POLICY "class_enrollments_delete_admin" ON public.class_enrollments FOR DELETE USING (public.is_admin());
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dependents_select_own_or_admin" ON public.dependents FOR SELECT USING (tutor_id = auth.uid() OR public.is_admin());
CREATE POLICY "dependents_insert_own_or_admin" ON public.dependents FOR INSERT WITH CHECK (tutor_id = auth.uid() OR public.is_admin());
CREATE POLICY "dependents_update_own_or_admin" ON public.dependents FOR UPDATE USING (tutor_id = auth.uid() OR public.is_admin());
CREATE POLICY "dependents_delete_own_or_admin" ON public.dependents FOR DELETE USING (tutor_id = auth.uid() OR public.is_admin());
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beneficiaries_select_own_or_admin" ON public.beneficiaries FOR SELECT USING (public.owns_beneficiary(id) OR public.is_admin());
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select_own_or_admin" ON public.attendance FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
CREATE POLICY "attendance_insert_admin" ON public.attendance FOR INSERT WITH CHECK (public.is_admin());
-- B-013: auto-asistencia restringida a admin/staff (el check-in QR pasa por /api/checkin con service role)
CREATE POLICY "attendance_insert_admin_staff" ON public.attendance FOR INSERT WITH CHECK (
  public.is_admin() OR public.is_staff()
);
CREATE POLICY "attendance_update_admin" ON public.attendance FOR UPDATE USING (public.is_admin());
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membership_plans_select_all" ON public.membership_plans FOR SELECT USING (true);
CREATE POLICY "membership_plans_admin_write" ON public.membership_plans FOR ALL USING (public.is_admin());
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_select_own_or_admin" ON public.memberships FOR SELECT USING (purchased_by = auth.uid() OR public.owns_beneficiary(beneficiary_id) OR public.is_admin());
CREATE POLICY "memberships_admin_write" ON public.memberships FOR ALL USING (public.is_admin());
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all" ON public.products FOR SELECT USING (true);
CREATE POLICY "products_admin_write" ON public.products FOR ALL USING (public.is_admin());
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_select_all" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "product_images_admin_write" ON public.product_images FOR ALL USING (public.is_admin());
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_orders_select_own_or_admin" ON public.product_orders FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "product_orders_insert_own" ON public.product_orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "product_orders_admin_update" ON public.product_orders FOR UPDATE USING (public.is_admin());
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own_or_admin" ON public.order_items FOR SELECT USING (public.is_admin() OR order_id IN (SELECT id FROM public.product_orders WHERE user_id = auth.uid()));
CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT WITH CHECK (public.is_admin() OR order_id IN (SELECT id FROM public.product_orders WHERE user_id = auth.uid()));
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own_or_admin" ON public.payments FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "payments_insert_admin" ON public.payments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE USING (public.is_admin());
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_admin_write" ON public.events FOR ALL USING (public.is_admin());
-- Migración 033: la lista de asistentes NO es pública. Solo el titular/carga
-- y el staff la leen; la escritura va por RPC SECURITY DEFINER.
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_attendees_select_own_or_staff" ON public.event_attendees FOR SELECT USING (public.is_staff() OR public.owns_beneficiary(beneficiary_id));
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_posts_select_public" ON public.blog_posts FOR SELECT USING (status = 'publicado' OR public.is_admin());
CREATE POLICY "blog_posts_admin_write" ON public.blog_posts FOR ALL USING (public.is_admin());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_all_or_admin" ON public.notifications FOR SELECT USING (target = 'todos' OR public.is_admin());
CREATE POLICY "notifications_admin_write" ON public.notifications FOR ALL USING (public.is_admin());
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs FOR SELECT USING (public.is_admin());
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery_public_read" ON public.gallery_images FOR SELECT USING (true);
CREATE POLICY "gallery_admin_all" ON public.gallery_images FOR ALL USING (public.is_admin());
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_forms_select_own_or_admin" ON public.consent_forms FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
CREATE POLICY "consent_forms_insert_admin" ON public.consent_forms FOR INSERT WITH CHECK (public.is_admin());
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_metrics_select_own_or_admin" ON public.body_metrics FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
CREATE POLICY "body_metrics_insert_admin" ON public.body_metrics FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "body_metrics_update_admin" ON public.body_metrics FOR UPDATE USING (public.is_admin());
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medical_records_select_own_or_admin" ON public.medical_records FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
CREATE POLICY "medical_records_insert_admin" ON public.medical_records FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "medical_records_update_admin" ON public.medical_records FOR UPDATE USING (public.is_admin());
ALTER TABLE public.belt_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "belt_grades_select_auth" ON public.belt_grades;
CREATE POLICY "belt_grades_select_auth" ON public.belt_grades FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "belt_grades_admin_write" ON public.belt_grades;
CREATE POLICY "belt_grades_admin_write" ON public.belt_grades FOR ALL USING (public.is_admin());
ALTER TABLE public.sport_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sport_profiles_select_own_or_admin" ON public.sport_profiles;
CREATE POLICY "sport_profiles_select_own_or_admin" ON public.sport_profiles FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "sport_profiles_admin_write" ON public.sport_profiles;
CREATE POLICY "sport_profiles_admin_write" ON public.sport_profiles FOR ALL USING (public.is_admin());
ALTER TABLE public.sports_podiums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sports_podiums_select_own_or_admin" ON public.sports_podiums;
CREATE POLICY "sports_podiums_select_own_or_admin" ON public.sports_podiums FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "sports_podiums_admin_write" ON public.sports_podiums;
CREATE POLICY "sports_podiums_admin_write" ON public.sports_podiums FOR ALL USING (public.is_admin());

-- =====================================================
-- TABLAS NUEVAS: enrollment_plans + academy_enrollments
-- =====================================================

CREATE TABLE IF NOT EXISTS public.enrollment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrollment_plan_id UUID NOT NULL REFERENCES public.enrollment_plans(id),
  payment_id UUID REFERENCES public.payments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','vencida','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_beneficiary ON public.academy_enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_status ON public.academy_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_end_date ON public.academy_enrollments(end_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_plans_active ON public.enrollment_plans(active);

ALTER TABLE public.enrollment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_enrollment_plans" ON public.enrollment_plans FOR ALL USING (public.is_admin());
CREATE POLICY "staff_read_enrollment_plans" ON public.enrollment_plans FOR SELECT USING (public.is_staff());
CREATE POLICY "auth_read_active_enrollment_plans" ON public.enrollment_plans FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);

ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_academy_enrollments" ON public.academy_enrollments FOR ALL USING (public.is_admin());
CREATE POLICY "staff_read_academy_enrollments" ON public.academy_enrollments FOR SELECT USING (public.is_staff());
CREATE POLICY "user_read_own_enrollments" ON public.academy_enrollments FOR SELECT USING (public.owns_beneficiary(beneficiary_id));
-- B-013: auto-matrícula restringida a admin/staff (el pago Flow crea la inscripción server-side)
CREATE POLICY "academy_enrollments_insert_admin_staff" ON public.academy_enrollments FOR INSERT WITH CHECK (
  public.is_admin() OR public.is_staff()
);

-- =====================================================
-- TABLA: debts (deuda materializada por check-in sin tokens, Fase 10)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id),
  session_id uuid REFERENCES public.class_sessions(id),
  class_enrollment_id uuid REFERENCES public.class_enrollments(id),
  amount integer NOT NULL DEFAULT 1 CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagada','condonada')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  CONSTRAINT debts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_debts_beneficiary_status ON public.debts(beneficiary_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_session ON public.debts(session_id);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_admin_all" ON public.debts FOR ALL USING (public.is_admin());
CREATE POLICY "debts_staff_read" ON public.debts FOR SELECT USING (public.is_staff());
CREATE POLICY "debts_user_read_own" ON public.debts FOR SELECT USING (public.owns_beneficiary(beneficiary_id));

-- =====================================================
-- TABLA: reglamento_interno (contenido único editable por admin)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reglamento_interno (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT reglamento_interno_pkey PRIMARY KEY (id)
);

ALTER TABLE public.reglamento_interno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglamento_interno_select_all" ON public.reglamento_interno FOR SELECT USING (true);
CREATE POLICY "reglamento_interno_admin_all" ON public.reglamento_interno FOR ALL USING (public.is_admin());

-- =====================================================
-- SEED DATA: enrollment plans
-- =====================================================
INSERT INTO public.enrollment_plans (name, price, duration_days, active, sort_order)
VALUES
  ('6 Meses', 15000, 180, true, 1),
  ('1 AÃ±o', 25000, 365, true, 2)
ON CONFLICT DO NOTHING;


-- ==========================================
-- MIGRACIONES
-- ==========================================

-- =====================================================================
-- MIGRACIÃ“N: Sistema de Inscripciones (MatrÃ­cula) - ZonaElite
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- =====================================================
-- TABLA: enrollment_plans (planes de inscripciÃ³n)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.enrollment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: academy_enrollments (inscripciones de beneficiarios)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrollment_plan_id UUID NOT NULL REFERENCES public.enrollment_plans(id),
  payment_id UUID REFERENCES public.payments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','vencida','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_beneficiary ON public.academy_enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_status ON public.academy_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_end_date ON public.academy_enrollments(end_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_plans_active ON public.enrollment_plans(active);

-- =====================================================
-- RLS: enrollment_plans
-- =====================================================
ALTER TABLE public.enrollment_plans ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_enrollment_plans" ON public.enrollment_plans
  FOR ALL USING (public.is_admin());

-- Staff: lectura
CREATE POLICY "staff_read_enrollment_plans" ON public.enrollment_plans
  FOR SELECT USING (public.is_staff());

-- Usuarios autenticados: lectura de planes activos (para checkout)
CREATE POLICY "auth_read_active_enrollment_plans" ON public.enrollment_plans
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);

-- =====================================================
-- RLS: academy_enrollments
-- =====================================================
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_academy_enrollments" ON public.academy_enrollments
  FOR ALL USING (public.is_admin());

-- Staff: lectura
CREATE POLICY "staff_read_academy_enrollments" ON public.academy_enrollments
  FOR SELECT USING (public.is_staff());

-- Usuarios: ven sus propias inscripciones (y de sus cargas)
CREATE POLICY "user_read_own_enrollments" ON public.academy_enrollments
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id));

-- B-013: auto-matrícula restringida a admin/staff (el pago Flow crea la inscripción server-side)
CREATE POLICY "academy_enrollments_insert_admin_staff" ON public.academy_enrollments
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_staff());

-- =====================================================
-- SEED DATA: 2 planes por defecto
-- =====================================================
INSERT INTO public.enrollment_plans (name, price, duration_days, active, sort_order)
VALUES
  ('6 Meses', 15000, 180, true, 1),
  ('1 AÃ±o', 25000, 365, true, 2)
ON CONFLICT DO NOTHING;


-- ==========================================
-- MIGRACIONES
-- ==========================================

-- Add enrollment columns to payments table
-- This allows the confirmation callback to know if a payment includes enrollment,
-- without depending on Flow's 'optional' field (which isn't returned on getStatus).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS include_enrollment boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS enrollment_plan_id uuid REFERENCES public.enrollment_plans(id);

-- Backfill from concept field for any existing payments that included enrollment
UPDATE public.payments
SET include_enrollment = true
WHERE concept ILIKE 'InscripciÃ³n%'
  AND include_enrollment = false;

-- Now backfill enrollment_plan_id for those payments by matching plan name from concept
UPDATE public.payments p
SET enrollment_plan_id = ep.id
FROM public.enrollment_plans ep
WHERE p.include_enrollment = true
  AND p.enrollment_plan_id IS NULL
  AND p.concept ILIKE '%' || ep.name || '%';


-- ==========================================
-- MIGRACIONES
-- ==========================================

-- =====================================================================
-- MIGRACIÃ“N: Sistema de Tokens por MembresÃ­a
-- Fecha: 2026-07-27
-- DescripciÃ³n: Agrega campo tokens a membership_plans, Ã­ndices y funciones
-- =====================================================================

-- 1. Agregar columna tokens a membership_plans
-- NULL = ilimitado (sin restricciÃ³n de clases)
-- NÃºmero entero = cantidad de clases incluidas en el periodo de vigencia
ALTER TABLE membership_plans 
ADD COLUMN IF NOT EXISTS tokens INTEGER NULL;

COMMENT ON COLUMN membership_plans.tokens IS 
'NÃºmero de clases incluidas en el plan. NULL = ilimitado (sin restricciÃ³n).';

-- 2. Ãndices para rendimiento del cÃ¡lculo de tokens
CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary 
ON class_enrollments(beneficiary_id);

CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_status 
ON attendance(beneficiary_id, status);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary_session 
ON class_enrollments(beneficiary_id, session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_session_status 
ON attendance(beneficiary_id, session_id, status);

-- 3. FunciÃ³n para calcular tokens restantes
CREATE OR REPLACE FUNCTION public.get_remaining_tokens(
  p_beneficiary_id UUID,
  p_membership_id UUID
)
RETURNS TABLE (
  remaining INTEGER,
  total INTEGER,
  consumed INTEGER,
  justified INTEGER,
  is_unlimited BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_plan_tokens INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_created_at TIMESTAMPTZ;
  v_consumed BIGINT;
  v_justified BIGINT;
BEGIN
  -- Obtener informaciÃ³n de la membresÃ­a y el plan
  SELECT 
    mp.tokens,
    m.start_date,
    m.end_date,
    m.created_at
  INTO 
    v_plan_tokens,
    v_start_date,
    v_end_date,
    v_created_at
  FROM memberships m
  JOIN membership_plans mp ON m.plan_id = mp.id
  WHERE m.id = p_membership_id
    AND m.beneficiary_id = p_beneficiary_id
    AND m.status = 'activa';
  
  -- Si no se encuentra la membresÃ­a, retornar NULL
  IF v_plan_tokens IS NULL THEN
    remaining := NULL;
    total := NULL;
    consumed := 0;
    justified := 0;
    is_unlimited := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Contar inscripciones en el periodo (consumen token)
  -- B-010: la reserva pertenece a esta membresía si se hizo dentro
  -- de su ventana de vigencia [created_at, end_date]. El límite
  -- superior evita que reservas hechas con otra membresía
  -- (o vencida la actual) cuenten contra esta.
  SELECT COUNT(*)
  INTO v_consumed
  FROM class_enrollments ce
  JOIN class_sessions cs ON ce.session_id = cs.id
  WHERE ce.beneficiary_id = p_beneficiary_id
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date
    AND ce.enrolled_at >= v_created_at
    AND ce.enrolled_at < (v_end_date + INTERVAL '1 day');
  
  -- Contar justificaciones en el periodo (devuelven token)
  -- Unimos con class_enrollments para verificar que la justificaciÃ³n
  -- pertenece a una inscripciÃ³n de esta misma membresÃ­a.
  SELECT COUNT(*)
  INTO v_justified
  FROM attendance a
  JOIN class_sessions cs ON a.session_id = cs.id
  JOIN class_enrollments ce ON ce.session_id = cs.id AND ce.beneficiary_id = a.beneficiary_id
  WHERE a.beneficiary_id = p_beneficiary_id
    AND a.status = 'justificado'
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date
    AND ce.enrolled_at >= v_created_at
    AND ce.enrolled_at < (v_end_date + INTERVAL '1 day');
  
  -- Calcular tokens restantes
  -- remaining = total - (inscripciones - justificaciones)
  remaining := v_plan_tokens - (v_consumed - v_justified);
  
  -- Si remaining es negativo, es deuda (se retorna tal cual)
  total := v_plan_tokens;
  consumed := v_consumed;
  justified := v_justified;
  is_unlimited := FALSE;
  
  RETURN NEXT;
END;
$$;

-- 4. FunciÃ³n para obtener detalle de deuda
CREATE OR REPLACE FUNCTION public.get_enrollment_debt(
  p_beneficiary_id UUID,
  p_membership_id UUID
)
RETURNS TABLE (
  enrollment_id UUID,
  session_date DATE,
  discipline_name TEXT,
  start_time TIME,
  end_time TIME,
  professor_name TEXT,
  source TEXT,
  enrolled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_token_info RECORD;
  v_excess_count BIGINT;
BEGIN
  -- Obtener informaciÃ³n de tokens
  SELECT * INTO v_token_info
  FROM public.get_remaining_tokens(p_beneficiary_id, p_membership_id);
  
  -- Si es ilimitado o tiene tokens, no hay deuda
  IF v_token_info.is_unlimited OR v_token_info.remaining >= 0 THEN
    RETURN;
  END IF;
  
  -- Calcular cuÃ¡ntas inscripciones exceden los tokens
  v_excess_count := ABS(v_token_info.remaining);
  
  -- Retornar las Ãºltimas N inscripciones que generan la deuda
  RETURN QUERY
  SELECT 
    ce.id as enrollment_id,
    cs.session_date,
    d.name as discipline_name,
    s.start_time,
    s.end_time,
    p.full_name as professor_name,
    ce.source,
    ce.enrolled_at
  FROM class_enrollments ce
  JOIN class_sessions cs ON ce.session_id = cs.id
  JOIN schedules s ON cs.schedule_id = s.id
  JOIN disciplines d ON s.discipline_id = d.id
  JOIN profiles p ON s.professor_id = p.id
  WHERE ce.beneficiary_id = p_beneficiary_id
    AND cs.session_date >= (
      SELECT m.start_date 
      FROM memberships m 
      WHERE m.id = p_membership_id
    )
    AND cs.session_date <= (
      SELECT m.end_date 
      FROM memberships m 
      WHERE m.id = p_membership_id
    )
  ORDER BY cs.session_date DESC, ce.enrolled_at DESC
  LIMIT v_excess_count;
END;
$$;


-- 5. Comentarios
COMMENT ON FUNCTION public.get_remaining_tokens(UUID, UUID) IS 
'Retorna los tokens restantes para un beneficiario en una membresÃ­a especÃ­fica.
Si el plan es ilimitado (tokens = NULL), retorna remaining = NULL y is_unlimited = TRUE.
Si remaining < 0, indica deuda (inscripciones exceden los tokens disponibles).';

COMMENT ON FUNCTION public.get_enrollment_debt(UUID, UUID) IS 
'Retorna el detalle de las inscripciones que generan deuda cuando los tokens se agotan.
Solo retorna datos cuando remaining < 0.';

-- =====================================================
-- RPC enroll_class (B-006): capacidad validada server-side
-- =====================================================

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
    RAISE EXCEPTION 'SesiÃ³n no encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_session_date < public.chile_today() THEN
    RAISE EXCEPTION 'La sesiÃ³n ya pasÃ³' USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.is_admin();

  PERFORM 1 FROM public.class_sessions WHERE id = p_session_id FOR UPDATE;

  SELECT count(*) INTO v_enrolled
    FROM public.class_enrollments
    WHERE session_id = p_session_id;

  FOREACH v_bid IN ARRAY p_beneficiary_ids LOOP
    IF EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.session_id = p_session_id AND ce.beneficiary_id = v_bid
    ) THEN
      RETURN QUERY SELECT v_bid, true, NULL, 'Ya inscrito';
      CONTINUE;
    END IF;

    IF NOT (v_is_admin OR public.owns_beneficiary(v_bid)) THEN
      RETURN QUERY SELECT v_bid, false, 'UNAUTHORIZED', 'No tienes acceso a este beneficiario';
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.beneficiary_id = v_bid
        AND m.status = 'activa'
        AND m.end_date >= public.chile_today()
    ) INTO v_membership_ok;
    IF NOT v_membership_ok THEN
      RETURN QUERY SELECT v_bid, false, 'NO_MEMBERSHIP', 'Sin membresÃ­a activa';
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.academy_enrollments ae
      WHERE ae.beneficiary_id = v_bid
        AND ae.status = 'activa'
        AND ae.end_date >= public.chile_today()
    ) INTO v_enrollment_ok;
    IF NOT v_enrollment_ok THEN
      RETURN QUERY SELECT v_bid, false, 'NO_ENROLLMENT', 'Sin inscripciÃ³n a la academia';
      CONTINUE;
    END IF;

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

REVOKE ALL ON FUNCTION public.enroll_class(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_class(UUID, UUID[]) TO authenticated;

-- 6. Actualizaciones de MembresÃ­as (MÃ³dulos adicionales)
-- MigraciÃ³n: Agregar columna featured a membership_plans
-- Solo 1 plan puede ser featured a la vez (enforced en app y base de datos con partial index)

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Asegurar que solo 1 sea featured usando un Ã­ndice parcial Ãºnico:
CREATE UNIQUE INDEX IF NOT EXISTS membership_plans_one_featured_idx
  ON public.membership_plans (featured)
  WHERE (featured = TRUE);

-- =====================================================
-- CLASES PERSONALIZADAS (MÃ³dulo independiente)
-- MigraciÃ³n 009_personalized_plans_packs.sql (espejo 1:1)
-- Tablas nuevas propias, desacopladas de membresÃ­as/tokens/check-in.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.personalized_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  total_classes integer NOT NULL,
  validity_days integer NOT NULL,
  features jsonb,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personalized_packs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id),
  purchased_by uuid NOT NULL,
  payment_id uuid REFERENCES public.payments(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_classes integer NOT NULL,
  used_classes integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'activa' NOT NULL CHECK (status IN ('activa','agotada','vencida','cancelada')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_packs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_personalized_packs_beneficiary ON public.personalized_packs(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_personalized_plans_active ON public.personalized_plans(active);

ALTER TABLE public.personalized_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_plans_select_all" ON public.personalized_plans FOR SELECT USING (true);
CREATE POLICY "personalized_plans_admin_write" ON public.personalized_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_packs_select_own_or_admin" ON public.personalized_packs FOR SELECT USING (
  purchased_by = auth.uid() OR public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_packs_admin_write" ON public.personalized_packs FOR ALL USING (public.is_admin());

-- =====================================================
-- CLASES DE HORARIO PARA MODALIDAD PERSONALIZADA
-- Migración 010_personalized_schedule_classes.sql (espejo 1:1)
-- schedules.mode ('normal'|'personalizado') + tablas propias
-- desacopladas + RPC enroll_personalized_class.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.personalized_schedule_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id) ON DELETE CASCADE,
  CONSTRAINT personalized_schedule_plans_pkey PRIMARY KEY (id)
);

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

ALTER TABLE public.personalized_schedule_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_schedule_plans_select_all" ON public.personalized_schedule_plans FOR SELECT USING (true);
CREATE POLICY "personalized_schedule_plans_admin_write" ON public.personalized_schedule_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_enrollments_select_own_or_admin" ON public.personalized_enrollments FOR SELECT USING (
  public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_enrollments_admin_write" ON public.personalized_enrollments FOR ALL USING (public.is_admin());

-- RPC enroll_personalized_class: inscripción con consumo atómico de pack.
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

REVOKE ALL ON FUNCTION public.enroll_personalized_class(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_personalized_class(UUID, UUID[]) TO authenticated;

-- ============================================================
-- DESINSCRIPCIÓN EN ASISTENCIA (migración 011, espejo 1:1)
-- cancel_class_enrollment: admin desinscribe a un beneficiario de
-- una sesión devolviendo el token/clase consumido, limpiando la
-- deuda pendiente y la asistencia, y notificando al titular.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_class_enrollment(
  p_session_id uuid,
  p_beneficiary_id uuid
)
RETURNS TABLE (
  removed boolean,
  token_returned boolean,
  attendance_deleted boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_is_admin boolean;
  v_session_date date;
  v_schedule_id uuid;
  v_schedule_mode text;
  v_discipline_name text;
  v_owner_id uuid;
  v_beneficiary_name text;
  v_enrollment_id uuid;
  v_pack_id uuid;
  v_class_deleted integer;
  v_attendance_deleted integer;
BEGIN
  -- Solo admin puede desinscribir desde el panel.
  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = 'P0001';
  END IF;

  SELECT cs.session_date, cs.schedule_id, s.mode, d.name
    INTO v_session_date, v_schedule_id, v_schedule_mode, v_discipline_name
    FROM public.class_sessions cs
    JOIN public.schedules s ON s.id = cs.schedule_id
    LEFT JOIN public.disciplines d ON d.id = s.discipline_id
    WHERE cs.id = p_session_id;

  IF v_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no encontrada' USING ERRCODE = 'P0001';
  END IF;

  -- Titular del beneficiario (adulto = profile_id, niño = tutor_id).
  SELECT COALESCE(dep.tutor_id, b.profile_id),
         COALESCE(dep.full_name, p.full_name, 'Alumno')
    INTO v_owner_id, v_beneficiary_name
    FROM public.beneficiaries b
    LEFT JOIN public.profiles p ON p.id = b.profile_id
    LEFT JOIN public.dependents dep ON dep.id = b.dependent_id
    WHERE b.id = p_beneficiary_id;

  IF v_schedule_mode = 'personalizado' THEN
    -- Inscripción de modalidad personalizada: restaura la clase al pack.
    SELECT pe.id, pe.pack_id
      INTO v_enrollment_id, v_pack_id
      FROM public.personalized_enrollments pe
      WHERE pe.session_id = p_session_id AND pe.beneficiary_id = p_beneficiary_id;

    IF v_enrollment_id IS NULL THEN
      RETURN QUERY SELECT false, false, false,
        'El beneficiario no está inscrito en esta sesión';
      RETURN;
    END IF;

    -- Devuelve 1 clase al pack y lo reactiva si había quedado 'agotada'.
    UPDATE public.personalized_packs
      SET used_classes = GREATEST(used_classes - 1, 0),
          status = 'activa'
      WHERE id = v_pack_id;

    DELETE FROM public.attendance
      WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id;
    GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

    DELETE FROM public.personalized_enrollments WHERE id = v_enrollment_id;

    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, content)
      VALUES (
        v_owner_id,
        'Clase devuelta',
        FORMAT('Se devolvió 1 clase de tu pack por desinscripción de la clase del %s — %s para %s.',
               TO_CHAR(v_session_date, 'DD/MM/YYYY'),
               COALESCE(v_discipline_name, 'Clase'),
               v_beneficiary_name)
      );
    END IF;

    RETURN QUERY SELECT true, true, v_attendance_deleted > 0,
      'Inscripción eliminada y clase del pack devuelta';
    RETURN;
  END IF;

  -- Modalidad normal: cubre inscripción a la sesión puntual y a la
  -- inscripción recurrente por horario (session_id IS NULL).
  DELETE FROM public.class_enrollments
    WHERE beneficiary_id = p_beneficiary_id
      AND (session_id = p_session_id
           OR (schedule_id = v_schedule_id AND session_id IS NULL));
  GET DIAGNOSTICS v_class_deleted = ROW_COUNT;

  -- Deuda pendiente que materializó el check-in QR sin tokens (fase 10).
  DELETE FROM public.debts
    WHERE beneficiary_id = p_beneficiary_id
      AND session_id = p_session_id
      AND status = 'pendiente';

  DELETE FROM public.attendance
    WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id;
  GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

  IF v_class_deleted = 0 THEN
    RETURN QUERY SELECT false, false, v_attendance_deleted > 0,
      'El beneficiario no está inscrito en esta sesión';
    RETURN;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, title, content)
    VALUES (
      v_owner_id,
      'Token devuelto',
      FORMAT('Se devolvió 1 token por desinscripción de la clase del %s — %s para %s.',
             TO_CHAR(v_session_date, 'DD/MM/YYYY'),
             COALESCE(v_discipline_name, 'Clase'),
             v_beneficiary_name)
    );
  END IF;

  RETURN QUERY SELECT true, true, v_attendance_deleted > 0,
    'Inscripción eliminada y token devuelto';
END;
$$;

-- Exponer solo a usuarios autenticados (la función valida admin por dentro).
REVOKE ALL ON FUNCTION public.cancel_class_enrollment(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_class_enrollment(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_class_enrollment(UUID, UUID) IS
  'Desinscribe a un beneficiario de una sesión (solo admin). En modalidad normal borra class_enrollments (por sesión u horario recurrente) y la deuda pendiente de la sesión, devolviendo el token automáticamente vía get_remaining_tokens; en modalidad personalizada restaura 1 clase al pack. Limpia attendance y notifica al titular.';

-- ============================================================
-- RPC DE EVENTOS: lista de asistencia (migración 033, v1.10.0)
-- Módulo DESACOPLADO de la asistencia de clases: no toca
-- class_enrollments, personalized_enrollments, attendance, debts
-- ni memberships. NO consume tokens y NO exige membresía o
-- inscripción a la academia (un evento es actividad de
-- comunidad); el administrador filtra la lista.
-- Sin aforo: events no tiene columna de capacidad.
-- Espejo de enroll_class (idempotencia + autorización por
-- beneficiario), con lock FOR UPDATE sobre el evento.
-- ============================================================

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

-- Dos autores: el admin (panel /admin/eventos) y el propio titular/carga
-- (quien pasa el mouse sobre "Inscrito" y pulsa "Eliminar asistencia").
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

-- ============================================================
-- RPC DE STOCK (checkout de tienda v1.4.0, migración 020)
-- La reserva baja stock con guarda `stock >= p_qty` (evita
-- sobreventa); si no hay stock suficiente no toca la fila y la
-- función devuelve false. La restauración sube stock (nunca
-- negativo). SECURITY DEFINER: corre con permisos del owner;
-- solo se invoca server-side (service role / RPC del checkout).
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF p_qty <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.products
  SET stock = stock - p_qty,
      updated_at = now()
  WHERE id = p_product_id
    AND active = true
    AND stock >= p_qty;

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF p_qty <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.products
  SET stock = stock + p_qty,
      updated_at = now()
  WHERE id = p_product_id;

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.decrement_product_stock(uuid, integer) IS
'Reserva stock de un producto (UPDATE atómico con guarda stock >= qty). Devuelve false si no hay stock suficiente o el producto está inactivo.';
COMMENT ON FUNCTION public.increment_product_stock(uuid, integer) IS
'Restaura stock de un producto (UPDATE atómico de suma). Se usa al cancelar/rechazar pagos de tienda.';

-- ============================================================
-- CHANGELOG DE DESARROLLADORES (migración 012, espejo 1:1)
-- changelog: tabla de solo lectura para el admin (RLS SELECT
-- con is_admin()). Los desarrolladores agregan versiones vía
-- seed/actualizaciones SQL. UNIQUE(version) + ON CONFLICT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT changelog_version_unique UNIQUE (version)
);

COMMENT ON TABLE public.changelog IS
'Changelog de desarrolladores para el panel admin. Cada fila es una versión de release con título y resumen. Solo lectura para el administrador.';

ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- Solo el administrador puede leer el changelog (la escritura va
-- por service role / SQL Editor al cerrar cada feature).
CREATE POLICY "changelog_admin_read"
  ON public.changelog FOR SELECT USING (public.is_admin());

-- SEED v1.0.0 — resumen de los cambios del sprint 2026-08-07
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.0.0',
  'Mejoras en Membresías, Asistencia y Disciplinas',
  E'• Vista de membresías rediseñada con tarjetas por beneficiario y mejor lectura de estado.\n• Botón "Desinscribir" en Asistencia: si un usuario se inscribió por error, se elimina de la sesión y se devuelve el token/clase consumido.\n• Disciplinas: la descripción ahora se despliega con transición suave para visualizarla por completo.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.1.0 — Pago manual por transferencia (migración 013)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.0',
  'Pago por Transferencia',
  E'• Nuevo modo de pago por transferencia: el administrador puede activarlo por tipo de producto (Membresías, Clases Personalizadas e Inscripciones) desde Configuración, sin usar Flow.\n• Cuando está activo, el usuario elige "Pagar por transferencia" en el checkout, ve los datos bancarios de la academia y envía su comprobante adjunto (imagen o PDF).\n• El administrador recibe un correo y una notificación con cada solicitud, y la revisa en la pestaña "Solicitudes" de la sección Ventas, pudiendo ver el comprobante completo antes de aprobar o rechazar.\n• Aviso permanente de solicitudes pendientes: el menú de administración muestra en "Ventas" un contador de solicitudes sin revisar y aparece un aviso destacado con botón para revisarlas de inmediato.\n• Nuevo panel "Mis Solicitudes de Pago" en el panel del usuario: ahí puede ver en qué estado está cada solicitud (en revisión, aprobada o rechazada), el monto, la referencia y su comprobante. Si una solicitud fue rechazada, se muestra el motivo indicado por el administrador. Un contador en el menú y un aviso destacado avisan cuando hay solicitudes pendientes.\n• Al aprobar, el beneficio se asigna automáticamente con las mismas reglas que el pago en línea (la membresía corre desde la fecha de aprobación; los packs personalizados se acumulan; la inscripción se extiende).\n• Cada vez que el administrador revisa una solicitud, el usuario recibe un correo con el resultado: si fue aprobada, avisa que el beneficio ya está asignado; si fue rechazada, incluye el motivo. En ambos casos el correo enlaza a la sección "Mis Solicitudes de Pago" de su panel.\n• Al rechazar, el usuario ve el motivo indicado por el administrador en su historial de pagos.\n• El perfil ahora incluye el campo RUT, usado como referencia en las transferencias. En la sección Usuarios del panel de administración, el RUT se muestra en la lista y el buscador permite filtrar por nombre, email o RUT.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.1.1 — Crear y asignar carga desde el panel admin
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.1',
  'Crear y Asignar Cargas desde el Panel Admin',
  E'• Nuevo botón "Crear y Asignar Carga" en la sección Usuarios del panel de administración: el administrador selecciona al usuario (padre/madre) al que se le asignará la carga e ingresa los datos completos del hijo/familiar (nombre, RUT, fecha de nacimiento y categoría).\n• La carga queda lista con el mismo comportamiento que una creada por el propio usuario: aparece en el panel del tutor y puede comprar membresía o inscripción para ella.\n• Las cargas existentes también pueden editarse directamente desde la misma tabla de usuarios.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.1.2 — Editar cargas desde el panel del usuario + validación RUT
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.2',
  'Editar Cargas y Validación de RUT',
  E'• En la sección "Mis Cargas" del panel del usuario, ahora puedes editar los datos de cada carga (nombre, RUT, fecha de nacimiento y categoría) con el botón "Editar datos".\n• El RUT se valida automáticamente con el formato chileno (dígito verificador): si el RUT ingresado no es válido, se muestra un aviso y no se guarda. La validación aplica tanto al agregar como al editar cargas.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.2.0 — Nota del administrador en aprobaciones + mejor feedback
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.2.0',
  'Nota del Administrador en Aprobaciones y Mejor Feedback',
  E'• Ahora, al aprobar un pago por transferencia, el administrador puede dejar una nota (aunque todo esté en orden). La nota queda guardada y el usuario la ve en su panel "Mis Solicitudes de Pago", en el historial de pagos, en la notificación y en el correo.\n• El correo de aprobación ahora muestra la nota con la etiqueta "Nota del administrador" (y el rechazo conserva "Motivo del rechazo").\n• El administrador recibe una confirmación visual tras aprobar o rechazar una solicitud, y la lista de solicitudes muestra la nota tanto en aprobadas como en rechazadas.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.2.1 — Dirección en perfil del tutor y en cargas (migración 018)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.2.1',
  'Dirección en Perfil y Cargas',
  E'• El perfil del tutor ahora tiene un campo "Dirección".\n• Al crear o editar una carga (niño/adulto) desde el dashboard del usuario o desde el panel de administración, se puede indicar su dirección o usar el checkbox "Usar la misma dirección que el tutor", que autocompleta el dato desde el perfil.\n• Las cargas muestran su dirección en la tarjeta del dashboard.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.3.0 — Datos físicos y ver ficha (migración 019)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.3.0',
  'Datos Físicos y Ver Ficha',
  E'• El perfil del tutor ahora incluye datos físicos: peso (kg), altura (cm) y mano dominante (diestro o zurdo), validados con rangos permitidos (peso hasta 300 kg y altura hasta 250 cm).\n• Las cargas (niño/adulto) también tienen datos físicos: se pueden registrar al crear o editar la carga, y cada tarjeta los muestra si existen.\n• La ficha médica del dashboard incluye una card editable "Datos Físicos" donde el tutor actualiza peso, altura y mano dominante de la carga.\n• En la sección Usuarios del panel de administración, cada carga tiene un botón "Ver Ficha" que abre una ficha de solo lectura con los datos físicos y personales.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.4.0 — Tienda de productos (migración 020)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.4.0',
  'Tienda de Productos',
  E'• Nueva tienda de productos: cada producto tiene su detalle con botones "Agregar al carrito" y "Comprar ahora", y el carrito se guarda en el navegador.\n• Checkout con pago en línea Flow: al comprar se reserva el stock del producto automáticamente y se devuelve si el pago es rechazado o cancelado.\n• Se puede comprar con la cuenta del usuario o como invitado (solo email y teléfono obligatorios); el recibo de la compra llega al correo.\n• El usuario ve sus compras en la nueva sección "Mis Compras de Tienda" de su panel y en su historial de pagos.\n• El administrador revisa las ventas en la sección Ventas, con filtro por tipo, y puede marcar cada orden como enviada, entregada o cancelarla (la cancelación devuelve el stock).'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.5.0 — Perfil deportivo de alumnos (migración 024)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.5.0',
  'Perfil deportivo de alumnos',
  E'• Cada alumno (titular o carga) ahora tiene un perfil deportivo con su disciplina y grado/cinturón, mostrado como tarjeta en "Mis Cargas".\n• El administrador asigna disciplina y grado desde la sección Usuarios con un botón dedicado por alumno.\n• Registro de podios: torneo, fecha, disciplina, categoría y lugar obtenido (1°, 2°, 3° o participación), con foto opcional.\n• Las tarjetas muestran la disciplina, el cinturón y el resumen de logros del alumno.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.6.0 — Categoría Juvenil + Horarios Multi-selección (migración 026)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.6.0',
  'Categoría Juvenil + Horarios Multi-selección',
  'Nueva categoría "juvenil" (10-15 años) para dependientes y planes de membresía. Los horarios ahora permiten seleccionar múltiples categorías (niños, juveniles, adultos) en vez de un solo valor. Recálculo automático de categoría según edad al cargar datos.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.7.0 — Histórico de asistencias (migración 029)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.7.0',
  'Histórico de asistencias',
  E'• El panel de Asistencia del administrador ahora tiene una pestaña "Histórico" que muestra las clases ya pasadas a la fecha de hoy.\n• Permite acotar la búsqueda por rango de fechas (desde/hasta) y consultar el detalle de cada sesión pasada.\n• La asistencia de sesiones pasadas se puede corregir directamente (presente/ausente/justificado), reutilizando el flujo de guardado existente.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.8.0 — Adjunto de imagen en eventos (migración 030)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.8.0',
  'Adjunto de imagen en eventos',
  E'• La imagen subida en "Nuevo Evento" ahora se muestra también como documento adjunto descargable en la ficha pública del evento (/eventos/[id]).\n• Al hacer clic en el adjunto se abre una vista previa ampliada (lightbox) con botones "Cerrar" y "Descargar" la imagen.\n• La descarga usa el parámetro ?download= de Supabase Storage para forzar el guardado del archivo.\n• Los eventos sin imagen no muestran la sección de adjunto.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.9.0 — Contraseña de protección para la sesión QR (migración 032)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.9.0',
  'Contraseña de protección para la sesión QR',
  E'• La pantalla de la sesión QR en /admin/asistencia ahora está protegida por una contraseña: al expandir una sesión activa hay que ingresarla para volver a ver el QR.\n• Al colapsar la sesión, cambiar de pestaña o pulsar "Bloquear", el QR se oculta y queda bloqueado (el desbloqueo no se guarda en el navegador, solo dura mientras la pantalla siga abierta).\n• "Finalizar asistencia" se valida en el servidor a través de /api/admin/close-session: sin la contraseña correcta la sesión no se cierra.\n• La contraseña se configura en Configuración → "Seguridad de la sesión QR" y se guarda con hash scrypt en la tabla qr_session_lock, que solo el administrador puede leer. Cambiarla o quitar la protección exige la contraseña actual.\n• Si no hay contraseña configurada, el panel sigue funcionando sin bloqueo y muestra un aviso para configurarla.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.10.0 — Lista de asistencia a eventos (migración 034)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.10.0',
  'Lista de asistencia a eventos',
  E'• Ahora puedes inscribirte a un evento desde su ficha (/eventos/[id]): el botón "Inscribirse" abre una confirmación con el nombre del evento y, al confirmar, se agrega tu nombre (y el de tus cargas) a la lista de asistencia del evento.\n• Al inscribirte verás un mensaje de "Confirmación exitosa" y el botón principal cambia a "Inscrito".\n• Si te registraste por error, pasa el mouse sobre "Inscrito" y haz clic: aparecerá el aviso "Eliminar asistencia" y una confirmación para borrar tu participación de la lista.\n• El administrador ve cuántos inscritos tiene cada evento en Eventos, y con el botón de la lista de asistencia puede ver quién se anotó (nombre, categoría y fecha) y quitar a alguien si corresponde.\n• Las inscripciones a eventos son independientes de las clases: no consumen tokens ni requieren membresía activa.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.10.1 — Mejoras de seguridad y correcciones (migración 036)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.10.1',
  'Mejoras de seguridad y correcciones',
  E'• Se reforzaron los permisos de la base de datos: los alumnos ya no pueden modificar datos sensibles de su cuenta (rol, estado o correo), ni crear o editar pagos e inscripciones a clases por fuera de los flujos oficiales.\n• Las imágenes y archivos del sitio (productos, eventos, galería, comprobantes) ahora solo pueden ser subidos, reemplazados o eliminados por el administrador.\n• Los pagos en línea verifican que el monto cobrado coincida con el registrado antes de asignar el beneficio.\n• Corregido: las alertas internas al administrador (pago sin membresía asignada, nueva solicitud de transferencia) ahora se guardan correctamente.\n• Corregido: la asignación manual de inscripciones con el método "Cortesía" ya no falla.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- ENDURECIMIENTO DE SEGURIDAD (migración 035, espejo 1:1)
-- Escrita contra la BD real (auditoría 2026-10-16). Cierra S-1…S-6
-- y corrige F-1/F-2 de contexto/auditoria-esquema-real.md.
-- ============================================================

-- S-1: un usuario no puede cambiar su propio rol, estado, email ni id.
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

-- S-2: el usuario ya no escribe pagos desde el browser.
DROP POLICY IF EXISTS "payments_user_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_owner_update_flow" ON public.payments;
DROP POLICY IF EXISTS "payments_flow_update" ON public.payments;
CREATE INDEX IF NOT EXISTS idx_payments_flow_token ON public.payments(flow_token);

-- S-3: sin inscripciones/desinscripciones directas del alumno.
DROP POLICY IF EXISTS "enrollments_own_insert" ON public.class_enrollments;
DROP POLICY IF EXISTS "enrollments_own_delete" ON public.class_enrollments;
DROP POLICY IF EXISTS "class_enrollments_insert_admin_or_self" ON public.class_enrollments;

-- S-4: escritura en el bucket "public" solo para el admin.
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

-- S-5: nadie inserta notificaciones personales desde el browser.
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.user_notifications;

-- S-6: roles con RLS (solo lectura pública).
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_public_read" ON public.roles;
CREATE POLICY "roles_public_read" ON public.roles FOR SELECT USING (true);

-- F-1: alertas de sistema al staff.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('correo_masivo', 'aviso', 'recordatorio', 'comunicado', 'sistema'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_check
  CHECK (target IN ('todos', 'segmento', 'staff'));

-- F-2: método "cortesia".
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('efectivo', 'transferencia', 'flow', 'otro', 'cortesia'));

-- SEED v1.11.0 — Una cuenta por persona (migración 038)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.11.0',
  'Una cuenta por persona',
  E'• El registro ahora pide RUT y fecha de nacimiento, y no permite crear una segunda cuenta con un RUT ya registrado.\n• Tampoco se pueden crear cuentas con correos equivalentes (por ejemplo, en Gmail los puntos no cuentan: "juan.perez@gmail.com" y "juanperez@gmail.com" son el mismo correo).\n• Al crear un usuario desde el panel de administración, si ya existe una cuenta con ese RUT o correo se muestra a quién corresponde en lugar de crear un duplicado. Si solo coinciden el nombre y la fecha de nacimiento, se muestra una advertencia y se puede crear de todas formas.\n• El perfil valida el RUT y avisa si ya pertenece a otra cuenta.\n• Los alumnos sin RUT o sin fecha de nacimiento ven un aviso en su panel para completarlos.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- UNA CUENTA POR PERSONA (migración 037, espejo 1:1)
-- Fase 1 de contexto/requisitos/cuenta-unica-por-alumno.md.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_rut(p_rut text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.canonical_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(lower(trim(coalesce(p_email, ''))), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN regexp_replace(
             split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1),
             '\.', '', 'g'
           ) || '@gmail.com'
    ELSE lower(trim(coalesce(p_email, '')))
  END;
$$;

-- Índices únicos: 037 los crea solo si no hay duplicados (si los hay,
-- emite WARNING y se re-ejecuta tras resolverlos).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_idx
  ON public.profiles (public.normalize_rut(rut))
  WHERE public.normalize_rut(rut) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_canonical_unique_idx
  ON public.profiles (public.canonical_email(email));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rut text;
  v_birth date;
BEGIN
  v_rut := nullif(trim(coalesce(NEW.raw_user_meta_data->>'rut', '')), '');

  BEGIN
    v_birth := nullif(NEW.raw_user_meta_data->>'birth_date', '')::date;
  EXCEPTION WHEN others THEN
    v_birth := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, email, rut, birth_date)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_rut,
    v_birth
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_registration_conflict(
  p_rut text,
  p_email text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.normalize_rut(p_rut) <> '' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.normalize_rut(rut) = public.normalize_rut(p_rut)
    ) THEN 'RUT_TAKEN'
    WHEN coalesce(trim(p_email), '') <> '' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.canonical_email(email) = public.canonical_email(p_email)
    ) THEN 'EMAIL_TAKEN'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.check_registration_conflict(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_registration_conflict(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_account_conflicts(
  p_rut text,
  p_email text,
  p_full_name text,
  p_birth_date date
)
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  email text,
  match text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, 'rut'::text
    FROM public.profiles p
   WHERE public.normalize_rut(p_rut) <> ''
     AND public.normalize_rut(p.rut) = public.normalize_rut(p_rut)
  UNION
  SELECT p.id, p.full_name, p.email, 'email'::text
    FROM public.profiles p
   WHERE coalesce(trim(p_email), '') <> ''
     AND public.canonical_email(p.email) = public.canonical_email(p_email)
  UNION
  SELECT p.id, p.full_name, p.email, 'name_birth'::text
    FROM public.profiles p
   WHERE p_birth_date IS NOT NULL
     AND p.birth_date = p_birth_date
     AND lower(trim(p.full_name)) = lower(trim(coalesce(p_full_name, '')));
$$;

REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_account_conflicts(text, text, text, date) TO service_role;

-- ============================================================
-- PERMISOS DE FUNCIONES (migración 039, espejo 1:1)
-- Supabase da EXECUTE directo a anon/authenticated: REVOKE FROM
-- PUBLIC no basta. Estos GRANT reemplazan los de la migración 020.
-- ============================================================

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_token_return(
  p_user_id uuid,
  p_beneficiary_name text,
  p_session_date date,
  p_discipline_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sin permisos para notificar devoluciones de token' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_notifications (user_id, title, content)
  VALUES (
    p_user_id,
    'Token devuelto',
    FORMAT('Se devolvió 1 token por clase justificada el %s — %s para %s',
           TO_CHAR(p_session_date, 'DD/MM/YYYY'),
           p_discipline_name,
           p_beneficiary_name)
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_token_return(uuid, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_token_return(uuid, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_token_return(uuid, text, date, text) TO authenticated;


-- ============================================================
-- MIGRACIÓN DE CARGAS A CUENTAS PROPIAS (migración 040, espejo 1:1)
-- Fase 2 de contexto/requisitos/cuenta-unica-por-alumno.md.
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

-- SEED v1.12.0 — Migración de cargas a cuentas propias
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.12.0',
  'Migración de cargas a cuentas propias',
  E'• Nuevo panel "Migración de cargas" en el panel de administración: lista cada carga con su tutor y su historial, y permite crear la cuenta propia del alumno (o elegir una cuenta existente vacía) y trasladarle todo: membresías, matrículas, packs, inscripciones y asistencia a clases, pagos, eventos, ficha médica, perfil deportivo y podios.\n• El traslado no copia datos: el historial queda exactamente igual, solo cambia de dueño. Si algo sale mal, la migración se puede revertir desde la pestaña "Migradas".\n• Para los menores de edad se guardan en su perfil los datos del apoderado (nombre, teléfono y correo), que también pueden editarse desde "Mi perfil".\n• Ya no se pueden crear cargas nuevas: cada alumno se registra con su propia cuenta. Las cargas existentes se siguen viendo hasta que se migren.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- RETIRO DEL SISTEMA DE CARGAS (migración 042, espejo 1:1)
-- Fase 6 de contexto/requisitos/cuenta-unica-por-alumno.md.
-- Aplicar solo con todas las cargas migradas (el DO inicial aborta si no).
-- ============================================================

DO $$
DECLARE
  v_pending integer;
  v_anchored integer;
BEGIN
  SELECT count(*) INTO v_pending FROM public.dependents;
  SELECT count(*) INTO v_anchored FROM public.beneficiaries WHERE dependent_id IS NOT NULL;
  IF v_pending > 0 OR v_anchored > 0 THEN
    RAISE EXCEPTION 'No se puede retirar el sistema de cargas: quedan % cargas sin migrar (% beneficiarios anclados a cargas). Migra todas en /admin/migracion-cargas y vuelve a ejecutar 042.',
      v_pending, v_anchored;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Pertenencia: solo la propia cuenta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owns_beneficiary(b_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beneficiaries
    WHERE id = b_id AND profile_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "enrollments_own_read" ON public.class_enrollments;
CREATE POLICY "enrollments_own_read" ON public.class_enrollments
  FOR SELECT USING (public.is_admin() OR public.owns_beneficiary(beneficiary_id));

-- ------------------------------------------------------------
-- Beneficiarios: siempre de una cuenta.
-- ------------------------------------------------------------
ALTER TABLE public.beneficiaries ALTER COLUMN profile_id SET NOT NULL;

-- ------------------------------------------------------------
-- dependents: legado vacío, sin escritura.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_dependents_create_beneficiary ON public.dependents;
DROP FUNCTION IF EXISTS public.create_beneficiary_for_dependent();

DROP POLICY IF EXISTS "dependents_tutor_read" ON public.dependents;
DROP POLICY IF EXISTS "dependents_tutor_update" ON public.dependents;
DROP POLICY IF EXISTS "dependents_admin_all" ON public.dependents;
DROP POLICY IF EXISTS "dependents_admin_read" ON public.dependents;
CREATE POLICY "dependents_admin_read" ON public.dependents
  FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.dependents IS
  'LEGADO (retirada en la migración 042): una cuenta por alumno. Vacía y de solo lectura. El historial de las cargas migradas está en dependents_archive.';

-- ------------------------------------------------------------
-- Migrar / revertir: deshabilitados (misma firma, mensaje claro).
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El sistema de cargas fue retirado: ya no hay cargas que migrar.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_dependent_migration(p_archive_id uuid)
RETURNS TABLE (
  dependent_id uuid,
  beneficiary_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El sistema de cargas fue retirado: las migraciones ya no se pueden revertir.' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_dependent_to_profile(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revert_dependent_migration(uuid) FROM anon;

-- SEED v1.13.0 — Una cuenta por alumno
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.13.0',
  'Una cuenta por alumno',
  E'• Cada alumno (también los niños) usa su propia cuenta: la compra de membresías, matrículas y packs, la inscripción a clases y eventos y el check-in por QR se hacen siempre para la persona que inició sesión. El apoderado entra con la cuenta de su hijo cuando corresponde.\n• La pestaña "Mis Cargas" se reemplazó por "Mi ficha": perfil deportivo, ficha médica, datos físicos y contacto de emergencia del propio alumno.\n• El resumen del panel ahora muestra las asistencias del mes.\n• En el panel de administración, la asignación de membresías, packs y matrículas busca directamente la cuenta del alumno (por nombre, correo o RUT), y la sección Usuarios lista cada alumno con su categoría, ficha (incluido el apoderado de los menores) y perfil deportivo.\n• Se retiró el sistema de cargas: ya no se crean ni editan cargas, y las cargas que quedaban se eliminaron (con respaldo). Cada alumno se registra con su propia cuenta.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- SOLICITUDES DE RENOVACIÓN DE MEMBRESÍA (migración 044, espejo 1:1)
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

-- SEED v1.14.0 — Ficha rápida del alumno y renovación de membresías
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.14.0',
  'Ficha rápida del alumno y renovación de membresías',
  E'• En el panel de administración, al hacer clic en el nombre de un alumno (Usuarios, Membresías, Inscripciones, Ventas, Deudas, Asistencia y lista de eventos) se abre su ficha: datos de contacto, RUT, categoría, apoderado, membresía activa con días y clases restantes, matrícula y packs vigentes.\n• Botón "Renovar membresía": en Membresías, cada membresía vencida de un alumno sin otra activa se puede renovar con un clic (alumno y plan precargados). También se puede renovar desde la ficha del alumno.\n• Los alumnos con la membresía vencida pueden "Solicitar renovación" desde su panel, con un comentario opcional. El administrador recibe un aviso (correo, notificación y contador en el menú) y la renueva o la rechaza con un motivo.\n• Si el administrador renueva o asigna una membresía a un alumno que tenía una solicitud pendiente, la solicitud se aprueba sola y el alumno recibe la notificación.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.15.0 — Rediseño visual: fuego y oro
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.15.0',
  'Rediseño visual: fuego y oro',
  E'• Nueva portada: la foto principal mantiene sus tonos naturales con más contraste y profundidad, y un aura de fuego sutil detrás del maestro, con chispas y brasas animadas a su alrededor.\n• El titular combina "DOMINA TU CUERPO." en dorado metálico y "FORTALECE TU MENTE." en rojo incandescente.\n• "Reservar clase" es un botón rojo-naranja con brillo, y "Ver horarios" lleva un borde dorado.\n• La barra de navegación usa una tipografía más fuerte, el logotipo en tonos de fuego, una línea inferior de rojo a dorado y el botón "Perfil" en dorado.\n• Los botones principales del sitio pasan a un degradado de rojo a naranja.'
)
ON CONFLICT (version) DO NOTHING;

-- SEED v1.16.0 — El QR de asistencia muestra la clase
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.16.0',
  'El QR de asistencia muestra la clase',
  E'• Sobre el QR de asistencia se muestra en grande el nombre de la clase, el horario, el profesor y si es para niños, juveniles, adultos o varias categorías.\n• Si la clase ya terminó y el QR sigue activo, aparece un aviso para finalizar la asistencia antes de abrir el QR de la clase siguiente.\n• Al escanear, el alumno ve qué clase está marcando antes de confirmar. Si la clase ya terminó o no corresponde a su categoría, se le avisa para que lo confirme con el profesor.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- PERFIL DE ATLETA (migración 048, espejo 1:1)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Helpers
-- ------------------------------------------------------------

-- Minúsculas sin tildes (búsqueda y alias). Sin extensión unaccent.
CREATE OR REPLACE FUNCTION public.athlete_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(translate(
    coalesce(p_text, ''),
    'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
    'AAAAEEEEIIIIOOOOUUUUNaaaaeeeeiiiioooouuuun'
  ));
$$;

-- Categoría por edad (misma regla que categoryFromBirth en la app):
-- nino < 10, juvenil 10–15, adulto >= 16. Sin fecha → adulto.
CREATE OR REPLACE FUNCTION public.athlete_category(p_birth_date date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_birth_date IS NULL THEN 'adulto'
    WHEN date_part('year', age(public.chile_today(), p_birth_date)) < 10 THEN 'nino'
    WHEN date_part('year', age(public.chile_today(), p_birth_date)) < 16 THEN 'juvenil'
    ELSE 'adulto'
  END;
$$;

-- Alias base a partir del nombre: "Matías Pérez" → "matias.perez".
CREATE OR REPLACE FUNCTION public.athlete_alias_base(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN length(v) >= 3 THEN v ELSE 'atleta' END
  FROM (
    SELECT trim(BOTH '.' FROM left(
      trim(BOTH '.' FROM regexp_replace(public.athlete_normalize(p_name), '[^a-z0-9]+', '.', 'g')),
      24
    )) AS v
  ) s;
$$;

-- ------------------------------------------------------------
-- 2) Tablas
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  profile_id uuid NOT NULL,
  alias text NOT NULL,
  nickname text,
  bio text,
  primary_discipline_id uuid,
  cover_theme text DEFAULT 'fuego' NOT NULL,
  visibility text DEFAULT 'comunidad' NOT NULL,
  hidden_by_admin boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT athlete_profiles_profile_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT athlete_profiles_discipline_fkey
    FOREIGN KEY (primary_discipline_id) REFERENCES public.disciplines(id) ON DELETE SET NULL,
  CONSTRAINT athlete_profiles_alias_format
    CHECK (alias ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'),
  CONSTRAINT athlete_profiles_nickname_length
    CHECK (nickname IS NULL OR char_length(nickname) <= 40),
  CONSTRAINT athlete_profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 150),
  CONSTRAINT athlete_profiles_cover_check
    CHECK (cover_theme IN ('fuego', 'oro', 'brasa', 'acero', 'noche')),
  CONSTRAINT athlete_profiles_visibility_check
    CHECK (visibility IN ('comunidad', 'privado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS athlete_profiles_alias_key
  ON public.athlete_profiles (alias);

CREATE TABLE IF NOT EXISTS public.athlete_trophies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  awarded_on date NOT NULL,
  discipline_id uuid,
  awarded_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_trophies_pkey PRIMARY KEY (id),
  CONSTRAINT athlete_trophies_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT athlete_trophies_discipline_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE SET NULL,
  CONSTRAINT athlete_trophies_awarded_by_fkey
    FOREIGN KEY (awarded_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT athlete_trophies_title_length
    CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  CONSTRAINT athlete_trophies_description_length
    CHECK (description IS NULL OR char_length(description) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_athlete_trophies_beneficiary
  ON public.athlete_trophies (beneficiary_id, awarded_on DESC);

CREATE TABLE IF NOT EXISTS public.belt_promotions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  discipline_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  promoted_on date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT belt_promotions_pkey PRIMARY KEY (id),
  CONSTRAINT belt_promotions_beneficiary_grade_key UNIQUE (beneficiary_id, grade_id),
  CONSTRAINT belt_promotions_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT belt_promotions_discipline_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE,
  CONSTRAINT belt_promotions_grade_fkey
    FOREIGN KEY (grade_id) REFERENCES public.belt_grades(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 3) RLS: lectura dueño o admin; escritura solo admin.
--    El resto de la comunidad lee vía RPC (sección 6).
-- ------------------------------------------------------------
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_profiles_select_own_or_admin" ON public.athlete_profiles;
CREATE POLICY "athlete_profiles_select_own_or_admin" ON public.athlete_profiles
  FOR SELECT USING (profile_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "athlete_profiles_admin_write" ON public.athlete_profiles;
CREATE POLICY "athlete_profiles_admin_write" ON public.athlete_profiles
  FOR ALL USING (public.is_admin());

ALTER TABLE public.athlete_trophies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_trophies_select_own_or_admin" ON public.athlete_trophies;
CREATE POLICY "athlete_trophies_select_own_or_admin" ON public.athlete_trophies
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "athlete_trophies_admin_write" ON public.athlete_trophies;
CREATE POLICY "athlete_trophies_admin_write" ON public.athlete_trophies
  FOR ALL USING (public.is_admin());

ALTER TABLE public.belt_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "belt_promotions_select_own_or_admin" ON public.belt_promotions;
CREATE POLICY "belt_promotions_select_own_or_admin" ON public.belt_promotions
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "belt_promotions_admin_write" ON public.belt_promotions;
CREATE POLICY "belt_promotions_admin_write" ON public.belt_promotions
  FOR ALL USING (public.is_admin());

DROP TRIGGER IF EXISTS set_athlete_profiles_updated_at ON public.athlete_profiles;
CREATE TRIGGER set_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 4) Alta automática del perfil de atleta (alias único)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_athlete_profile(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias text;
  v_base text;
  v_candidate text;
  v_n integer := 1;
BEGIN
  SELECT alias INTO v_alias FROM public.athlete_profiles WHERE profile_id = p_profile_id;
  IF FOUND THEN
    RETURN v_alias;
  END IF;

  SELECT public.athlete_alias_base(full_name) INTO v_base
  FROM public.profiles WHERE id = p_profile_id;
  IF v_base IS NULL THEN
    RETURN NULL;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.athlete_profiles WHERE alias = v_candidate) LOOP
    v_n := v_n + 1;
    v_candidate := v_base || v_n::text;
  END LOOP;

  INSERT INTO public.athlete_profiles (profile_id, alias)
  VALUES (p_profile_id, v_candidate)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT alias INTO v_alias FROM public.athlete_profiles WHERE profile_id = p_profile_id;
  RETURN v_alias;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_athlete_profile_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nunca bloquear el registro: si falla, el perfil se crea al abrirlo.
  BEGIN
    PERFORM public.ensure_athlete_profile(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_create_athlete_profile ON public.profiles;
CREATE TRIGGER trg_profiles_create_athlete_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_athlete_profile_on_profile();

-- Backfill: un perfil de atleta por cada cuenta existente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.athlete_profiles ap WHERE ap.profile_id = p.id)
    ORDER BY p.created_at
  LOOP
    PERFORM public.ensure_athlete_profile(r.id);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 5) Historial de cinturones
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_belt_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grade_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.grade_id IS NOT DISTINCT FROM OLD.grade_id THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.belt_promotions (beneficiary_id, discipline_id, grade_id, promoted_on)
  VALUES (NEW.beneficiary_id, NEW.discipline_id, NEW.grade_id, public.chile_today())
  ON CONFLICT (beneficiary_id, grade_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sport_profiles_belt_promotion ON public.sport_profiles;
CREATE TRIGGER trg_sport_profiles_belt_promotion
  AFTER INSERT OR UPDATE OF grade_id ON public.sport_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_belt_promotion();

-- Backfill: el grado actual de cada alumno, fechado en su última edición.
INSERT INTO public.belt_promotions (beneficiary_id, discipline_id, grade_id, promoted_on)
SELECT sp.beneficiary_id, sp.discipline_id, sp.grade_id,
       (timezone('America/Santiago', sp.updated_at))::date
FROM public.sport_profiles sp
WHERE sp.grade_id IS NOT NULL
ON CONFLICT (beneficiary_id, grade_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6) RPC de la comunidad (requieren sesión)
-- ------------------------------------------------------------

-- Buscador: nombre, apodo o alias (sin tildes) + filtros.
CREATE OR REPLACE FUNCTION public.search_athletes(
  p_query text DEFAULT NULL,
  p_discipline_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  profile_id uuid,
  alias text,
  full_name text,
  nickname text,
  category text,
  discipline_name text,
  grade_name text,
  grade_color text,
  medals integer,
  trophies integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_q text := nullif(public.athlete_normalize(trim(coalesce(p_query, ''))), '');
  v_category text := CASE WHEN p_category IN ('nino', 'juvenil', 'adulto') THEN p_category END;
  v_admin boolean := public.is_admin();
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, ap.alias AS a_alias, p.full_name AS a_name, ap.nickname AS a_nick,
           public.athlete_category(p.birth_date) AS a_cat, b.id AS bid,
           ap.primary_discipline_id AS a_primary
    FROM public.profiles p
    JOIN public.athlete_profiles ap ON ap.profile_id = p.id
    JOIN public.beneficiaries b ON b.profile_id = p.id
    WHERE p.active
      AND p.role_id <> 1
      AND (v_admin OR p.id = v_uid OR (ap.visibility = 'comunidad' AND NOT ap.hidden_by_admin))
      AND (v_q IS NULL
           OR public.athlete_normalize(p.full_name) LIKE '%' || v_q || '%'
           OR public.athlete_normalize(ap.nickname) LIKE '%' || v_q || '%'
           OR ap.alias LIKE '%' || v_q || '%')
      AND (v_category IS NULL OR public.athlete_category(p.birth_date) = v_category)
      AND (p_discipline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sport_profiles s
        WHERE s.beneficiary_id = b.id AND s.discipline_id = p_discipline_id
      ))
  ),
  scored AS (
    SELECT base.*,
      (SELECT count(*)::integer FROM public.sports_podiums sp
        WHERE sp.beneficiary_id = base.bid AND sp.position IN ('1', '2', '3')) AS a_medals,
      (SELECT count(*)::integer FROM public.athlete_trophies t
        WHERE t.beneficiary_id = base.bid) AS a_trophies
    FROM base
  )
  SELECT s.pid, s.a_alias, s.a_name, s.a_nick, s.a_cat,
         belt.d_name, belt.g_name, belt.g_color, s.a_medals, s.a_trophies
  FROM scored s
  LEFT JOIN LATERAL (
    SELECT d.name AS d_name, g.name AS g_name, g.color AS g_color
    FROM public.sport_profiles sp
    JOIN public.disciplines d ON d.id = sp.discipline_id
    LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = s.bid
    ORDER BY (sp.discipline_id = p_discipline_id) DESC NULLS LAST,
             (sp.discipline_id = s.a_primary) DESC NULLS LAST,
             g.position DESC NULLS LAST
    LIMIT 1
  ) belt ON true
  ORDER BY CASE WHEN v_q IS NULL THEN s.a_medals + s.a_trophies ELSE 0 END DESC,
           s.a_name
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

-- Perfil completo por alias, id de cuenta o 'yo' (la cuenta propia).
CREATE OR REPLACE FUNCTION public.get_athlete_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_pid uuid;
  v_p public.profiles%ROWTYPE;
  v_ap public.athlete_profiles%ROWTYPE;
  v_bid uuid;
  v_owner boolean;
  v_member_since date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  IF v_handle IN ('', 'yo') THEN
    v_pid := v_uid;
  ELSIF v_handle ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pid := v_handle::uuid;
  ELSE
    SELECT ap.profile_id INTO v_pid FROM public.athlete_profiles ap WHERE ap.alias = v_handle;
  END IF;
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_pid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_owner := v_pid = v_uid;

  -- Las cuentas de administración no tienen perfil de atleta visible.
  IF v_p.role_id = 1 AND NOT v_owner AND NOT v_admin THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_athlete_profile(v_pid);
  SELECT * INTO v_ap FROM public.athlete_profiles WHERE profile_id = v_pid;
  SELECT id INTO v_bid FROM public.beneficiaries WHERE profile_id = v_pid;

  IF NOT (v_owner OR v_admin) AND (v_ap.hidden_by_admin OR v_ap.visibility = 'privado') THEN
    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme
      )
    );
  END IF;

  SELECT coalesce(
    (SELECT min(ae.start_date) FROM public.academy_enrollments ae WHERE ae.beneficiary_id = v_bid),
    (timezone('America/Santiago', v_p.created_at))::date
  ) INTO v_member_since;

  RETURN jsonb_build_object(
    'restricted', false,
    'profile', jsonb_build_object(
      'id', v_p.id,
      'alias', v_ap.alias,
      'full_name', v_p.full_name,
      'nickname', v_ap.nickname,
      'bio', v_ap.bio,
      'cover_theme', v_ap.cover_theme,
      'visibility', v_ap.visibility,
      'hidden_by_admin', v_ap.hidden_by_admin,
      'primary_discipline_id', v_ap.primary_discipline_id,
      'category', public.athlete_category(v_p.birth_date),
      'member_since', v_member_since,
      'active', v_p.active,
      'is_owner', v_owner
    ),
    'disciplines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'discipline_id', d.id,
        'name', d.name,
        'color_hex', d.color_hex,
        'grade_name', g.name,
        'grade_color', g.color,
        'grade_position', g.position
      ) ORDER BY d.name)
      FROM public.sport_profiles sp
      JOIN public.disciplines d ON d.id = sp.discipline_id
      LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'podiums', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'tournament', sp.tournament,
        'event_date', sp.event_date,
        'discipline', d.name,
        'category', sp.category,
        'position', sp.position,
        'description', sp.description
      ) ORDER BY sp.event_date DESC)
      FROM public.sports_podiums sp
      LEFT JOIN public.disciplines d ON d.id = sp.discipline_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'trophies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'awarded_on', t.awarded_on,
        'discipline', d.name
      ) ORDER BY t.awarded_on DESC)
      FROM public.athlete_trophies t
      LEFT JOIN public.disciplines d ON d.id = t.discipline_id
      WHERE t.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'promotions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'discipline', d.name,
        'grade_name', g.name,
        'grade_color', g.color,
        'promoted_on', bp.promoted_on
      ) ORDER BY bp.promoted_on DESC, g.position DESC)
      FROM public.belt_promotions bp
      JOIN public.disciplines d ON d.id = bp.discipline_id
      JOIN public.belt_grades g ON g.id = bp.grade_id
      WHERE bp.beneficiary_id = v_bid
    ), '[]'::jsonb)
  );
END;
$$;

-- El alumno personaliza su propio perfil (nunca grados ni logros).
CREATE OR REPLACE FUNCTION public.update_my_athlete_profile(
  p_alias text,
  p_nickname text,
  p_bio text,
  p_primary_discipline_id uuid,
  p_cover_theme text,
  p_visibility text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alias text := lower(trim(coalesce(p_alias, '')));
  v_nickname text := nullif(trim(coalesce(p_nickname, '')), '');
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;
  IF v_alias !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' THEN
    RAISE EXCEPTION 'ALIAS_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.athlete_profiles WHERE alias = v_alias AND profile_id <> v_uid) THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_nickname IS NOT NULL AND char_length(v_nickname) > 40 THEN
    RAISE EXCEPTION 'NICKNAME_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF v_bio IS NOT NULL AND char_length(v_bio) > 150 THEN
    RAISE EXCEPTION 'BIO_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_cover_theme, '') NOT IN ('fuego', 'oro', 'brasa', 'acero', 'noche') THEN
    RAISE EXCEPTION 'COVER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_visibility, '') NOT IN ('comunidad', 'privado') THEN
    RAISE EXCEPTION 'VISIBILITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_primary_discipline_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sport_profiles sp
    JOIN public.beneficiaries b ON b.id = sp.beneficiary_id
    WHERE b.profile_id = v_uid AND sp.discipline_id = p_primary_discipline_id
  ) THEN
    RAISE EXCEPTION 'DISCIPLINE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_athlete_profile(v_uid);

  BEGIN
    UPDATE public.athlete_profiles
    SET alias = v_alias,
        nickname = v_nickname,
        bio = v_bio,
        primary_discipline_id = p_primary_discipline_id,
        cover_theme = p_cover_theme,
        visibility = p_visibility
    WHERE profile_id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN v_alias;
END;
$$;

-- ------------------------------------------------------------
-- 7) Permisos de funciones
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_athlete_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_athlete_profile(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_athlete_profile_on_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_athlete_profile_on_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.record_belt_promotion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_belt_promotion() FROM anon, authenticated;

-- SEED v1.17.0 — Perfil de Atleta
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.17.0',
  'Perfil de Atleta',
  E'• Cada alumno tiene un perfil de atleta al estilo Instagram en /atletas: portada, iniciales con el color de su cinturón, contadores de torneos, medallas, trofeos y años en la academia, y sus disciplinas como destacados.\n• Las publicaciones del perfil son tarjetas de logros que se crean solas: campeonatos, podios, torneos, cinturones y trofeos. No se publican fotos.\n• Pestañas Publicaciones, Palmarés y Torneos, con visor de cada logro.\n• Cada alumno personaliza su perfil: nombre de usuario, apodo, biografía, disciplina principal, portada y privacidad (comunidad o privado).\n• Buscador de atletas por nombre, apodo o usuario, con filtros por categoría y disciplina, y perfiles visitados recientemente.\n• Los perfiles solo se ven con la sesión iniciada. El administrador otorga trofeos, puede ocultar un perfil y abre el perfil de atleta desde la ficha rápida del alumno.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- PUBLICACIONES DEL ATLETA (migración 050, espejo 1:1)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Publicaciones del alumno
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athlete_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid NOT NULL,
  kind text NOT NULL,
  title text,
  body text,
  event_date date NOT NULL,
  position text,
  discipline text,
  color text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_posts_pkey PRIMARY KEY (id),
  CONSTRAINT athlete_posts_profile_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT athlete_posts_kind_check
    CHECK (kind IN ('torneo', 'cinturon', 'trofeo', 'hito', 'publicacion')),
  CONSTRAINT athlete_posts_title_check
    CHECK (
      (kind = 'publicacion' AND (title IS NULL OR char_length(title) <= 80))
      OR (kind <> 'publicacion' AND title IS NOT NULL AND char_length(trim(title)) BETWEEN 1 AND 80)
    ),
  CONSTRAINT athlete_posts_body_check
    CHECK (
      (body IS NULL OR char_length(body) <= 1000)
      AND (kind <> 'publicacion' OR (body IS NOT NULL AND char_length(trim(body)) >= 1))
    ),
  CONSTRAINT athlete_posts_discipline_length
    CHECK (discipline IS NULL OR char_length(discipline) <= 60),
  CONSTRAINT athlete_posts_color_check
    CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$')
);

-- Torneo exige resultado; los demás tipos no lo llevan. "IS NOT NULL"
-- explícito: un CHECK que evalúa a NULL deja pasar la fila.
ALTER TABLE public.athlete_posts DROP CONSTRAINT IF EXISTS athlete_posts_position_check;
ALTER TABLE public.athlete_posts
  ADD CONSTRAINT athlete_posts_position_check CHECK (
    (kind = 'torneo' AND position IS NOT NULL AND position IN ('1', '2', '3', 'participacion'))
    OR (kind <> 'torneo' AND position IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_athlete_posts_profile
  ON public.athlete_posts (profile_id, event_date DESC);

-- Lectura dueño o admin (la comunidad lee por get_athlete_profile).
-- El alumno escribe solo lo suyo; el admin puede moderar todo.
ALTER TABLE public.athlete_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_posts_select_own_or_admin" ON public.athlete_posts;
CREATE POLICY "athlete_posts_select_own_or_admin" ON public.athlete_posts
  FOR SELECT USING (profile_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "athlete_posts_owner_insert" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_insert" ON public.athlete_posts
  FOR INSERT WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_owner_update" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_update" ON public.athlete_posts
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_owner_delete" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_delete" ON public.athlete_posts
  FOR DELETE USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_admin_write" ON public.athlete_posts;
CREATE POLICY "athlete_posts_admin_write" ON public.athlete_posts
  FOR ALL USING (public.is_admin());

DROP TRIGGER IF EXISTS set_athlete_posts_updated_at ON public.athlete_posts;
CREATE TRIGGER set_athlete_posts_updated_at
  BEFORE UPDATE ON public.athlete_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 2) Publicaciones fijadas
-- ------------------------------------------------------------
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS pinned_posts text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_pinned_max;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_pinned_max CHECK (cardinality(pinned_posts) <= 3);

CREATE OR REPLACE FUNCTION public.set_my_pinned_posts(p_keys text[])
RETURNS text[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_keys text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(DISTINCT k), '{}'::text[]) INTO v_keys
  FROM unnest(coalesce(p_keys, '{}'::text[])) AS k;

  IF cardinality(v_keys) > 3 THEN
    RAISE EXCEPTION 'PIN_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) AS k
    WHERE k !~ '^(podio|cinturon|trofeo|propio)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_athlete_profile(v_uid);
  UPDATE public.athlete_profiles SET pinned_posts = v_keys WHERE profile_id = v_uid;
  RETURN v_keys;
END;
$$;

-- ------------------------------------------------------------
-- 3) Buscador: las publicaciones propias suman medallas y trofeos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_athletes(
  p_query text DEFAULT NULL,
  p_discipline_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  profile_id uuid,
  alias text,
  full_name text,
  nickname text,
  category text,
  discipline_name text,
  grade_name text,
  grade_color text,
  medals integer,
  trophies integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_q text := nullif(public.athlete_normalize(trim(coalesce(p_query, ''))), '');
  v_category text := CASE WHEN p_category IN ('nino', 'juvenil', 'adulto') THEN p_category END;
  v_admin boolean := public.is_admin();
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, ap.alias AS a_alias, p.full_name AS a_name, ap.nickname AS a_nick,
           public.athlete_category(p.birth_date) AS a_cat, b.id AS bid,
           ap.primary_discipline_id AS a_primary
    FROM public.profiles p
    JOIN public.athlete_profiles ap ON ap.profile_id = p.id
    JOIN public.beneficiaries b ON b.profile_id = p.id
    WHERE p.active
      AND p.role_id <> 1
      AND (v_admin OR p.id = v_uid OR (ap.visibility = 'comunidad' AND NOT ap.hidden_by_admin))
      AND (v_q IS NULL
           OR public.athlete_normalize(p.full_name) LIKE '%' || v_q || '%'
           OR public.athlete_normalize(ap.nickname) LIKE '%' || v_q || '%'
           OR ap.alias LIKE '%' || v_q || '%')
      AND (v_category IS NULL OR public.athlete_category(p.birth_date) = v_category)
      AND (p_discipline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sport_profiles s
        WHERE s.beneficiary_id = b.id AND s.discipline_id = p_discipline_id
      ))
  ),
  scored AS (
    SELECT base.*,
      (SELECT count(*)::integer FROM public.sports_podiums sp
        WHERE sp.beneficiary_id = base.bid AND sp.position IN ('1', '2', '3'))
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'torneo' AND po.position IN ('1', '2', '3')) AS a_medals,
      (SELECT count(*)::integer FROM public.athlete_trophies t
        WHERE t.beneficiary_id = base.bid)
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'trofeo') AS a_trophies
    FROM base
  )
  SELECT s.pid, s.a_alias, s.a_name, s.a_nick, s.a_cat,
         belt.d_name, belt.g_name, belt.g_color, s.a_medals, s.a_trophies
  FROM scored s
  LEFT JOIN LATERAL (
    SELECT d.name AS d_name, g.name AS g_name, g.color AS g_color
    FROM public.sport_profiles sp
    JOIN public.disciplines d ON d.id = sp.discipline_id
    LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = s.bid
    ORDER BY (sp.discipline_id = p_discipline_id) DESC NULLS LAST,
             (sp.discipline_id = s.a_primary) DESC NULLS LAST,
             g.position DESC NULLS LAST
    LIMIT 1
  ) belt ON true
  ORDER BY CASE WHEN v_q IS NULL THEN s.a_medals + s.a_trophies ELSE 0 END DESC,
           s.a_name
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

-- ------------------------------------------------------------
-- 4) Perfil: publicaciones propias, fijadas y modo admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_athlete_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_pid uuid;
  v_p public.profiles%ROWTYPE;
  v_ap public.athlete_profiles%ROWTYPE;
  v_bid uuid;
  v_owner boolean;
  v_member_since date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  IF v_handle IN ('', 'yo') THEN
    v_pid := v_uid;
  ELSIF v_handle ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pid := v_handle::uuid;
  ELSE
    SELECT ap.profile_id INTO v_pid FROM public.athlete_profiles ap WHERE ap.alias = v_handle;
  END IF;
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_pid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_owner := v_pid = v_uid;

  -- Las cuentas de administración no tienen perfil de atleta visible.
  IF v_p.role_id = 1 AND NOT v_owner AND NOT v_admin THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_athlete_profile(v_pid);
  SELECT * INTO v_ap FROM public.athlete_profiles WHERE profile_id = v_pid;
  SELECT id INTO v_bid FROM public.beneficiaries WHERE profile_id = v_pid;

  IF NOT (v_owner OR v_admin) AND (v_ap.hidden_by_admin OR v_ap.visibility = 'privado') THEN
    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme
      )
    );
  END IF;

  SELECT coalesce(
    (SELECT min(ae.start_date) FROM public.academy_enrollments ae WHERE ae.beneficiary_id = v_bid),
    (timezone('America/Santiago', v_p.created_at))::date
  ) INTO v_member_since;

  RETURN jsonb_build_object(
    'restricted', false,
    'viewer_is_admin', v_admin,
    'profile', jsonb_build_object(
      'id', v_p.id,
      'alias', v_ap.alias,
      'full_name', v_p.full_name,
      'nickname', v_ap.nickname,
      'bio', v_ap.bio,
      'cover_theme', v_ap.cover_theme,
      'visibility', v_ap.visibility,
      'hidden_by_admin', v_ap.hidden_by_admin,
      'primary_discipline_id', v_ap.primary_discipline_id,
      'pinned_posts', to_jsonb(v_ap.pinned_posts),
      'category', public.athlete_category(v_p.birth_date),
      'member_since', v_member_since,
      'active', v_p.active,
      'is_owner', v_owner
    ),
    'disciplines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'discipline_id', d.id,
        'name', d.name,
        'color_hex', d.color_hex,
        'grade_name', g.name,
        'grade_color', g.color,
        'grade_position', g.position
      ) ORDER BY d.name)
      FROM public.sport_profiles sp
      JOIN public.disciplines d ON d.id = sp.discipline_id
      LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'podiums', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'tournament', sp.tournament,
        'event_date', sp.event_date,
        'discipline', d.name,
        'category', sp.category,
        'position', sp.position,
        'description', sp.description
      ) ORDER BY sp.event_date DESC)
      FROM public.sports_podiums sp
      LEFT JOIN public.disciplines d ON d.id = sp.discipline_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'trophies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'awarded_on', t.awarded_on,
        'discipline', d.name
      ) ORDER BY t.awarded_on DESC)
      FROM public.athlete_trophies t
      LEFT JOIN public.disciplines d ON d.id = t.discipline_id
      WHERE t.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'promotions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'discipline', d.name,
        'grade_name', g.name,
        'grade_color', g.color,
        'promoted_on', bp.promoted_on
      ) ORDER BY bp.promoted_on DESC, g.position DESC)
      FROM public.belt_promotions bp
      JOIN public.disciplines d ON d.id = bp.discipline_id
      JOIN public.belt_grades g ON g.id = bp.grade_id
      WHERE bp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'posts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', po.id,
        'kind', po.kind,
        'title', po.title,
        'body', po.body,
        'event_date', po.event_date,
        'position', po.position,
        'discipline', po.discipline,
        'color', po.color,
        'created_at', po.created_at
      ) ORDER BY po.event_date DESC, po.created_at DESC)
      FROM public.athlete_posts po
      WHERE po.profile_id = v_pid
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 5) Permisos de funciones
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_my_pinned_posts(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_pinned_posts(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_pinned_posts(text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;

-- SEED v1.18.0 — Publica en tu perfil de atleta
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.18.0',
  'Publica en tu perfil de atleta',
  E'• Cada alumno publica por su cuenta en su perfil de atleta, sin depender del administrador: torneos con su resultado, cinturones (también de otras escuelas), trofeos, hitos y publicaciones de texto libre.\n• Lo que registra la academia lleva la insignia "Verificado por ZonaElite"; lo que publica el alumno se muestra como "Publicado por el atleta". Ambos suman en los contadores de torneos, medallas y trofeos.\n• Se pueden fijar hasta 3 publicaciones al inicio del perfil.\n• El alumno edita o elimina sus publicaciones cuando quiera; el administrador puede eliminarlas si no corresponden.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- AVATARES Y PORTADAS DEL ATLETA (migración 052, espejo 1:1)
-- ============================================================

ALTER TABLE public.athlete_profiles ADD COLUMN IF NOT EXISTS avatar_key text;
ALTER TABLE public.athlete_profiles ADD COLUMN IF NOT EXISTS cover_image text;

ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_avatar_key_format;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_avatar_key_format
  CHECK (avatar_key IS NULL OR avatar_key ~ '^[a-z0-9-]{1,30}$');
ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_cover_image_format;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_cover_image_format
  CHECK (cover_image IS NULL OR cover_image ~ '^[a-z0-9-]{1,30}$');

-- La firma cambia (2 parámetros nuevos): se elimina la versión de 6.
DROP FUNCTION IF EXISTS public.update_my_athlete_profile(text, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.update_my_athlete_profile(
  p_alias text,
  p_nickname text,
  p_bio text,
  p_primary_discipline_id uuid,
  p_cover_theme text,
  p_visibility text,
  p_avatar_key text DEFAULT NULL,
  p_cover_image text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alias text := lower(trim(coalesce(p_alias, '')));
  v_nickname text := nullif(trim(coalesce(p_nickname, '')), '');
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
  v_avatar text := nullif(trim(coalesce(p_avatar_key, '')), '');
  v_cover_image text := nullif(trim(coalesce(p_cover_image, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;
  IF v_alias !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' THEN
    RAISE EXCEPTION 'ALIAS_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.athlete_profiles WHERE alias = v_alias AND profile_id <> v_uid) THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_nickname IS NOT NULL AND char_length(v_nickname) > 40 THEN
    RAISE EXCEPTION 'NICKNAME_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF v_bio IS NOT NULL AND char_length(v_bio) > 150 THEN
    RAISE EXCEPTION 'BIO_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_cover_theme, '') NOT IN ('fuego', 'oro', 'brasa', 'acero', 'noche') THEN
    RAISE EXCEPTION 'COVER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_visibility, '') NOT IN ('comunidad', 'privado') THEN
    RAISE EXCEPTION 'VISIBILITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_avatar IS NOT NULL AND v_avatar !~ '^[a-z0-9-]{1,30}$' THEN
    RAISE EXCEPTION 'AVATAR_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_cover_image IS NOT NULL AND v_cover_image !~ '^[a-z0-9-]{1,30}$' THEN
    RAISE EXCEPTION 'COVER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_primary_discipline_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sport_profiles sp
    JOIN public.beneficiaries b ON b.id = sp.beneficiary_id
    WHERE b.profile_id = v_uid AND sp.discipline_id = p_primary_discipline_id
  ) THEN
    RAISE EXCEPTION 'DISCIPLINE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_athlete_profile(v_uid);

  BEGIN
    UPDATE public.athlete_profiles
    SET alias = v_alias,
        nickname = v_nickname,
        bio = v_bio,
        primary_discipline_id = p_primary_discipline_id,
        cover_theme = p_cover_theme,
        visibility = p_visibility,
        avatar_key = v_avatar,
        cover_image = v_cover_image
    WHERE profile_id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN v_alias;
END;
$$;

-- El tipo de retorno cambia (+ avatar_key): DROP + CREATE.
DROP FUNCTION IF EXISTS public.search_athletes(text, uuid, text, integer);

CREATE FUNCTION public.search_athletes(
  p_query text DEFAULT NULL,
  p_discipline_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  profile_id uuid,
  alias text,
  full_name text,
  nickname text,
  category text,
  discipline_name text,
  grade_name text,
  grade_color text,
  avatar_key text,
  medals integer,
  trophies integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_q text := nullif(public.athlete_normalize(trim(coalesce(p_query, ''))), '');
  v_category text := CASE WHEN p_category IN ('nino', 'juvenil', 'adulto') THEN p_category END;
  v_admin boolean := public.is_admin();
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, ap.alias AS a_alias, p.full_name AS a_name, ap.nickname AS a_nick,
           public.athlete_category(p.birth_date) AS a_cat, b.id AS bid,
           ap.primary_discipline_id AS a_primary, ap.avatar_key AS a_avatar
    FROM public.profiles p
    JOIN public.athlete_profiles ap ON ap.profile_id = p.id
    JOIN public.beneficiaries b ON b.profile_id = p.id
    WHERE p.active
      AND p.role_id <> 1
      AND (v_admin OR p.id = v_uid OR (ap.visibility = 'comunidad' AND NOT ap.hidden_by_admin))
      AND (v_q IS NULL
           OR public.athlete_normalize(p.full_name) LIKE '%' || v_q || '%'
           OR public.athlete_normalize(ap.nickname) LIKE '%' || v_q || '%'
           OR ap.alias LIKE '%' || v_q || '%')
      AND (v_category IS NULL OR public.athlete_category(p.birth_date) = v_category)
      AND (p_discipline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sport_profiles s
        WHERE s.beneficiary_id = b.id AND s.discipline_id = p_discipline_id
      ))
  ),
  scored AS (
    SELECT base.*,
      (SELECT count(*)::integer FROM public.sports_podiums sp
        WHERE sp.beneficiary_id = base.bid AND sp.position IN ('1', '2', '3'))
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'torneo' AND po.position IN ('1', '2', '3')) AS a_medals,
      (SELECT count(*)::integer FROM public.athlete_trophies t
        WHERE t.beneficiary_id = base.bid)
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'trofeo') AS a_trophies
    FROM base
  )
  SELECT s.pid, s.a_alias, s.a_name, s.a_nick, s.a_cat,
         belt.d_name, belt.g_name, belt.g_color, s.a_avatar, s.a_medals, s.a_trophies
  FROM scored s
  LEFT JOIN LATERAL (
    SELECT d.name AS d_name, g.name AS g_name, g.color AS g_color
    FROM public.sport_profiles sp
    JOIN public.disciplines d ON d.id = sp.discipline_id
    LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = s.bid
    ORDER BY (sp.discipline_id = p_discipline_id) DESC NULLS LAST,
             (sp.discipline_id = s.a_primary) DESC NULLS LAST,
             g.position DESC NULLS LAST
    LIMIT 1
  ) belt ON true
  ORDER BY CASE WHEN v_q IS NULL THEN s.a_medals + s.a_trophies ELSE 0 END DESC,
           s.a_name
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_athlete_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_pid uuid;
  v_p public.profiles%ROWTYPE;
  v_ap public.athlete_profiles%ROWTYPE;
  v_bid uuid;
  v_owner boolean;
  v_member_since date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  IF v_handle IN ('', 'yo') THEN
    v_pid := v_uid;
  ELSIF v_handle ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pid := v_handle::uuid;
  ELSE
    SELECT ap.profile_id INTO v_pid FROM public.athlete_profiles ap WHERE ap.alias = v_handle;
  END IF;
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_pid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_owner := v_pid = v_uid;

  -- Las cuentas de administración no tienen perfil de atleta visible.
  IF v_p.role_id = 1 AND NOT v_owner AND NOT v_admin THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_athlete_profile(v_pid);
  SELECT * INTO v_ap FROM public.athlete_profiles WHERE profile_id = v_pid;
  SELECT id INTO v_bid FROM public.beneficiaries WHERE profile_id = v_pid;

  IF NOT (v_owner OR v_admin) AND (v_ap.hidden_by_admin OR v_ap.visibility = 'privado') THEN
    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme,
        'avatar_key', v_ap.avatar_key,
        'cover_image', v_ap.cover_image
      )
    );
  END IF;

  SELECT coalesce(
    (SELECT min(ae.start_date) FROM public.academy_enrollments ae WHERE ae.beneficiary_id = v_bid),
    (timezone('America/Santiago', v_p.created_at))::date
  ) INTO v_member_since;

  RETURN jsonb_build_object(
    'restricted', false,
    'viewer_is_admin', v_admin,
    'profile', jsonb_build_object(
      'id', v_p.id,
      'alias', v_ap.alias,
      'full_name', v_p.full_name,
      'nickname', v_ap.nickname,
      'bio', v_ap.bio,
      'cover_theme', v_ap.cover_theme,
      'avatar_key', v_ap.avatar_key,
      'cover_image', v_ap.cover_image,
      'visibility', v_ap.visibility,
      'hidden_by_admin', v_ap.hidden_by_admin,
      'primary_discipline_id', v_ap.primary_discipline_id,
      'pinned_posts', to_jsonb(v_ap.pinned_posts),
      'category', public.athlete_category(v_p.birth_date),
      'member_since', v_member_since,
      'active', v_p.active,
      'is_owner', v_owner
    ),
    'disciplines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'discipline_id', d.id,
        'name', d.name,
        'color_hex', d.color_hex,
        'grade_name', g.name,
        'grade_color', g.color,
        'grade_position', g.position
      ) ORDER BY d.name)
      FROM public.sport_profiles sp
      JOIN public.disciplines d ON d.id = sp.discipline_id
      LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'podiums', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'tournament', sp.tournament,
        'event_date', sp.event_date,
        'discipline', d.name,
        'category', sp.category,
        'position', sp.position,
        'description', sp.description
      ) ORDER BY sp.event_date DESC)
      FROM public.sports_podiums sp
      LEFT JOIN public.disciplines d ON d.id = sp.discipline_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'trophies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'awarded_on', t.awarded_on,
        'discipline', d.name
      ) ORDER BY t.awarded_on DESC)
      FROM public.athlete_trophies t
      LEFT JOIN public.disciplines d ON d.id = t.discipline_id
      WHERE t.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'promotions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'discipline', d.name,
        'grade_name', g.name,
        'grade_color', g.color,
        'promoted_on', bp.promoted_on
      ) ORDER BY bp.promoted_on DESC, g.position DESC)
      FROM public.belt_promotions bp
      JOIN public.disciplines d ON d.id = bp.discipline_id
      JOIN public.belt_grades g ON g.id = bp.grade_id
      WHERE bp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'posts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', po.id,
        'kind', po.kind,
        'title', po.title,
        'body', po.body,
        'event_date', po.event_date,
        'position', po.position,
        'discipline', po.discipline,
        'color', po.color,
        'created_at', po.created_at
      ) ORDER BY po.event_date DESC, po.created_at DESC)
      FROM public.athlete_posts po
      WHERE po.profile_id = v_pid
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;

-- SEED v1.19.0 — Avatares y portadas del perfil
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.19.0',
  'Avatares y portadas del perfil',
  E'• Nuevos avatares para el perfil: 16 ilustraciones de artes marciales (patada, guante, combate, meditación, fuego, medalla, loto y más). El anillo del avatar sigue mostrando el color del cinturón. También se pueden seguir usando las iniciales.\n• Nuevas portadas ilustradas: dojo al atardecer, montañas, olas, brasas, bambú, tatami, energía, sakura y ring, además de los colores de la academia.\n• El botón "Perfil" de la barra superior abre el perfil de atleta. En "Editar perfil", la pestaña Perfil cambia el avatar, la portada, el usuario, el apodo, la biografía y la privacidad, y la pestaña Cuenta los datos personales, la contraseña y el cierre de sesión.\n• No se suben fotos: avatares y portadas se eligen de un catálogo fijo.'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- COLOR DEL CINTURÓN EN PERFIL RESTRINGIDO (migración 054, espejo 1:1)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_athlete_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_pid uuid;
  v_p public.profiles%ROWTYPE;
  v_ap public.athlete_profiles%ROWTYPE;
  v_bid uuid;
  v_owner boolean;
  v_member_since date;
  v_ring_color text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  IF v_handle IN ('', 'yo') THEN
    v_pid := v_uid;
  ELSIF v_handle ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pid := v_handle::uuid;
  ELSE
    SELECT ap.profile_id INTO v_pid FROM public.athlete_profiles ap WHERE ap.alias = v_handle;
  END IF;
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_pid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_owner := v_pid = v_uid;

  -- Las cuentas de administración no tienen perfil de atleta visible.
  IF v_p.role_id = 1 AND NOT v_owner AND NOT v_admin THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_athlete_profile(v_pid);
  SELECT * INTO v_ap FROM public.athlete_profiles WHERE profile_id = v_pid;
  SELECT id INTO v_bid FROM public.beneficiaries WHERE profile_id = v_pid;

  IF NOT (v_owner OR v_admin) AND (v_ap.hidden_by_admin OR v_ap.visibility = 'privado') THEN
    -- Solo el color del cinturón (disciplina principal o mayor grado)
    -- para el borde del avatar; ningún otro dato deportivo.
    SELECT g.color INTO v_ring_color
    FROM public.sport_profiles sp
    JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = v_bid
    ORDER BY (sp.discipline_id = v_ap.primary_discipline_id) DESC NULLS LAST, g.position DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme,
        'avatar_key', v_ap.avatar_key,
        'cover_image', v_ap.cover_image,
        'ring_color', v_ring_color
      )
    );
  END IF;

  SELECT coalesce(
    (SELECT min(ae.start_date) FROM public.academy_enrollments ae WHERE ae.beneficiary_id = v_bid),
    (timezone('America/Santiago', v_p.created_at))::date
  ) INTO v_member_since;

  RETURN jsonb_build_object(
    'restricted', false,
    'viewer_is_admin', v_admin,
    'profile', jsonb_build_object(
      'id', v_p.id,
      'alias', v_ap.alias,
      'full_name', v_p.full_name,
      'nickname', v_ap.nickname,
      'bio', v_ap.bio,
      'cover_theme', v_ap.cover_theme,
      'avatar_key', v_ap.avatar_key,
      'cover_image', v_ap.cover_image,
      'visibility', v_ap.visibility,
      'hidden_by_admin', v_ap.hidden_by_admin,
      'primary_discipline_id', v_ap.primary_discipline_id,
      'pinned_posts', to_jsonb(v_ap.pinned_posts),
      'category', public.athlete_category(v_p.birth_date),
      'member_since', v_member_since,
      'active', v_p.active,
      'is_owner', v_owner
    ),
    'disciplines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'discipline_id', d.id,
        'name', d.name,
        'color_hex', d.color_hex,
        'grade_name', g.name,
        'grade_color', g.color,
        'grade_position', g.position
      ) ORDER BY d.name)
      FROM public.sport_profiles sp
      JOIN public.disciplines d ON d.id = sp.discipline_id
      LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'podiums', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'tournament', sp.tournament,
        'event_date', sp.event_date,
        'discipline', d.name,
        'category', sp.category,
        'position', sp.position,
        'description', sp.description
      ) ORDER BY sp.event_date DESC)
      FROM public.sports_podiums sp
      LEFT JOIN public.disciplines d ON d.id = sp.discipline_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'trophies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'awarded_on', t.awarded_on,
        'discipline', d.name
      ) ORDER BY t.awarded_on DESC)
      FROM public.athlete_trophies t
      LEFT JOIN public.disciplines d ON d.id = t.discipline_id
      WHERE t.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'promotions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'discipline', d.name,
        'grade_name', g.name,
        'grade_color', g.color,
        'promoted_on', bp.promoted_on
      ) ORDER BY bp.promoted_on DESC, g.position DESC)
      FROM public.belt_promotions bp
      JOIN public.disciplines d ON d.id = bp.discipline_id
      JOIN public.belt_grades g ON g.id = bp.grade_id
      WHERE bp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'posts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', po.id,
        'kind', po.kind,
        'title', po.title,
        'body', po.body,
        'event_date', po.event_date,
        'position', po.position,
        'discipline', po.discipline,
        'color', po.color,
        'created_at', po.created_at
      ) ORDER BY po.event_date DESC, po.created_at DESC)
      FROM public.athlete_posts po
      WHERE po.profile_id = v_pid
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;
