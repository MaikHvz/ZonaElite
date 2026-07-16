-- =====================================================================
-- BIO KENPO LA SERENA - ESQUEMA RELACIONAL PARA SUPABASE (PostgreSQL)
-- =====================================================================
-- Notas generales:
-- 1. auth.users es la tabla nativa de Supabase Auth. "profiles" extiende
--    esa tabla 1:1 (id compartido).
-- 2. "beneficiaries" es la tabla puente: representa "a quién pertenece
--    esto" (membresías, ficha médica, consentimiento, métricas,
--    asistencia), ya sea el propio usuario o una carga (dependent).
--    Cada beneficiary apunta a UNO de los dos, nunca a ambos.
-- 3. Se dejan preparadas product_orders / order_items para el futuro
--    checkout online (hoy solo generan el mensaje de WhatsApp).
-- 4. Las políticas RLS incluidas son un punto de partida razonable,
--    no un set exhaustivo para producción: ajústalas según probéis
--    cada flujo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- FUNCIÓN AUXILIAR: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 1. ROLES Y PERFILES
-- =====================================================================

create table public.roles (
  id serial primary key,
  name text unique not null check (name in ('administrador','instructor','recepcion','alumno'))
);

insert into public.roles (name) values
  ('administrador'), ('instructor'), ('recepcion'), ('alumno');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id int not null references public.roles(id) default 4, -- alumno
  full_name text not null,
  email text not null,
  phone text,
  birth_date date,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crear profile automáticamente cuando se registra un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Cargas (dependents)
-- ---------------------------------------------------------------------
create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  rut text,
  birth_date date not null,
  category text not null check (category in ('nino','adulto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_dependents_updated_at
  before update on public.dependents
  for each row execute function public.set_updated_at();

create index idx_dependents_tutor on public.dependents(tutor_id);

-- ---------------------------------------------------------------------
-- Beneficiaries: tabla puente (usuario O carga, nunca ambos)
-- ---------------------------------------------------------------------
create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  dependent_id uuid unique references public.dependents(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chk_beneficiary_exactly_one check (
    (profile_id is not null and dependent_id is null) or
    (profile_id is null and dependent_id is not null)
  )
);

-- Auto-crear beneficiary al crear profile o dependent
create or replace function public.create_beneficiary_for_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.beneficiaries (profile_id) values (new.id);
  return new;
end;
$$;

create trigger trg_profiles_create_beneficiary
  after insert on public.profiles
  for each row execute function public.create_beneficiary_for_profile();

create or replace function public.create_beneficiary_for_dependent()
returns trigger language plpgsql security definer as $$
begin
  insert into public.beneficiaries (dependent_id) values (new.id);
  return new;
end;
$$;

create trigger trg_dependents_create_beneficiary
  after insert on public.dependents
  for each row execute function public.create_beneficiary_for_dependent();

-- =====================================================================
-- 2. MEMBRESÍAS Y PAGOS
-- =====================================================================

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  duration_days int not null,
  category text not null check (category in ('adulto','nino')),
  benefits jsonb default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  purchased_by uuid not null references public.profiles(id),
  start_date date not null,
  end_date date not null,
  status text not null default 'activa' check (status in ('activa','vencida','cancelada')),
  created_at timestamptz not null default now()
);

create index idx_memberships_beneficiary on public.memberships(beneficiary_id);
create index idx_memberships_status on public.memberships(status);

create table public.product_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  status text not null default 'borrador' check (status in ('borrador','enviado','confirmado','cancelado')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  membership_id uuid references public.memberships(id),
  order_id uuid references public.product_orders(id),
  concept text not null,
  amount numeric(10,2) not null,
  method text not null check (method in ('efectivo','transferencia','flow','otro')),
  status text not null default 'pendiente' check (status in ('pendiente','pagado','rechazado','expirado')),
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_payments_user on public.payments(user_id);
create index idx_payments_status on public.payments(status);

-- =====================================================================
-- 3. PRODUCTOS Y CARRITO (catálogo, sin compra online aún)
-- =====================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price numeric(10,2) not null,
  stock int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position int not null default 0
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null
);

-- =====================================================================
-- 4. FICHA MÉDICA, CONSENTIMIENTO Y MÉTRICAS CORPORALES
-- =====================================================================

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null unique references public.beneficiaries(id) on delete cascade,
  enfermedades text,
  lesiones text,
  medicamentos text,
  alergias text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  updated_at timestamptz not null default now()
);

