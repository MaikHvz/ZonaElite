# ZONAELITE — Brain (Contexto IA)

> **Lee este archivo primero.** Contiene todo lo necesario para entender el proyecto sin revisar código fuente.

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
│   ├── nosotros/page.tsx         # Info + GalleryCarousel
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
│   └── *.tsx                     # Landing, EnrollModal, CheckoutModal, GalleryCarousel, etc.
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
| `/nosotros` | `nosotros/page.tsx` | Filosofía, GalleryCarousel, Disciplinas (mock), FAQ, Schema LocalBusiness |
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
**Público** en `/nosotros`: `GalleryCarousel` — auto-play 5s, arrows, dots, fade transitions. Inserta con `active: true`.

### 5.7 Ficha Médica

`/dashboard/cargas/[id]/medico`. `MedicalInfoCard` (enfermedades, lesiones, medicamentos, alergias) + `EmergencyContactCard` (nombre, teléfono). Upsert en `medical_records` por `beneficiary_id`.

### 5.8 Membresías Admin

- CRUD planes en `membership_plans`
- Asignación manual: buscar usuario → seleccionar beneficiario → plan → fecha inicio → método pago → monto → comprobante → crear membresía (activa) + pago (transferencia, pagado)
- Editar `end_date`, cancelar membresías
- PDF recibo con `@react-pdf/renderer`

---

## 6. Base de datos

### 28 Tablas

| Tabla | Descripción | FKs principales |
|-------|-------------|----------------|
| `roles` | 1=admin, 2=instructor, 3=recepcion, 4=alumno | — |
| `profiles` | Perfiles (id=auth.users.id) | FK → auth.users |
| `academy_settings` | Config academia (singleton) | — |
| `disciplines` | Kenpo, Kickboxing, Funcional, MMA | — |
| `schedules` | Horarios semanales | FK → disciplines, profiles (professor) |
| `class_sessions` | Sesiones generadas desde schedules | FK → schedules |
| `class_plans` | Restricción de plan por horario | FK → schedules, membership_plans |
| `class_enrollments` | Inscripciones en horarios | FK → schedules, beneficiaries |
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
| `payments` | Pagos (Flow, transferencia, efectivo) | FK → profiles, memberships |
| `events` | Torneos, ceremonias, seminarios | — |
| `blog_posts` | Publicaciones blog | — |
| `notifications` | Notificaciones | — |
| `audit_logs` | Logs auditoría | — |
| `gallery_images` | Galería (admin gestiona, muestra en /nosotros) | — |
| `consent_forms` | Formularios consentimiento | — |
| `body_metrics` | Métricas corporales | FK → beneficiaries |
| `medical_records` | Registros médicos | FK → beneficiaries |

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

- `dependents.category`: `'nino'` | `'adulto'`
- `membership_plans.category`: `'adulto'` | `'nino'`
- `schedules.category`: `'ninos'` | `'adultos'` | `'ambos'`
- `attendance.status`: `'presente'` | `'ausente'` | `'justificado'`
- `payments.status`: `'pendiente'` | `'pagado'` | `'fallido'` | `'reembolsado'`
- `memberships.status`: `'activa'` | `'vencida'` | `'cancelada'` | `'suspendida'`
- `blog_posts.status`: `'borrador'` | `'publicado'` | `'programado'`
- `events.type`: `'clase'` | `'torneo'` | `'seminario'` | `'otro'`

### 5 Funciones RPC

```sql
is_admin()           -- role_id = 1
is_staff()           -- role_id IN (1,2,3)
owns_beneficiary(b_id) -- usuario es dueño del beneficiario
handle_new_user()    -- trigger: crea profiles + beneficiaries en signup
update_updated_at()  -- trigger: updated_at = now() en update
```

### 59 RLS Policies

Todas las tablas tienen RLS habilitado. Patrón típico:
- Admin: `is_admin()` → acceso total
- Staff: `is_staff()` → lectura
- Usuario: `auth.uid() = user_id` o `owns_beneficiary()` → solo sus datos
- Service role (admin client): bypass total

### Storage

- Bucket: `"public"` (lectura pública)
- Carpetas: `products/`, `events/`, `gallery/`, `memberships/`, `receipts/`
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
2. Query `class_enrollments` donde `session_id=sessionId` OR `schedule_id=session.schedule_id`
3. Query `memberships` activas para enrolled beneficiary_ids
4. Construye lista de beneficiarios con estado de asistencia

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
9. **Hardcoded data**: Las disciplinas en `/nosotros` son mock hardcoded, no de BD.
10. **GalleryCarousel**: Siempre insertar con `active: true` explícito (PostgREST puede no aplicar defaults).
11. **`after()`** de `next/server` para procesamiento background — no fire-and-forget.
12. **Supabase PostgREST** no soporta ordering by nested FK columns.
13. **`membership_plans.category`** = `'adulto'|'nino'`, **`dependents.category`** = `'nino'|'adulto'` (orden invertido).
14. **`beneficiaries`** no tiene columna `category` — el category viene del `dependent` o se asume `'adulto'`.
15. **Spanish** en todo el contenido visible.
16. **Zonas Horarias**: NUNCA usar `new Date().toISOString().split("T")[0]` para calcular "hoy", ya que usa UTC y genera un desfase después de las 20:00 hora Chile. SIEMPRE importar y usar `getChileToday()` y `addDaysChile()` desde `src/lib/dates.ts`.

---

## 9. Archivos de referencia

| Archivo | Contenido |
|---------|-----------|
| `contexto/BRAIN.md` | Este archivo — contexto completo para IA |
| `contexto/01-project-context-flow.md` | Detalle de cada funcionalidad y flujo |
| `contexto/02-database-interaction.md` | Interacciones con BD por módulo, queries, RLS |
| `contexto/schema-complete.sql` | SQL completo: 26 tablas, 190 cols, 32 FKs, 59 RLS, 33 indexes |
| `project-context/brain.md` | Contexto legacy (parcialmente obsoleto) |
| `project-context/changelog.md` | Historial de cambios detallado |
| `true-project-context/CONTEXT.md` | Contexto consolidado legacy |
