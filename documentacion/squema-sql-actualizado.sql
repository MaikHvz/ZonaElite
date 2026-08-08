-- =====================================================================
-- SCHEMA COMPLETO DE LA BASE DE DATOS: ZonaElite
-- Proyecto: sfkkfcticgqdqvzthimz
-- Generado automaticamente desde PostgREST OpenAPI + contexto SQL
-- =====================================================================

-- =====================================================
-- TIPOS ENUM
-- =====================================================
-- Nota: Supabase no expone ENUMs via PostgREST.
-- Los valores de texto se usan en lugar de ENUMs nativos:
--   dependents.category: 'nino' | 'adulto'
-- membership_plans.category: 'adulto' | 'nino'
-- membership_plans.tokens: NULL = ilimitado, nÃºmero = clases incluidas
--   schedules.category: 'ninos' | 'adultos' | 'ambos'
--   attendance.status: 'presente' | 'ausente' | 'justificado'
--   blog_posts.status: 'borrador' | 'publicado' | 'programado'
--   product_orders.status: 'borrador' | 'pagado' | 'enviado' | 'entregado' | 'cancelado'
--   payments.status: 'pendiente' | 'pagado' | 'rechazado' | 'cancelado' | 'fallido' | 'reembolsado'
--   memberships.status: 'activa' | 'vencida' | 'cancelada' | 'suspendida'
--   notifications.type: 'info' | 'alerta' | 'sistema'
--   notifications.target: 'todos' | 'adultos' | 'ninos' | 'staff'
--   events.type: 'clase' | 'torneo' | 'seminario' | 'otro'
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

-- Trigger function: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    4
  );
  RETURN NEW;
END;
$$;

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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
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
  category text DEFAULT 'ambos' NOT NULL,
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT dependents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid,
  dependent_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT beneficiaries_pkey PRIMARY KEY (id)
);

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
  CONSTRAINT membership_plans_pkey PRIMARY KEY (id)
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
  user_id uuid NOT NULL,
  status text DEFAULT 'borrador' NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT product_orders_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
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
  CHECK (category IN ('ninos', 'adultos', 'ambos'));

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
STABLE
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