create trigger trg_medical_records_updated_at
  before update on public.medical_records
  for each row execute function public.set_updated_at();

create table public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  pdf_url text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  recorded_at date not null default current_date,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  bmi numeric(5,2),
  muscle_mass_pct numeric(5,2),
  body_fat_pct numeric(5,2),
  created_at timestamptz not null default now()
);

create index idx_body_metrics_beneficiary on public.body_metrics(beneficiary_id, recorded_at);

-- =====================================================================
-- 5. HORARIOS Y ASISTENCIA
-- =====================================================================

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_hex text not null default '#000000'
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines(id),
  professor_id uuid not null references public.profiles(id),
  room text,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=domingo
  start_time time not null,
  end_time time not null,
  capacity int not null default 20,
  created_at timestamptz not null default now()
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  session_date date not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, session_date)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  status text not null default 'presente' check (status in ('presente','ausente','justificado')),
  marked_by uuid references public.profiles(id),
  marked_at timestamptz not null default now(),
  unique (session_id, beneficiary_id)
);

create index idx_attendance_beneficiary on public.attendance(beneficiary_id);

-- =====================================================================
-- 6. BLOG Y EVENTOS
-- =====================================================================

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null,
  cover_image text,
  gallery jsonb default '[]'::jsonb,
  author_id uuid not null references public.profiles(id),
  status text not null default 'borrador' check (status in ('borrador','programado','publicado')),
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('torneo','graduacion','seminario','clase_especial')),
  title text not null,
  description text,
  image text,
  location_name text,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  event_date date not null,
  extra jsonb default '{}'::jsonb, -- cinturones_convocados, recomendaciones, horario, etc.
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 7. NOTIFICACIONES, AUDITORÍA Y CONFIGURACIÓN
-- =====================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('correo_masivo','aviso','recordatorio','comunicado')),
  subject text not null,
  content text not null,
  target text not null default 'todos' check (target in ('todos','segmento')),
  sent_by uuid not null references public.profiles(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_entity on public.audit_logs(entity, entity_id);

create table public.academy_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Bio Kenpo La Serena',
  logo_url text,
  address text,
  whatsapp text,
  social_links jsonb default '{}'::jsonb,
  integrations jsonb default '{}'::jsonb, -- flow, correo, google maps keys, etc.
  updated_at timestamptz not null default now()
);

create trigger trg_academy_settings_updated_at
  before update on public.academy_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 8. FUNCIONES AUXILIARES DE AUTORIZACIÓN
-- =====================================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name = 'administrador'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name in ('administrador','instructor','recepcion')
  );
$$;

-- ¿El usuario autenticado es dueño de este beneficiary (él mismo o su carga)?
create or replace function public.owns_beneficiary(b_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.beneficiaries b
    left join public.dependents d on d.id = b.dependent_id
    where b.id = b_id
      and (b.profile_id = auth.uid() or d.tutor_id = auth.uid())
  );
$$;

-- =====================================================================
-- 9. ROW LEVEL SECURITY (política base — ajustar según necesidad)
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.dependents enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.medical_records enable row level security;
alter table public.consent_forms enable row level security;
alter table public.body_metrics enable row level security;
alter table public.disciplines enable row level security;
alter table public.schedules enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.blog_posts enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.academy_settings enable row level security;

-- Profiles: cada quien ve/edita lo suyo; admin ve todo
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- Dependents: el tutor administra las suyas, admin todas
create policy "dependents_owner_or_admin" on public.dependents
  for all using (tutor_id = auth.uid() or public.is_admin());

