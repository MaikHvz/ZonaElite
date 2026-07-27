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
--   membership_plans.category: 'adulto' | 'nino'
--   schedules.category: 'ninos' | 'adultos' | 'ambos'
--   attendance.status: 'presente' | 'ausente' | 'justificado'
--   blog_posts.status: 'borrador' | 'publicado' | 'programado'
--   product_orders.status: 'borrador' | 'pagado' | 'enviado' | 'entregado' | 'cancelado'
--   payments.status: 'pendiente' | 'pagado' | 'fallido' | 'reembolsado'
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

-- Verifica si el usuario es dueño de un beneficiario
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
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT academy_settings_pkey PRIMARY KEY (id)
);

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
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  image text,
  location_name text,
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

ALTER TABLE public.class_enrollments
  ADD CONSTRAINT class_enrollments_beneficiary_schedule_key
  UNIQUE (beneficiary_id, schedule_id);

-- =====================================================
-- CHECK CONSTRAINTS
-- =====================================================

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_category_check
  CHECK (category IN ('ninos', 'adultos', 'ambos'));

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
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_flow_token ON public.payments(flow_token);
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
    AND EXISTS (SELECT 1 FROM public.academy_enrollments ae WHERE ae.beneficiary_id = class_enrollments.beneficiary_id AND ae.status = 'activa' AND ae.end_date >= current_date)
    AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.beneficiary_id = class_enrollments.beneficiary_id AND m.status = 'activa' AND m.end_date >= current_date)
  )
);
CREATE POLICY "class_enrollments_insert_qr_walkin" ON public.class_enrollments FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.owns_beneficiary(beneficiary_id)
  AND source = 'qr'
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
CREATE POLICY "attendance_insert_own_beneficiary" ON public.attendance FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND public.owns_beneficiary(beneficiary_id)
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
CREATE POLICY "user_insert_enrollment_flow" ON public.academy_enrollments FOR INSERT WITH CHECK (public.owns_beneficiary(beneficiary_id));

-- =====================================================
-- SEED DATA: enrollment plans
-- =====================================================
INSERT INTO public.enrollment_plans (name, price, duration_days, active, sort_order)
VALUES
  ('6 Meses', 15000, 180, true, 1),
  ('1 Año', 25000, 365, true, 2)
ON CONFLICT DO NOTHING;
