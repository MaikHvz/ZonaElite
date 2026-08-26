# ZONAELITE — Brain (Contexto IA)

> **Lee este archivo primero.** Contiene todo lo necesario para entender el proyecto sin revisar código fuente.

> **⚠️ Auditoría activa de bugs:** `contexto/informe-bugs.md` (estado de 15 bugs) y plan en `contexto/requisitos/plan-fixes-produccion.md` (10 fases). Actualizar ambos al corregir cada bug.

---

## 1. Qué es

Academia de artes marciales (Kenpo, Kickboxing, Funcional, MMA) en La Serena, Chile. Sistema web completo: landing, tienda, pagos online, panel admin, dashboard de usuario.

### Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.10 (App Router, `src/app/`) |
| UI | React 19.2.4, TypeScript ^5 |
| Estilos | Tailwind CSS v4 (`@theme inline` en globals.css, **NO** existe `tailwind.config.js`) |
| BD + Auth + Storage | Supabase (`@supabase/supabase-js` 2.110.5, `@supabase/ssr` 0.12.3) |
| Pagos | Flow.cl (sandbox) — API REST + HMAC-SHA256 |
| Gráficos | Recharts |
| PDFs | @react-pdf/renderer |
| SEO | sitemap.ts, robots.ts, metadataBase, JSON-LD, generateMetadata |

### Diseño

- **Tema**: Material Design 3 dark (`#131313` background, `#ffb4ac` primary, `#ff544c` primary container)
- **Fuentes**: Anton (headlines), Hanken Grotesk (body), JetBrains Mono (labels) — vía `next/font/google`
- **Iconos**: Material Symbols Outlined (CDN)
- **CSS classes**: `.glass-panel`, `.glass-card`, `.btn-primary-gradient`, `.hero-gradient`, `.text-glow-red`, `.fade-up`
- **Idioma**: Español (`lang="es"`)

### Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL          # URL de Supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # Anon key
SUPABASE_SERVICE_ROLE_KEY         # Service role (solo server)
FLOW_API_URL                      # https://sandbox.flow.cl/api
FLOW_API_KEY                      # API key Flow
FLOW_SECRET_KEY                   # Secret key Flow (HMAC)
NEXT_PUBLIC_BASE_URL              # https://zona-elite-six.vercel.app
SMTP_HOST                         # smtp.gmail.com
SMTP_PORT                         # 587
SMTP_USER                         # Tu correo Gmail
SMTP_PASS                         # App Password de Gmail (16 caracteres)
SMTP_FROM                         # "ZonaElite <tucorreo@gmail.com>"
```

---

## 2. Roles

| role_id | Rol | Acceso |
|---------|-----|--------|
| 1 | Administrador | Total. `/admin/*` protegido por `AdminGuard` |
| 2 | Instructor | Staff (`isStaff=true`). Vista limitada |
| 3 | Recepción | Staff. Vista limitada |
| 4 | Alumno | Default en signup (trigger `handle_new_user()`). Solo `/dashboard` + públicas |

**Signup**: Auth crea user → trigger `handle_new_user()` → crea `profiles` (role_id=4) + `beneficiaries` (profile_id=user.id, dependent_id=NULL).

---

## 3. Arquitectura

### Clientes Supabase

| Cliente | Archivo | Quién lo usa | RLS |
|---------|---------|-------------|-----|
| Admin | `src/lib/supabase/admin.ts` → `getAdminClient()` | API routes, `after()`, server-only | **Bypass** (service_role) |
| Browser | `src/lib/supabase/client.ts` → `createClient()` | Componentes `"use client"` | **Enforced** |
| Server | `src/lib/supabase/server.ts` → `createClient()` | Server Components, route handlers | **Enforced** (cookies) |

### Patrones clave

- **App Router** con `src/app/`, layouts anidados, route handlers en `src/app/api/`
- **Server Components** por defecto; `"use client"` solo para interactividad
- **`safeQuery()`** wrapper para error handling en queries
- **`after()`** de `next/server` para procesamiento background (Flow callbacks)
- **`onConflict`** para upserts e idempotencia
- **`maybeSingle()`** vs `single()` — usar `maybeSingle()` cuando el row puede no existir

### Estructura de archivos

```
src/
├── app/
│   ├── admin/                    # Panel admin (protegido)
│   │   ├── page.tsx              # Dashboard con métricas
│   │   ├── asistencia/page.tsx   # Asistencia por sesión
│   │   ├── blog/page.tsx         # CRUD blog
│   │   ├── changelog/page.tsx    # Changelog de desarrolladores (solo lectura)
│   │   ├── configuracion/page.tsx # Settings + galería
│   │   ├── eventos/page.tsx      # CRUD eventos
│   │   ├── horarios/page.tsx     # CRUD horarios
│   │   ├── membresias/page.tsx   # CRUD planes + asignación
│   │   ├── notificaciones/page.tsx # CRUD notificaciones
│   │   ├── productos/page.tsx    # CRUD productos
│   │   ├── tipos-clase/page.tsx  # CRUD disciplinas
│   │   └── usuarios/page.tsx     # Usuarios + cargas
│   ├── api/
│   │   ├── admin/generate-sessions/route.ts  # POST: genera sesiones 4 semanas
│   │   └── flow/
│   │       ├── create-order/route.ts   # POST: crea orden Flow
│   │       ├── confirmation/route.ts   # POST/GET: callback Flow (after())
│   │       ├── verify/route.ts         # GET: verifica pago (client-side)
│   │       ├── force-confirm/route.ts  # POST: admin recovery
│   │       └── debug/route.ts          # GET: diagnóstico
│   ├── auth/                     # Login, registro, confirm email, reset password
│   ├── blog/[slug]/page.tsx      # Post individual
│   ├── dashboard/                # Usuario
│   │   ├── page.tsx              # Resumen
│   │   ├── membresias/page.tsx
│   │   ├── pagos/page.tsx        # Historial + verificación Flow
│   │   ├── cargas/[id]/medico/page.tsx  # Ficha médica
│   │   ├── notificaciones/page.tsx
│   │   └── asistencia/page.tsx   # Historial asistencia
│   ├── eventos/[id]/page.tsx     # Detalle con Google Maps
│   ├── horarios/page.tsx         # Grid semanal + inscripción
│   ├── quienes-somos/page.tsx     # Historia interactiva (Kenpo/Kickboxing/MMA) + GalleryCarousel
│   ├── productos/[id]/page.tsx   # Detalle producto
│   ├── perfil/page.tsx           # Editar perfil
│   ├── layout.tsx                # Root: Navbar, FadeUpObserver, ContactModal, SessionProvider
│   ├── page.tsx                  # Landing
│   ├── globals.css               # Tema MD3
│   ├── sitemap.ts / robots.ts    # SEO
│   └── torneos/, ceremonias/     # Redirects a /eventos
├── components/
│   ├── admin/                    # AdminGuard, AdminSidebar, DataTable, FormModal, DeleteConfirm,
│   │                             # StatusBadge, ImageUpload, AssignMembershipModal, MembershipReceipt
│   ├── dashboard/                # DashboardNav, MembershipCard, QuickStats, AlertBanner, etc.
│   └── *.tsx                     # Landing, EnrollModal, PersonalizedEnrollModal, CheckoutModal, GalleryCarousel, etc.
├── lib/
│   ├── flow.ts                   # signFlowParams, createFlowOrder, verifyFlowPayment
│   ├── flow-helpers.ts           # confirmAndCreateMembership, markPaymentAsPaid, findPaymentByToken
│   └── supabase/
│       ├── admin.ts              # getAdminClient() singleton
│       ├── client.ts             # createBrowserClient
│       ├── server.ts             # createServerClient (cookies)
│       ├── dashboard.ts          # Todas las queries del dashboard (getUserMemberships, etc.)
│       ├── storage.ts            # uploadImage, deleteImage, getImagePath
│       └── profile.ts / auth.ts / middleware.ts
└── providers/
    └── SessionProvider.tsx       # Context: session, user, profile, isAdmin, isStaff, refreshProfile()
```

---

## 4. Rutas completas

### Públicas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `page.tsx` | Landing: Hero → IntroSection → Disciplines → Memberships → CTA → Footer |
| `/horarios` | `horarios/page.tsx` | Grid semanal DB-driven, coloreado por disciplina, filtros, capacidad, "Agendar" |
| `/quienes-somos` | `quienes-somos/page.tsx` | Historia interactiva: American Kenpo (raíz) + Kickboxing + MMA (selector, capítulos, progreso). `HistoryExplorer.tsx` + `stories.ts`. GalleryCarousel, FAQ, Schema LocalBusiness. `/nosotros` → redirect 301 |
| `/productos` | `productos/page.tsx` | Catálogo grid con filtros |
| `/productos/[id]` | `productos/[id]/page.tsx` | Detalle: galería thumbnails (hasta 3), precio, stock |
| `/eventos` | `eventos/page.tsx` | Unificado (torneos/ceremonias), tabs filtro |
| `/eventos/[id]` | `eventos/[id]/page.tsx` | Hero, info cards, Google Maps embebido |
| `/blog` | `blog/page.tsx` | Feed estilo redes sociales |
| `/blog/[slug]` | `blog/[slug]/page.tsx` | Post individual, generateMetadata, ShareButton |

### Auth

| Ruta | Archivo |
|------|---------|
| `/auth` | Login/Register tabs |
| `/auth/confirm` | Confirmación email |
| `/auth/update-password` | Reset contraseña |

### Protegidas (requieren sesión)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/dashboard` | Resumen: membresías activas, pagos recientes, cargas, pagado este mes |
| `/dashboard/membresias` | Membresías con filtros |
| `/dashboard/pagos` | Historial paginado + verificación Flow (`?token=XXX`) |
| `/dashboard/cargas` | Dependientes + botón agregar carga |
| `/dashboard/cargas/[id]/medico` | Ficha médica: MedicalInfoCard + EmergencyContactCard |
| `/dashboard/notificaciones` | Historial, filtros por tipo |
| `/dashboard/asistencia` | Histórico agrupado por fecha, iconos estado, contadores |
| `/perfil` | Editar nombre, teléfono, nacimiento + cambio contraseña |

### Admin (requieren role_id=1)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/admin` | Dashboard: stats, RevenueChart, NewStudentsChart, MembershipBreakdown, MonthlyComparison, PaymentOverview |
| `/admin/productos` | CRUD con DataTable, ImageUpload (3 imgs), product_images |
| `/admin/eventos` | CRUD con type filter, location_url para Google Maps |
| `/admin/horarios` | CRUD: category, active, room, discipline+professor selects, class_plans |
| `/admin/tipos-clase` | CRUD disciplinas: name, color_hex, icon, description, active |
| `/admin/usuarios` | Usuarios + cargas agrupadas, cambio roles, activar/desactivar |
| `/admin/membresias` | CRUD planes + asignación manual + editar/cancelar + PDF recibo |
| `/admin/inscripciones` | **NUEVO** CRUD planes inscripción + inscripciones asignadas + asignación manual |
| `/admin/asistencia` | Acordeón por sesión, "Generar sesiones", "Todos presentes", "Inscribir usuario" |
| `/admin/blog` | CRUD: borrador/programado/publicado |
| `/admin/notificaciones` | CRUD: aviso/recordatorio/comunicado/correo_masivo |
| `/admin/changelog` | **NUEVO** Changelog de desarrolladores: cambios versionados, solo lectura admin |
| `/admin/configuracion` | Settings academia + CRUD galería (add/remove/reorder/visibility) |

### API Routes

| Ruta | Método | Archivo | Descripción |
|------|--------|---------|-------------|
| `/api/flow/create-order` | POST | `api/flow/create-order/route.ts` | Crea pago pendiente + orden Flow. Acepta `includeEnrollment` + `enrollmentPlanId` |
| `/api/flow/confirmation` | POST/GET | `api/flow/confirmation/route.ts` | Callback Flow. `after()`: verificar → marcar pagado → crear membresía + extender inscripción |
| `/api/flow/verify` | GET | `api/flow/verify/route.ts` | Client-side verification. Retorna estado para banner |
| `/api/flow/force-confirm` | POST | `api/flow/force-confirm/route.ts` | Admin manual recovery |
| `/api/flow/debug` | GET | `api/flow/debug/route.ts` | Diagnóstico pagos |
| `/api/admin/generate-sessions` | POST | `api/admin/generate-sessions/route.ts` | Genera class_sessions próximas 4 semanas. Idempotente |

### Redirects

- `/torneos` → `/eventos`
- `/ceremonias` → `/eventos`

---

## 5. Módulos — Flujos detallados

### 5.1 Landing Page

Navbar global (root layout) con links, campana notificaciones (logueados), Mi Panel (logueados), CTA. ContactModal vía ContactModalContext. FadeUpObserver para animaciones `.fade-up`.

Secciones: Hero → IntroSection → Disciplines (bento grid 4 cards) → Memberships (desde BD) → CTA → Footer.

### 5.2 Auth

Supabase Auth. Tabs Login/Register en `/auth`. Confirm email en `/auth/confirm`. Reset password en `/auth/update-password`. Al registrar: trigger `handle_new_user()` crea `profiles` + `beneficiaries`.

### 5.3 Horarios públicos

Grid semanal desde BD. Cada celda muestra disciplina (color), profesor, capacidad. Botón "Agendar" → `EnrollModal`. Modal muestra usuario + dependientes. Validación en tiempo real: categoría (nino/adulto), membresía activa, compatibilidad de plan (`class_plans`), no duplicado. Inscripción en `class_enrollments` via `schedule_id`.

### 5.4 Pagos Flow (flujo completo)

```
1. Usuario selecciona plan → CheckoutModal (selecciona beneficiario)
2. POST /api/flow/create-order → payments row (status='pendiente') + Flow API order
3. Redirect a Flow sandbox para pago
4. Flow retorna → /dashboard/pagos?token=XXX (return URL)
5. Flow llama /api/flow/confirmation (callback) → after() background:
   a. Verificar firma HMAC
   b. Verificar pago (status === 2)
   c. Mark payment 'pagado' + paid_at
   d. Extraer plan name de concept ("Membresía X" → "X")
   e. Find plan in membership_plans (ilike)
   f. Find/create beneficiary
   g. Dedup check (10 min window)
   h. Create membership (start=today, end=today+duration_days)
   i. Link payment → membership
   j. Si metadata.includeEnrollment → extendEnrollment() (extiende o crea)
6. /dashboard/pagos llama /api/flow/verify → muestra banner éxito/error
```

**Cross-tab recovery**: SessionProvider almacena `flow_pending_token` en sessionStorage. Al SIGNED_IN, redirige a `/dashboard/pagos?token=XXX`.

**Archivos Flow**:
- `src/lib/flow.ts`: `signFlowParams()`, `createFlowOrder()`, `verifyFlowPayment()`, `verifyFlowCallbackSignature()`
- `src/lib/flow-helpers.ts`: `confirmAndCreateMembership()`, `extendEnrollment()`, `markPaymentAsPaid()`, `findPaymentByToken()`, `extractPlanName()`

### 5.5 Sistema de Inscripciones (Matrícula)

**Concepto**: Pago con vencimiento configurable que es prerequisito para comprar membresías e inscribirse en clases.

**Reglas**:
- Cada beneficiario necesita su propia inscripción vigente
- Se puede comprar sola o bundled con membresía
- Vencimiento solo bloquea nuevas compras (membresía activa sigue vigente)
- 1 inscripción activa por beneficiario. Comprar otra **extiende** desde vencimiento actual
- Admin puede asignar manualmente
- Planes variables: 6 meses, 1 año, etc.

**Archivos clave**:
- `project-context/sql-academy-enrollments.sql`: Migración SQL
- `src/app/admin/inscripciones/page.tsx`: CRUD admin (planes + inscripciones)
- `src/components/CheckoutModal.tsx`: Dropdown planes, resumen bundled
- `src/app/api/flow/create-order/route.ts`: Acepta `includeEnrollment` + `enrollmentPlanId`
- `src/lib/flow-helpers.ts`: `extendEnrollment()` — crea o extiende inscripción
- `src/app/api/flow/confirmation/route.ts`: Llama `extendEnrollment` en after()
- `src/components/EnrollModal.tsx`: Gate de inscripción antes de membresía
- `src/app/dashboard/page.tsx`: Badge estado inscripción
- `src/app/dashboard/membresias/page.tsx`: Estado inscripción + botón comprar

**Flujo de extensión**:
```
Inscripción actual vence: 2026-10-25 (faltan 2 meses)
Compra plan "1 Año" (365 días)
Nuevo vencimiento: 2027-10-25 (14 meses total)
```

### 5.6 Asistencia

**Admin** (`/admin/asistencia`):
1. "Generar sesiones" → `POST /api/admin/generate-sessions` → crea `class_sessions` próximas 4 semanas (idempotente)
2. Acordeón por sesión (fecha, disciplina, horario)
3. Expandir → carga beneficiarios **inscritos** (via `class_enrollments`)
4. "Todos presentes" → marca todos de una vez
5. Botones individuales: presente/ausente/justificado
6. "Inscribir usuario" → modal búsqueda por nombre → inscribe en horario

**Usuario** (`/dashboard/asistencia`): Histórico agrupado por fecha, disciplina, horario, beneficiario, iconos estado.

### 5.6 Galería

**Admin** en `/admin/configuracion`: Add/remove/reorder/toggle visibility. Images a `gallery/` folder en Storage.
**Público** en `/quienes-somos`: `GalleryCarousel` — auto-play 5s, arrows, dots, fade transitions. Inserta con `active: true`.

### 5.7 Ficha Médica

`/dashboard/cargas/[id]/medico`. `MedicalInfoCard` (enfermedades, lesiones, medicamentos, alergias) + `EmergencyContactCard` (nombre, teléfono). Upsert en `medical_records` por `beneficiary_id`.

### 5.8 Membresías Admin

- CRUD planes en `membership_plans`
- Asignación manual: buscar usuario → seleccionar beneficiario → plan → fecha inicio → método pago → monto → comprobante → crear membresía (activa) + pago (transferencia, pagado)
- Editar `end_date`, cancelar membresías
- PDF recibo con `@react-pdf/renderer`

---

## 6. Base de datos

### 32 Tablas

| Tabla | Descripción | FKs principales |
|-------|-------------|----------------|
| `changelog` | **NUEVO** Changelog de desarrolladores para el panel admin (versión + título + resumen) | — |
| `roles` | 1=admin, 2=instructor, 3=recepcion, 4=alumno | — |
| `profiles` | Perfiles (id=auth.users.id) | FK → auth.users |
| `academy_settings` | Config academia (singleton, incl. `payment_settings` jsonb con modo de pago por tipo + datos bancarios) | — |
| `disciplines` | Kenpo, Kickboxing, Funcional, MMA | — |
| `schedules` | Horarios semanales (`mode`: normal/personalizado) | FK → disciplines, profiles (professor) |
| `class_sessions` | Sesiones generadas desde schedules | FK → schedules |
| `class_plans` | Restricción de plan por horario | FK → schedules, membership_plans |
| `class_enrollments` | Inscripciones en horarios | FK → schedules, beneficiaries |
| `personalized_schedule_plans` | **NUEVO** Planes permitidos por horario personalizado (vacío = todos) | FK → schedules, personalized_plans (CASCADE) |
| `personalized_enrollments` | **NUEVO** Inscripciones a horarios personalizados (consumen pack) | FK → class_sessions, beneficiaries, personalized_packs |
| `dependents` | Cargas familiares | FK → profiles (tutor) |
| `beneficiaries` | Vínculo perfil/dependiente al sistema | FK → profiles OR dependents |
| `attendance` | Asistencia por sesión | FK → class_sessions, beneficiaries |
| `membership_plans` | Planes de membresía (nombre, precio, duración) | — |
| `memberships` | Membresías activas | FK → beneficiaries, membership_plans, profiles |
| `enrollment_plans` | **NUEVO** Planes de inscripción (nombre, precio, duración) | — |
| `academy_enrollments` | **NUEVO** Inscripciones a la academia | FK → beneficiaries, enrollment_plans, payments |
| `products` | Tienda | — |
| `product_images` | Imágenes (max 3) | FK → products |
| `product_orders` | Órdenes | FK → profiles |
| `order_items` | Items de órdenes | FK → product_orders, products |
| `payments` | Pagos (Flow, transferencia, efectivo; solicitudes manuales = `method='transferencia'` + `status='pendiente'`, con `membership_plan_id`/`personalized_plan_id`/`reviewed_by`/`reviewed_at`/`admin_note`) | FK → profiles, memberships |
| `events` | Torneos, ceremonias, seminarios | — |
| `blog_posts` | Publicaciones blog | — |
| `notifications` | Notificaciones | — |
| `audit_logs` | Logs auditoría | — |
| `gallery_images` | Galería (admin gestiona, muestra en /quienes-somos) | — |
| `consent_forms` | Formularios consentimiento | — |
| `body_metrics` | Métricas corporales | FK → beneficiaries |
| `medical_records` | Registros médicos | FK → beneficiaries |
| `belt_grades` | **NUEVO** Grados/cinturones por disciplina (name + color hex) | FK → disciplines |
| `sport_profiles` | **NUEVO** Perfil deportivo 1:1 por beneficiario (disciplina + grado) | FK → beneficiaries, disciplines, belt_grades |
| `sports_podiums` | **NUEVO** Historial de podios/torneos del alumno | FK → beneficiaries, disciplines |

### Modelo de usuarios y beneficiarios

```
auth.users ──→ profiles (role_id)
                  │
                  ├── beneficiaries (profile_id=user.id, dependent_id=NULL)  ← usuario es su propio beneficiario
                  │
                  └── dependents (tutor_id=user.id)
                        │
                        └── beneficiaries (dependent_id=dep.id, profile_id=NULL)  ← carga es beneficiario

memberships.beneficiary_id ──→ beneficiaries.id
attendance.beneficiary_id ──→ beneficiaries.id
class_enrollments.beneficiary_id ──→ beneficiaries.id
```

### Enum values (texto, no nativos)

- `dependents.category`: `'nino'` | `'juvenil'` | `'adulto'`
- `membership_plans.category`: `'adulto'` | `'nino'` | `'juvenil'`
- `schedules.category`: `text[]` — array con valores de `'ninos'` | `'juveniles'` | `'adultos'`
- `attendance.status`: `'presente'` | `'ausente'` | `'justificado'`
- `payments.status`: `'pendiente'` | `'pagado'` | `'fallido'` | `'reembolsado'`
- `memberships.status`: `'activa'` | `'vencida'` | `'cancelada'` | `'suspendida'`
- `blog_posts.status`: `'borrador'` | `'publicado'` | `'programado'`
- `events.type`: `'clase'` | `'torneo'` | `'seminario'` | `'otro'`

### Funciones RPC

```sql
is_admin()             -- role_id = 1
is_staff()             -- role_id IN (1,2,3)
owns_beneficiary(b_id) -- usuario es dueño del beneficiario
handle_new_user()      -- trigger: crea profiles + beneficiaries en signup
update_updated_at()    -- trigger: updated_at = now() en update
chile_today()          -- fecha Chile DST-safe (timezone America/Santiago)
enroll_class()         -- B-006: inscripción transaccional (lock sesión, membresía, aforo)
get_remaining_tokens() -- B-010: tokens dinámicos (cuenta class_enrollments por membresía)
get_enrollment_debt()  -- B-011: inscripciones que exceden los tokens
notify_token_return()  -- notificación in-app "Token devuelto" (justificación)
enroll_personalized_class() -- personalizadas: consume pack atómicamente
cancel_class_enrollment()   -- migración 011: admin desinscribe + devuelve token/clase
sport_profile_validate_grade() -- trigger (migración 024): valida belt_grades.discipline_id = discipline_id
```

### 60 RLS Policies

Todas las tablas tienen RLS habilitado. Patrón típico:
- Admin: `is_admin()` → acceso total
- Staff: `is_staff()` → lectura
- Usuario: `auth.uid() = user_id` o `owns_beneficiary()` → solo sus datos
- Service role (admin client): bypass total

### Storage

- Bucket: `"public"` (lectura pública)
- Carpetas: `products/`, `events/`, `gallery/`, `memberships/`, `receipts/`, `vouchers/`, `podiums/`
- Helper: `src/lib/supabase/storage.ts` → `uploadImage(file, folder)`, `deleteImage(url)`, `getImagePath(url)`
- Validación: max 5MB, formatos JPG/PNG/WebP/GIF

---

## 7. Queries complejas (resumen)

### getUserMemberships(userId)
1. Busca `beneficiaries` donde `profile_id=userId` (propio)
2. Busca `dependents` donde `tutor_id=userId` con nested `beneficiaries` (cargas)
3. Recopila todos los `beneficiaryIds`
4. Query `memberships` con joins a `membership_plans`, `beneficiaries`, `dependents`

### getAttendanceForSession(sessionId)
1. Query `attendance` para la sesión
2. Si el schedule es `mode='personalizado'` → lista desde `personalized_enrollments` (sin filtro de membresía)
3. Si es normal → `class_enrollments` donde `session_id=sessionId` OR `schedule_id=session.schedule_id`
4. Query `memberships` activas para enrolled beneficiary_ids (solo modo normal)
5. Construye lista de beneficiarios con estado de asistencia

### Inscripción a horario personalizado (RPC `enroll_personalized_class`)
1. Lock de la sesión `FOR UPDATE` (aforo, patrón B-006)
2. Por beneficiario: idempotente (ya inscrito → success), autorización (admin u `owns_beneficiary`), restricción de plan permitido (`personalized_schedule_plans`; vacío = todos), consumo atómico del pack (`used_classes < total_classes AND status='activa' AND end_date >= hoy`; `NO_PACK` si no hay; `agotada` al llenarse)
3. Insert en `personalized_enrollments` (UNIQUE session+beneficiary). **No toca `class_enrollments`**

### Schedule grid building
1. Query `schedules` activas con joins a `disciplines`, `profiles`, `class_plans`
2. Para cada schedule, count `class_enrollments`
3. Si logueado, verificar si beneficiarios están inscritos
4. Construir grid: time → day → cell

### confirmAndCreateMembership (Flow)
1. Buscar pago por ID
2. Si ya tiene membership_id → retornar
3. Extraer nombre del plan del concepto
4. Buscar plan en `membership_plans` (ilike)
5. Buscar beneficiary (del pago o por user)
6. Dedup check (10 min window) - evita duplicados por doble click
7. Cancelar CUALQUIER membresía "activa" existente para el usuario (sin importar la fecha de fin, ya que la nueva sobrescribe)
8. Crear membership con fechas calculadas usando `addDaysChile`
9. Link payment → membership

---

## 8. Reglas para IA

1. **Siempre leer este archivo (`contexto/BRAIN.md`) primero** antes de cualquier tarea.
2. **Los documentos `01-project-context-flow.md` y `02-database-interaction.md`** tienen detalles adicionales si se necesita profundizar.
3. **`schema-complete.sql`** tiene el SQL completo verificado de las 26 tablas.
4. **Nunca confiar solo en `returnUrl`** de Flow — siempre verificar via API.
5. **`getAdminClient()` es server-only** — nunca importar en componentes client.
6. **Tailwind v4**: NO existe `tailwind.config.js`. Todo vía `@theme inline` en globals.css.
7. **Next.js 16**: Usa `proxy.ts` en vez de `middleware.ts`.
8. **RLS**: El browser client respeta RLS. El admin client bypassa. No mezclar.
9. **Hardcoded data**: Las historias en `/quienes-somos` son contenido estático en `src/components/history/stories.ts` (no de BD).
10. **GalleryCarousel**: Siempre insertar con `active: true` explícito (PostgREST puede no aplicar defaults).
11. **`after()`** de `next/server` para procesamiento background — no fire-and-forget.
12. **Supabase PostgREST** no soporta ordering by nested FK columns.
13. **`membership_plans.category`** = `'adulto'|'nino'|'juvenil'`, **`dependents.category`** = `'nino'|'juvenil'|'adulto'`. Edades: nino <10, juvenil 10-15, adulto >=16.
14. **`beneficiaries`** no tiene columna `category` — el category viene del `dependent` o se asume `'adulto'`.
15. **`schedules.category`** es ahora `text[]` (array PostgreSQL) con valores `'ninos'|'juveniles'|'adultos'`. La elegibilidad se evalúa con `schedule.category.includes(planCategory)`.
15. **Spanish** en todo el contenido visible.
16. **Zonas Horarias**: NUNCA usar `new Date().toISOString().split("T")[0]` para calcular "hoy", ya que usa UTC y genera un desfase después de las 20:00 hora Chile. SIEMPRE importar y usar `getChileToday()` y `addDaysChile()` desde `src/lib/dates.ts`. Para límites de mes/trimestre usar los helpers Chile-aware de `dates.ts` (`chileMonthStartDate()`, `chileMonthEndDate()`, `chileQuarterStartDate()`, `chileQuarterEndDate()`, etc.) y convertir a instantes UTC con `chileDateToUtc()` cuando se comparen columnas TIMESTAMPTZ. El scan estático de `scripts/test-flows.mjs` falla (exit 1) si reaparecen los patrones `toISOString().split("T")[0]` o `new Date(y, m, 1).toISOString()`.
17. **Suite de pruebas**: `scripts/test-flows.mjs` (Node 24+, sin deps) cubre zona horaria Chile, firma HMAC de Flow, contratos de esquema/RLS, ciclo de vida de inscripción y los módulos de clases personalizadas, desinscripción en asistencia, pago manual por transferencia, crear/asignar carga desde admin, edición de cargas con validación de RUT, dirección en perfil y cargas, datos físicos (peso/altura/mano) + modal "Ver Ficha" y el perfil deportivo (disciplina/grado/podios) (secciones P/Q/R/S/T/U/V/W/X/Y/Z/AB, 567 tests). Comando: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs`.
17. **Guía de trabajo obligatoria**: Antes de implementar CUALQUIER nueva funcionalidad, leer y ejecutar el workflow definido en `documentacion/guia-de-trabajo.md`. Las 4 fases son obligatorias: planificación → análisis de impacto → implementación → documentación post-implementación (incluye actualizar `squema-sql-actualizado.sql`).
18. **Modalidad personalizada en horarios**: `schedules.mode` ('normal'|'personalizado') se fija al crear y es inmutable al editar. Las clases personalizadas NO usan QR/check-in (`/api/checkin` devuelve 403); se inscriben vía RPC `enroll_personalized_class` (consume pack) y su asistencia se registra manualmente reusando `attendance`. En admin/público/dashboard filtrar por `mode` y ramificar `EnrollModal`/`PersonalizedEnrollModal`.
19. **Desinscripción en asistencia (migración 011)**: para eliminar un beneficiario de una sesión desde `/admin/asistencia` usar SIEMPRE el RPC `cancel_class_enrollment` (validación admin dentro). En normal borra `class_enrollments` (por `session_id` u horario recurrente con `session_id IS NULL`) y la deuda `pendiente` de la sesión → el token vuelve solo por `get_remaining_tokens`; en personalizada restaura 1 clase al pack. Limpia `attendance` y notifica al titular. No crear policies DELETE nuevas (`class_enrollments_delete_admin` ya existe).
20. **Changelog de desarrolladores (migración 012)**: cada feature nueva debe agregar una entrada de changelog en `changelog` (tabla de solo lectura admin, RLS `changelog_admin_read` con `is_admin()`). Insertar vía SQL seed/actualización (o migración) con `ON CONFLICT (version) DO NOTHING`; versiones correlativas (v1.0.0, v1.1.0, …). La UI (`/admin/changelog`) es solo lectura. No editar entradas desde código cliente.
21. **Pago manual por transferencia (migración 013)**: toggle por tipo de producto en `academy_settings.payment_settings` (jsonb `{memberships, personalized, enrollment}` cada uno `"online"|"manual"` + `bank` con datos bancarios). El envío va por `POST /api/payments/transfer` (admin client, voucher ≤5MB a `public/vouchers`, `payments.method='transferencia'`, `status='pendiente'`, `commerce_order='REF-ZE-xxxxxx'`, `membership_plan_id`/`personalized_plan_id`/`include_enrollment`). La revisión va por `POST /api/payments/review` (solo `role_id=1`; aprobar marca `pagado` con guard de concurrencia `WHERE status='pendiente'` y **persiste `admin_note`** (nota opcional visible aunque el pago esté OK) y asigna con `createMembershipForPayment`/`confirmPersonalizedPack` con override de plan, o `extendEnrollment`; en el caso combinado membresía+inscripción asigna **ambos** beneficios con `if`s independientes (ninguno se pierde) rechazar deja `admin_note` + `rechazado`). `create-order` rechaza 400 si el tipo está en `manual`. La membresía aprobada corre desde la fecha de aprobación (`start_date = getChileToday()`). Detalle completo en `contexto/requisitos/pago-manual-transferencia.md`.
- **Correos del flujo de revisión**: cuando el usuario envía una solicitud, `sendTransferRequestEmail` avisa a **todos** los `profiles` con `role_id=1` (fallback `SMTP_USER`) y su botón "Revisar Solicitud" deep-linkea a `/admin/ventas?tab=solicitudes`. Al revisar, `notifyTransferReviewEmail` (en `review/route.ts`, best-effort, consulta `email`/`full_name` del usuario) envía `sendTransferReviewEmail` al usuario con el resultado — aprobada o rechazada (en ambos casos con la `admin_note`, etiquetada "Nota del administrador" si es aprobación y "Motivo del rechazo" si es rechazo) — y su botón "Ver Mis Solicitudes de Pago" enlaza a `/dashboard/pagos#solicitudes`. La notificación in-app vía `notifyUserPaymentStatus` acepta `adminNote` opcional y la incluye en el content. El voucher se enlaza en el correo al admin (nunca se adjunta).
- **RUT en admin/usuarios**: la columna `profiles.rut` (nullable) se muestra en `/admin/usuarios` para los titulares de cuenta y `dependents.rut` para las cargas (columna "RUT", "—" si vacío) y el buscador de `DataTable` filtra por nombre, email **o RUT** (acepta `searchKey` como `string | string[]`). También se incluye en el export Excel.
- **Crear y asignar carga desde admin**: botón "Crear y Asignar Carga" en `/admin/usuarios` abre `CreateDependentModal` donde se selecciona el **usuario tutor** (profile padre) y se ingresan los datos de la carga (`full_name`, `rut`, `birth_date`, `category`). La creación va por `POST /api/admin/create-dependent` (admin client, valida rol/categoría, inserta en `dependents` y **asegura** el registro en `beneficiaries` con `dependent_id` — idempotente, cubre el caso de que no exista trigger automático) y registra `audit_logs`. Editar una carga (fila existente) va por `POST /api/admin/update-dependent`. El resultado es una carga con el mismo comportamiento que una creada por el propio usuario (visible en checkout/membresías).
- **Editar cargas desde el dashboard + validación de RUT**: el tutor puede editar los datos de sus cargas desde `/dashboard/cargas` (botón "Editar datos" en `DependentCard` → `EditDependentModal`, update por browser client vía RLS `dependents_update_own_or_admin`, sin API). El RUT se valida con `src/lib/rut.ts` (`normalizeRut`/`isValidRut`/`formatRut`, algoritmo módulo 11 con cuerpo 1–8 dígitos en rango 1.000.000–25.000.000 y DV `[0-9K]`); la validación aplica también al agregar carga (`AddDependentModal`) y en el modal admin (`CreateDependentModal`).
- **Dirección en perfil y cargas (migración 018, v1.2.1)**: columnas `address text` en `profiles` y `dependents`. Se edita en `/perfil` y en los modales de carga (Add/Edit desde dashboard y `CreateDependentModal` admin), con checkbox "Usar la misma dirección que el tutor" que autocompleta desde `profiles.address`. Se muestra en `DependentCard`. Las APIs admin `create/update-dependent` la persisten e incluyen en `audit_logs.metadata`.
- **Datos físicos y Ver Ficha (migración 019, v1.3.0)**: columnas `weight numeric`, `height numeric`, `dominant_hand text` en `profiles` y `dependents` + CHECK constraints (peso 0–300, altura 0–250, mano `'diestro'|'zurdo'`). Validación con `src/lib/medidas.ts` (`normalizeMedida`/`parseMedida`/`isValidPeso`/`isValidAltura`/`isValidDominantHand`; solo dígitos + separador decimal, coma→punto). Se editan en `/perfil`, en los modales de carga y en la card `PhysicalInfoCard` de la ficha médica (`/dashboard/cargas/[id]/medico`, guarda por browser client vía `dependents.update` con `.eq("id", ...).eq("tutor_id", ...)`). En `/admin/usuarios` el botón ojo de la tabla (solo cargas, `canView`) abre `VerFichaModal` de solo lectura. Las APIs admin validan en server (400 con mensajes).
- **Feedback admin**: `PendingTransferProvider` (poll de `payments` transferencia+pendiente cada 30s + focus) alimenta un badge con el contador en el link "Ventas" de `AdminSidebar` y un banner grande `PendingTransferBanner` en `admin/layout` con CTA a `/admin/ventas?tab=solicitudes` (la página abre la tab "Solicitudes" vía `URLSearchParams`). Solo visible para admin (layout bajo `AdminGuard`; RLS `payments_select_own_or_admin`).
- **Feedback usuario**: espejo en el dashboard — `UserPendingTransferProvider` cuenta las transferencias pendientes **propias** (`user_id` + `method='transferencia'` + `status='pendiente'`) y alimenta un badge en la tab "Pagos" de `DashboardNav` (desktop y mobile) + banner `UserPendingTransferBanner` en `/dashboard/pagos`. El panel `TransferRequestsPanel` muestra las solicitudes con su estado ("En revisión"/"Aprobada"/"Rechazada"), la referencia `REF-ZE`, el monto, el comprobante y la **nota del admin** (`admin_note`): caja verde "Nota del administrador" en aprobaciones con nota y caja roja "Motivo del rechazo" en rechazos. La fila de pago `PaymentRow` en `/dashboard/pagos` también muestra la nota (roja en rechazados, verde "Nota:" en aprobados). Datos vía `getUserTransferRequests` en `dashboard.ts`.
- **Feedback admin en revisión**: `/admin/ventas` muestra la nota en **aprobadas y rechazadas** (verde/rojo) dentro de `SolicitudesSection`, y tras revisar muestra un **toast de confirmación** ("Solicitud aprobada y pago registrado…" / "Solicitud rechazada…") usando el componente `Toast`. El label del modal aclara que la nota es "visible para el usuario" (aplica tanto a aprobación como a rechazo).
- **Perfil deportivo de alumnos (migración 024, v1.5.0)**: tablas `belt_grades` (grados por disciplina con color, UNIQUE `(discipline_id, position)`, seed Blanco→Negro por disciplina activa), `sport_profiles` (1 perfil por beneficiario, UNIQUE `beneficiary_id`, trigger `sport_profile_validate_grade()` que impide guardar un cinturón de otra disciplina) y `sports_podiums` (historial, `position CHECK IN ('1','2','3','participacion')`). RLS: **escritura SOLO admin** (`belt_grades_admin_write`, `sport_profiles_admin_write`, `sports_podiums_admin_write`); lectura `owns_beneficiary(beneficiary_id) OR is_admin()`. Se anclan a `beneficiaries.id` (NO columnas nuevas en `profiles`/`dependents`) para que el tutor no se autoconceda grados vía `dependents_update_own_or_admin`. El color del cinturón viene de la BD (`belt_grades.color`), nunca hardcodeado. Helpers en `src/lib/sport-profile.ts` (tipos, `PODIUM_POSITIONS`, `computePodiumStats`, `formatPodiumDate`, `sortPodiumsByDateAsc/Desc`); embeds `sport_profiles`+`sports_podiums` en `DependentData` con `getUserSportProfile`/`getDependentSportProfile`. UI: `TutorSportCard` en `/dashboard/cargas`, `BeltBanner`+`SportProfileInfo` en `DependentCard`, gestión admin vía `SportProfileModal`+`PodiumFormModal` en `/admin/usuarios` (botón `sports_martial_arts` en `DataTable`, resuelve beneficiario por `profile_id` o `dependent_id`). Detalle en `contexto/requisitos/perfil-deportivo-alumnos.md`.

---

## 9. Archivos de referencia

| Archivo | Contenido |
|---------|-----------|
| `contexto/BRAIN.md` | Este archivo — contexto completo para IA |
| `contexto/01-project-context-flow.md` | Detalle de cada funcionalidad y flujo |
| `contexto/02-database-interaction.md` | Interacciones con BD por módulo, queries, RLS |
| `documentacion/guia-de-trabajo.md` | **SOP obligatorio** — leer y seguir antes de toda implementación |
| `documentacion/plan-clases-personalizadas.md` | Plan por fases del módulo de packs personalizados (v1) |
| `documentacion/plan-clases-horario-personalizadas.md` | Plan por fases de clases de horario personalizadas |
| `contexto/requisitos/clases-horario-personalizadas.md` | Requisito + análisis de impacto (horarios personalizados) |
| `contexto/requisitos/eliminar-usuario-asistencia.md` | Requisito + análisis de impacto (desinscripción con devolución de token) |
| `contexto/requisitos/changelog-admin.md` | Requisito + análisis de impacto (changelog de desarrolladores en panel admin) |
| `contexto/requisitos/pago-manual-transferencia.md` | Requisito + análisis de impacto (modo de pago manual por transferencia) |
| `contexto/migrations/010_personalized_schedule_classes.sql` | Migración 010: mode en schedules + tablas/RPC de personalizadas (pendiente aplicar) |
| `contexto/migrations/011_cancel_class_enrollment.sql` | Migración 011: RPC cancel_class_enrollment (pendiente aplicar) |
| `contexto/migrations/012_changelog.sql` | Migración 012: tabla changelog (solo lectura admin, seed v1.0.0) (pendiente aplicar) |
| `contexto/migrations/013_manual_payment_mode.sql` | Migración 013: modo de pago manual (payment_settings, payments + plan_id/review, profiles.rut) (pendiente aplicar) |
| `contexto/migrations/014_changelog_v1_1_0.sql` | Migración 014: entrada de changelog v1.1.0 (Pago por Transferencia) (pendiente aplicar) |
| `contexto/requisitos/perfil-deportivo-alumnos.md` | Requisito + análisis de impacto (perfil deportivo: disciplina, grado/cinturón, podios) |
| `contexto/migrations/024_sport_profiles.sql` | Migración 024: belt_grades + sport_profiles + sports_podiums + trigger + seeds + policies RLS (pendiente aplicar) |
| `contexto/migrations/025_changelog_v1_5_0.sql` | Migración 025: entrada de changelog v1.5.0 (Perfil Deportivo de Alumnos) (pendiente aplicar) |
| `contexto/schema-complete.sql` | SQL completo: 26 tablas, 190 cols, 32 FKs, 59 RLS, 33 indexes |
| `project-context/brain.md` | Contexto legacy (parcialmente obsoleto) |
| `project-context/changelog.md` | Historial de cambios detallado |
| `true-project-context/CONTEXT.md` | Contexto consolidado legacy |