-- Beneficiaries: visible para su dueño o admin
create policy "beneficiaries_owner_or_admin" on public.beneficiaries
  for select using (public.owns_beneficiary(id) or public.is_admin());

-- Membership plans: lectura pública, escritura solo admin
create policy "membership_plans_public_read" on public.membership_plans
  for select using (true);
create policy "membership_plans_admin_write" on public.membership_plans
  for insert with check (public.is_admin());
create policy "membership_plans_admin_update" on public.membership_plans
  for update using (public.is_admin());
create policy "membership_plans_admin_delete" on public.membership_plans
  for delete using (public.is_admin());

-- Memberships: dueño del beneficiary o quien compró, o admin
create policy "memberships_owner_or_admin" on public.memberships
  for select using (public.owns_beneficiary(beneficiary_id) or purchased_by = auth.uid() or public.is_admin());
create policy "memberships_admin_write" on public.memberships
  for all using (public.is_admin());

-- Payments: el propio usuario o admin/recepción
create policy "payments_owner_or_staff" on public.payments
  for select using (user_id = auth.uid() or public.is_staff());
create policy "payments_staff_write" on public.payments
  for all using (public.is_staff());

-- Productos e imágenes: catálogo público, escritura admin
create policy "products_public_read" on public.products for select using (true);
create policy "products_admin_write" on public.products for all using (public.is_admin());
create policy "product_images_public_read" on public.product_images for select using (true);
create policy "product_images_admin_write" on public.product_images for all using (public.is_admin());

-- Carrito / pedidos: solo el propio usuario
create policy "product_orders_owner" on public.product_orders
  for all using (user_id = auth.uid() or public.is_staff());
create policy "order_items_owner" on public.order_items
  for all using (
    exists (select 1 from public.product_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff()))
  );

-- Ficha médica, consentimiento y métricas: solo el dueño del beneficiary o staff
create policy "medical_records_owner_or_staff" on public.medical_records
  for all using (public.owns_beneficiary(beneficiary_id) or public.is_staff());
create policy "consent_forms_owner_or_staff" on public.consent_forms
  for all using (public.owns_beneficiary(beneficiary_id) or public.is_staff());
create policy "body_metrics_owner_or_staff" on public.body_metrics
  for all using (public.owns_beneficiary(beneficiary_id) or public.is_staff());

-- Horarios, sesiones: lectura pública, escritura staff
create policy "disciplines_public_read" on public.disciplines for select using (true);
create policy "disciplines_admin_write" on public.disciplines for all using (public.is_admin());
create policy "schedules_public_read" on public.schedules for select using (true);
create policy "schedules_admin_write" on public.schedules for all using (public.is_admin());
create policy "class_sessions_public_read" on public.class_sessions for select using (true);
create policy "class_sessions_staff_write" on public.class_sessions for all using (public.is_staff());

-- Asistencia: el dueño del beneficiary la ve, staff la marca
create policy "attendance_owner_read" on public.attendance
  for select using (public.owns_beneficiary(beneficiary_id) or public.is_staff());
create policy "attendance_staff_write" on public.attendance
  for all using (public.is_staff());

-- Blog y eventos: lectura pública, escritura admin
create policy "blog_posts_public_read" on public.blog_posts
  for select using (status = 'publicado' or public.is_admin());
create policy "blog_posts_admin_write" on public.blog_posts for all using (public.is_admin());
create policy "events_public_read" on public.events for select using (true);
create policy "events_admin_write" on public.events for all using (public.is_admin());

-- Notificaciones y auditoría: solo admin
create policy "notifications_admin_only" on public.notifications for all using (public.is_admin());
create policy "audit_logs_admin_only" on public.audit_logs for select using (public.is_admin());

-- Configuración: lectura pública (para landing), escritura admin
create policy "academy_settings_public_read" on public.academy_settings for select using (true);
create policy "academy_settings_admin_write" on public.academy_settings for all using (public.is_admin());

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================