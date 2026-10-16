# ZONAELITE — Brain (Contexto para IA)

> **Lee este archivo primero.** Está pensado para que una IA en una sesión nueva entienda el proyecto completo sin recorrer el código. Fue reconstruido contra el código fuente real el 2026-10-16 (último commit `0d44c71`, v1.10.0).
>
> Orden de lectura recomendado: este archivo → `documentacion/guia-de-trabajo.md` (SOP obligatorio antes de implementar) → el `contexto/requisitos/<feature>.md` del módulo que vayas a tocar.
>
> **⚠️ El espejo SQL no es confiable para RLS, triggers ni CHECK.** El 2026-10-16 se auditó la base real de Supabase: tablas y columnas coinciden, pero policies, triggers y valores permitidos difieren y hay **agujeros de seguridad abiertos** (incluida escalada a admin). Ver `contexto/auditoria-esquema-real.md` antes de tocar BD, RLS o pagos. La §6 de este archivo ya refleja la base real.

---

## 0. Resumen en 30 segundos

- **Qué es:** sistema web integral de **ZonaElite**, academia de artes marciales (American Kenpo, Kickboxing, Funcional, MMA) en La Serena, Chile. Sirve como landing pública, tienda online, portal del alumno y panel administrativo.
- **Stack:** Next.js **16.2.10** (App Router, `src/app/`) + React 19.2 + TypeScript 5 + Tailwind **v4** + **Supabase** (Postgres + Auth + Storage + RLS) + **Flow.cl** (pagos) + Nodemailer (Gmail SMTP). Deploy en Vercel (`https://zona-elite-six.vercel.app`).
- **Idioma:** todo el contenido visible en **español** (Chile). Zona horaria de negocio: **America/Santiago**.
- **Núcleo del dominio:** todo derecho (membresía, matrícula, pack personalizado, asistencia, evento) se ancla a un **beneficiario** (`beneficiaries`), que es o el propio usuario titular o una de sus **cargas** (`dependents`).
- **Dos canales para obtener membresías/matrículas/packs:** (1) **manual** — transferencia con comprobante validada por el administrador (o asignación directa desde el panel); (2) **online** — Flow.cl. **Hoy los tres productos están en modo `manual` por temas legales** (verificado en BD 2026-10-16); Flow solo se usa en la tienda de productos. El toggle está en `/admin/configuracion` → "Modo de Pago".
- **No hay ORM ni backend separado.** Las páginas son mayormente `"use client"` y consultan Supabase directo con el browser client (RLS); las operaciones sensibles van por **route handlers** en `src/app/api/` con el cliente service-role, o por **RPC `SECURITY DEFINER`** en Postgres.

---

## 1. Stack, entorno y comandos

| Capa | Tecnología / detalle |
|------|----------------------|
| Framework | Next.js 16.2.10 — **usa `src/proxy.ts`, no `middleware.ts`** (convención nueva). Leer `node_modules/next/dist/docs/` ante dudas de API |
| UI | React 19.2.4, TypeScript ^5 |
| Estilos | Tailwind CSS v4 vía `@theme inline` en `src/app/globals.css`. **No existe `tailwind.config.js`** |
| BD/Auth/Storage | `@supabase/supabase-js` 2.110, `@supabase/ssr` 0.12 |
| Pagos | Flow.cl API REST + firma HMAC-SHA256 (sandbox por defecto) |
| Email | `nodemailer` (Gmail SMTP, App Password) — `src/lib/email.ts` |
| Gráficos | `recharts` (dashboard admin) |
| PDF | `@react-pdf/renderer` (recibo de membresía) |
| Excel | `exceljs` / `xlsx` — `src/lib/excel.ts` |
| QR | `qrcode.react` (QR de check-in en asistencia) |

**Diseño:** Material Design 3 dark (`#131313` fondo, `#ffb4ac` primary, `#ff544c` primary container). Fuentes Anton (títulos), Hanken Grotesk (cuerpo), JetBrains Mono (labels) vía `next/font/google`. Iconos **Material Symbols Outlined** (CDN). Clases utilitarias propias: `.glass-panel`, `.glass-card`, `.btn-primary-gradient`, `.hero-gradient`, `.text-glow-red`, `.fade-up` (animadas por `FadeUpObserver`).

**Variables de entorno:**

```
NEXT_PUBLIC_SUPABASE_URL              # URL Supabase (proyecto sfkkfcticgqdqvzthimz)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # anon key (browser/server client)
SUPABASE_SERVICE_ROLE_KEY             # service role — SOLO server (getAdminClient)
FLOW_API_URL                          # default https://sandbox.flow.cl/api
FLOW_API_KEY / FLOW_SECRET_KEY        # credenciales Flow (HMAC)
NEXT_PUBLIC_BASE_URL                  # base para urlConfirmation/urlReturn de Flow (se fuerza https)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
```

**Comandos:**

```bash
npm run dev      # next dev
npm run build    # next build
npm run lint     # eslint
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs   # suite de pruebas (Node 24+, sin deps)
```

---

## 2. Mapa del repositorio

```
/
├── AGENTS.md / CLAUDE.md          # instrucciones para IA (CLAUDE.md solo incluye AGENTS.md)
├── PLAN-PRODUCCION.md             # plan de fixes pre-producción (todo COMPLETADO, histórico)
├── contexto/
│   ├── BRAIN.md                   # ESTE archivo
│   ├── 01-project-context-flow.md # detalle funcional por pantalla (parcialmente desactualizado)
│   ├── 02-database-interaction.md # queries/RLS por módulo (80KB, detalle profundo)
│   ├── flujo-modulos.md           # comportamiento vigente de check-in/tokens/deudas/Flow
│   ├── informe-bugs.md            # B-001…B-020, todos 🟢 RESUELTOS
│   ├── migrations/                # 001…034 *.sql (fuente de verdad de cambios de BD)
│   └── requisitos/                # un .md por feature (requisito + análisis de impacto)
├── documentacion/
│   ├── guia-de-trabajo.md         # SOP obligatorio de 4 fases
│   ├── flujo-modulos.md           # resumen técnico por módulo (se actualiza post-feature)
│   ├── requisitos-implementados.md# registro de features implementadas
│   ├── squema-sql-actualizado.sql # ESPEJO 1:1 del esquema (la suite lo valida)
│   ├── resumen-empresa.md
│   └── plan-clases-*.md
├── project-context/               # legacy: requerimientos.md + 2 SQL de inscripciones
├── scripts/test-flows.mjs         # suite de pruebas (~2500 líneas)
├── public/                        # imágenes estáticas (logo, banners)
└── src/
    ├── proxy.ts                   # refresca sesión + protege rutas
    ├── app/                       # páginas y route handlers (App Router)
    ├── components/                # públicos en raíz; admin/, dashboard/, guide/, history/
    ├── context/CartContext.tsx    # carrito (localStorage "ze_cart")
    ├── providers/SessionProvider.tsx
    └── lib/                       # lógica de negocio reutilizable (ver §3.6)
```

Archivos sueltos en la raíz sin uso en la app: `hola.html` (vacío), `fix-B020-force-confirm-debug.patch`, `logo*.png`, `original*.jpg`. No referenciarlos.

---

## 3. Arquitectura transversal

### 3.1 Clientes Supabase (no mezclar)

| Cliente | Archivo | Dónde | RLS |
|---------|---------|-------|-----|
| Browser | `src/lib/supabase/client.ts` → `createClient()` | Componentes `"use client"` (la mayoría de páginas) | **Aplica** |
| Server | `src/lib/supabase/server.ts` → `await createClient()` | Route handlers / Server Components (lee cookies). Se usa para **identificar al usuario** (`auth.getUser()`) | **Aplica** |
| Admin | `src/lib/supabase/admin.ts` → `getAdminClient()` (singleton) | **Solo** en `src/app/api/**` | **Bypass** (service role) |

Patrón estándar de un route handler protegido: `server.auth.getUser()` → leer `profiles.role_id` → si no es `1` responder 403 → operar con `getAdminClient()` → registrar en `audit_logs` cuando es acción admin.

### 3.2 Autenticación, roles y protección de rutas

| role_id | Rol | Notas |
|---------|-----|-------|
| 1 | Administrador | Único con acceso a `/admin/*` y a las APIs admin |
| 2 | Instructor | `isStaff` (lectura en varias tablas vía `is_staff()`); sin UI propia |
| 3 | Recepción | `isStaff`; sin UI propia |
| 4 | Alumno | Default al registrarse |

- **`src/proxy.ts`** → `updateSession()` (`src/lib/supabase/middleware.ts`): refresca cookies; redirige a `/auth` si se accede sin sesión a `/dashboard`, `/perfil`, `/admin` (excepción: `/dashboard/pagos?token=…` para el retorno de Flow); redirige a `/dashboard` si hay sesión y se visita `/auth*`. El matcher **excluye `/api/`** — cada API valida su propia auth.
- **`/admin`**: `admin/layout.tsx` envuelve en `AdminGuard` (cliente, exige `role_id === 1`) + `PendingTransferProvider` + `AdminSidebar` + `PendingTransferBanner`.
- **`/dashboard`**: `dashboard/layout.tsx` exige sesión, envuelve en `UserPendingTransferProvider` + `DashboardNav`.
- **`SessionProvider`** (`src/providers/SessionProvider.tsx`): contexto `{ session, user, profile, loading, isAdmin, isStaff, refreshProfile }` vía `useSession()`. También implementa la **recuperación cross-tab de Flow**: si hay `flow_pending_token` en `sessionStorage` al hacer SIGNED_IN, redirige a `/dashboard/pagos?token=…`.
- Funciones auth cliente en `src/lib/supabase/auth.ts` (`signUp`, `signIn`, `signOut`, `resetPassword`, `updatePassword`) con mensajes de error traducidos.

**Root layout** (`src/app/layout.tsx`): `SessionProvider > CartProvider > ContactModalProvider > GuideProvider > Navbar + FadeUpObserver + children + ContactModal + GuideTour`.

### 3.3 Fechas — regla crítica

**Nunca** `new Date().toISOString().split("T")[0]` (UTC → salta de día después de las ~20:00 en Chile). Usar `src/lib/dates.ts`:
`getChileToday()`, `addDaysChile(date, n)`, `chileDateToUtc(date)` (para comparar contra columnas `timestamptz`), `chileMonthStartDate/EndDate`, `chilePrevMonth*`, `chileQuarter*`, `chileMonthsBackStart(n)`, `chileMonthKey(iso)`.
En SQL usar **`public.chile_today()`** en vez de `current_date`. La suite (`scripts/test-flows.mjs`, sección B) falla si reaparecen patrones de fecha UTC en `src/`.

### 3.4 Patrones recurrentes

- **`after()` de `next/server`** para trabajo en background (callback de Flow, emails). Nunca fire-and-forget sin `after`.
- **RPC `SECURITY DEFINER`** para escrituras con reglas de negocio/concurrencia (inscripción a clases, packs, eventos, desinscripción). Usan `PERFORM … FOR UPDATE` sobre la fila padre para serializar cupos, son **idempotentes** ("Ya inscrito" = success) y devuelven una fila por beneficiario `{beneficiary_id, success, error_code, error_message}`.
- **El `concept` del pago es el enrutador** de qué beneficio se asigna al confirmar: `"Membresía X"`, `"Inscripción X"`, `"Clase Personalizada X"`, `"Tienda: <ref>"` (se combinan con `" + "`). El nombre del plan se resuelve con `ilike` contra la tabla de planes → **renombrar un plan rompe la asignación de pagos pendientes con el nombre viejo**. Las transferencias usan IDs explícitos (`membership_plan_id`, `personalized_plan_id`, `enrollment_plan_id`). Como el usuario puede editar sus propios pagos flow por RLS y el callback no compara montos, esto es explotable (S-2 en la auditoría).
- **Estado efectivo vs. persistido:** `memberships.status` puede seguir en `'activa'` con `end_date` pasada. La UI usa `effectiveMembershipStatus()` (`src/lib/membership-status.ts`) y el dashboard dispara `rpc("expire_benefits")` best-effort para persistir `'vencida'`.
- `maybeSingle()` cuando la fila puede no existir; `upsert(..., { onConflict })` para idempotencia.
- **Errores en admin:** `getSupabaseErrorMessage()` (`src/lib/admin-helpers.ts`, traduce 23505/23503/42501) + componente `Toast`.
- **UI admin base:** `DataTable` (búsqueda con `searchKey: string | string[]`), `FormModal`, `DeleteConfirm`, `StatusBadge`, `ImageUpload`, `Toast`.
- PostgREST **no ordena por columnas de FK anidadas** → ordenar en cliente.
- Insertar `gallery_images` con `active: true` explícito.

### 3.5 Storage

Bucket único **`public`** (lectura pública). Carpetas: `products/`, `events/`, `gallery/`, `memberships/`, `receipts/`, `vouchers/`, `podiums/`. Helper cliente `src/lib/supabase/storage.ts` (`uploadImage(file, folder)` → URL pública; `deleteImage(url)`; `getImagePath(url)`), máx. 5 MB, JPG/PNG/WebP/GIF. Los vouchers de transferencia se suben server-side (acepta también PDF/HEIC/etc.). Descarga forzada con `?download=`.

### 3.6 `src/lib/` — catálogo

| Archivo | Responsabilidad |
|---------|-----------------|
| `dates.ts` | Fechas Chile (ver §3.3) |
| `flow.ts` | SDK Flow: `createFlowOrder`, `verifyFlowPayment`, `verifyFlowCallbackSignature`, `buildFlowPaymentUrl(token)`, `mapFlowStatus` (1 pendiente, 2 pagado, 3 rechazado, 4 cancelado) |
| `flow-helpers.ts` | Asignación post-pago: `createMembershipForPayment` / `confirmAndCreateMembership`, `confirmPersonalizedPack`, `extendEnrollment`, `isVerificationOrderMatch`, `notifyPaymentWithoutMembership` (alerta staff), `notifyUserPaymentStatus` (in-app, dedup por `Ref: <paymentId>`), `findPaymentByToken*` |
| `enrollments.ts` | `extendOrCreateEnrollment` — crea o **extiende** la matrícula desde `max(end_date, hoy)` |
| `payment-settings.ts` | Modo de pago por producto (`online`/`manual`) + datos bancarios en `academy_settings.payment_settings` |
| `store.ts` | Tienda: `reserveStock`/`restoreStock` (RPC), `buildStoreReference`, `isStorePayment`, `confirmProductOrder`, `cancelStoreOrder`, `handleStorePaymentApproved/Rejected`, `sendStoreOrderReceipt` |
| `email.ts` | `sendWelcomeEmail`, `sendTransferRequestEmail` (a todos los admin), `sendTransferReviewEmail`, `sendProductReceiptEmail` |
| `excel.ts` | `exportProfessionalExcel`, `exportMultipleSheetsToExcel`, `exportToExcel` |
| `membership-status.ts` | `effectiveMembershipStatus`, `isMembershipExpired`, `daysRemaining` |
| `qr-lock.ts` | **server-only**: hash scrypt de la contraseña QR, `timingSafeEqual`, rate-limit en memoria (8 intentos / 15 min) |
| `rut.ts` | `normalizeRut`, `isValidRut` (módulo 11, cuerpo 1.000.000–25.000.000), `formatRut` |
| `medidas.ts` | Validación peso (0–300) / altura (0–250) / mano dominante (`diestro`/`zurdo`) |
| `sport-profile.ts` | Tipos y helpers de perfil deportivo/podios (`PODIUM_POSITIONS`, `computePodiumStats`, …) |
| `admin-helpers.ts` | `getSupabaseErrorMessage` |
| `supabase/dashboard.ts` | **~1.570 líneas**: casi todas las queries del dashboard de usuario y de asistencia admin (`getUserMemberships`, `getDashboardSummary`, `getUserDependents`, `getAttendanceForSession`, `markAttendance`, `getBeneficiaryTokens`, `getUserPersonalizedData`, notificaciones, analytics de asistencia, etc.), envueltas en `safeQuery()` |
| `supabase/storage.ts`, `auth.ts`, `profile.ts`, `middleware.ts` | Ver arriba |

---

## 4. Modelo de dominio central

### 4.1 Usuarios, cargas y beneficiarios

```
auth.users ─1:1─ profiles (role_id, rut, address, weight, height, dominant_hand)
                   │
                   ├── beneficiaries (profile_id = user.id, dependent_id = NULL)   ← el titular
                   │
                   └── dependents (tutor_id = user.id, category nino|juvenil|adulto)
                         └── beneficiaries (dependent_id = dep.id, profile_id = NULL) ← cada carga
```

- `memberships`, `academy_enrollments`, `personalized_packs`, `class_enrollments`, `personalized_enrollments`, `attendance`, `debts`, `event_attendees`, `medical_records`, `sport_profiles`, `sports_podiums`, `consent_forms`, `body_metrics` → todos apuntan a **`beneficiary_id`**.
- **Los `beneficiaries` los crean triggers de la BD**, no la app: `trg_profiles_create_beneficiary` (AFTER INSERT en `profiles`) y `trg_dependents_create_beneficiary` (AFTER INSERT en `dependents`). CHECK `chk_beneficiary_exactly_one` (exactamente uno de `profile_id`/`dependent_id`) + UNIQUE en cada columna. Las APIs admin `create-user`/`create-dependent` igual "aseguran" la fila (redundante pero inocuo).
- El "dueño" de un beneficiario (para RLS y notificaciones) es `profile_id` o `dependents.tutor_id` → función `owns_beneficiary(b_id)`.
- `beneficiaries` **no tiene `category`**: se toma de `dependents.category` o del plan (titular ≈ `adulto`).
- Categorías por edad: `nino` < 10, `juvenil` 10–15, `adulto` ≥ 16 (`computeCategoryFromBirth` en admin/usuarios y APIs de cargas). En `schedules.category` se usan **plurales** (`ninos|juveniles|adultos`, `text[]`); `EnrollModal` convierte con `categoryToPlural()`.

### 4.2 Los tres "derechos" que se compran

| Derecho | Tabla | Plan | Qué habilita | Vigencia |
|---------|-------|------|--------------|----------|
| **Membresía** | `memberships` | `membership_plans` (`tokens` NULL = ilimitado; `featured` único) | Asistir a clases **normales** | `start_date`..`end_date`; **máx. 1 activa por beneficiario** (índice único parcial). Comprar otra **cancela la activa** |
| **Matrícula / inscripción a la academia** | `academy_enrollments` | `enrollment_plans` | Prerrequisito para clases normales (y para comprar membresía en la UI) | Una activa; comprar otra **extiende** desde el vencimiento actual |
| **Pack de clases personalizadas** | `personalized_packs` | `personalized_plans` (`total_classes`, `validity_days`) | Clases de horarios `mode='personalizado'` | Se **acumulan** packs; estado `activa|agotada|vencida|cancelada` |

**Para inscribirse/asistir a una clase normal** se requiere: membresía activa vigente + matrícula activa vigente + cupo (+ plan permitido por `class_plans` y categoría compatible en la UI). Si la membresía tiene tokens y se agotaron: en `/horarios` se bloquea en la UI; en **check-in QR se permite y se genera una deuda**.

### 4.3 Tokens y deudas

- Tokens **dinámicos**, no hay contador persistido: `get_remaining_tokens(beneficiary, membership)` = `plan.tokens − (inscripciones en la ventana de la membresía − justificaciones)`. Negativo = deuda.
- Marcar asistencia `justificado` **devuelve** un token (y notifica vía `rpc("notify_token_return")`). Desinscribir (RPC `cancel_class_enrollment`) también lo devuelve.
- `debts` materializa la deuda cuando el check-in QR inscribe sin tokens (1 fila por sesión, `pendiente|pagada|condonada`). Se gestiona en `/admin/deudas`.

---

## 5. Módulos

Formato: **Rutas UI** · **APIs** · **Tablas / RPC** · **Archivos clave** · **Reglas**.

### M1. Sitio público, landing y SEO
- **UI:** `/` (`Hero → IntroSection → Disciplines → Memberships → PersonalizedPlans → CTA → Footer`), `/quienes-somos` (historia interactiva Kenpo/Kickboxing/MMA con `HistoryExplorer` + `stories.ts` estático, `GalleryCarousel`, `MaestroSection`, FAQ, JSON-LD LocalBusiness), `/horarios`, `/productos`, `/productos/[id]`, `/eventos`, `/eventos/[id]`, `/blog`, `/blog/[slug]`.
- Redirects: `/nosotros` → `/quienes-somos` (301, `next.config.ts`); `/torneos`, `/ceremonias` → `/eventos`.
- `Navbar` global (oculto en `/admin`): links, carrito, campana, "Mi Panel", "Admin". `ContactModal` vía `ContactModalContext` (WhatsApp).
- SEO: `sitemap.ts`, `robots.ts`, `metadataBase`, `generateMetadata` en blog/eventos/productos.
- Componentes sin uso actualmente (no importados en ninguna página): `Lifestyle`, `Philosophy`, `Security`.

### M2. Autenticación y perfil
- **UI:** `/auth` (tabs login/registro; acepta `?redirect=`), `/auth/confirm`, `/auth/update-password`, `/perfil` (nombre, teléfono, nacimiento, RUT, dirección, peso/altura/mano, cambio de contraseña).
- **Signup:** `/auth` pide nombre, **RUT** y **fecha de nacimiento** (obligatorios), correo y contraseña → `rpc("check_registration_conflict")` → `supabase.auth.signUp` con `full_name`, `rut`, `birth_date` en metadata → trigger `trg_on_auth_user_created` (en `auth.users`) → `handle_new_user()` inserta `profiles` con esos datos (role_id por default 4) → trigger `trg_profiles_create_beneficiary` crea el beneficiario.
- **Una cuenta por persona (v1.11.0, migración 037):** índices únicos sobre `normalize_rut(rut)` y `canonical_email(email)` (Gmail sin puntos ni `+etiqueta`). `create-user` consulta `find_account_conflicts` y responde 409 (bloquea por RUT o correo; advierte por nombre + fecha de nacimiento). **En curso:** eliminación del sistema de cargas, donde cada alumno, incluidos los niños, tendrá su propia cuenta (plan en `contexto/requisitos/cuenta-unica-por-alumno.md`). No crear funcionalidades nuevas basadas en `dependents`.

### M3. Usuarios, cargas y fichas
- **Admin `/admin/usuarios`:** lista titulares con sus cargas agrupadas, columna RUT, búsqueda por nombre/email/RUT, cambiar rol, activar/desactivar, **crear usuario** (`POST /api/admin/create-user`: crea auth user con contraseña aleatoria + email de bienvenida + beneficiario + audit), **crear y asignar carga** (`CreateDependentModal` → `POST /api/admin/create-dependent`), editar carga (`POST /api/admin/update-dependent`), "Ver Ficha" (`VerFichaModal`, solo lectura), perfil deportivo (`SportProfileModal`), export Excel (mes/año/histórico).
- **Usuario `/dashboard/cargas`:** `DependentCard` + `AddDependentModal` + `EditDependentModal` (update directo por RLS `dependents_update_own_or_admin`), checkbox "usar dirección del tutor", `TutorSportCard`.
- **Ficha médica `/dashboard/cargas/[id]/medico`:** `MedicalInfoCard` + `EmergencyContactCard` (upsert `medical_records` por `beneficiary_id`) + `PhysicalInfoCard` (peso/altura/mano en `dependents`).
- **Reglas:** RUT validado con `src/lib/rut.ts` en todos los formularios; medidas con `src/lib/medidas.ts` (y CHECK en BD); las APIs admin revalidan en servidor.

### M4. Perfil deportivo (v1.5.0, migración 024)
- **Tablas:** `belt_grades` (grados por disciplina con color, seed Blanco→Negro), `sport_profiles` (beneficiario+disciplina+grado; trigger `sport_profile_validate_grade` impide grado de otra disciplina), `sports_podiums` (torneo, fecha, posición `1|2|3|participacion`, foto en `podiums/`).
- **RLS:** escritura **solo admin**; lectura dueño o admin. Anclado a `beneficiaries` (no a `dependents`) para que el tutor no pueda auto-asignarse grados.
- **UI:** admin `SportProfileModal` + `PodiumFormModal`; usuario `BeltBanner`, `SportProfileInfo`, `PodiumStatsLine`, `TutorSportCard`. El color del cinturón viene siempre de BD.

### M5. Disciplinas, horarios y sesiones
- **Admin:** `/admin/tipos-clase` (CRUD `disciplines`: nombre, `color_hex`, icono, descripción, activo), `/admin/horarios` (CRUD `schedules`: disciplina, profesor, sala, día, horas, capacidad, `category text[]`, activo, descripción, **`mode` normal|personalizado — inmutable tras crear**; planes permitidos en `class_plans` (normal) o `personalized_schedule_plans` (personalizado); vacío = todos).
- **Sesiones:** `class_sessions` (una por horario y fecha, `status` `cerrada|activa`). Se generan con **`POST /api/admin/generate-sessions`** (solo admin, próximas 4 semanas, idempotente vía `upsert onConflict schedule_id,session_date`), disparado desde `/admin/asistencia`.
- **Público `/horarios`:** grilla semanal coloreada por disciplina, filtros, cupos; "Agendar" abre `EnrollModal` (normal) o `PersonalizedEnrollModal` (personalizado).

### M6. Membresías y tokens
- **Admin `/admin/membresias`:** tabs **Planes** (CRUD `membership_plans`: precio, `duration_days`, categoría, `benefits` jsonb, `tokens`, `featured`) · **Membresías** (filtros activas/próximas a vencer/vencidas, asignación manual `AssignMembershipModal` → crea membresía + pago `transferencia/pagado`, editar `end_date`, cancelar, recibo PDF `MembershipReceipt`) · **Personalizadas** (packs, ver M8).
- **Usuario `/dashboard/membresias`:** resumen de cobertura por beneficiario (matrícula + membresía + tokens), compra vía `CheckoutModal`.
- **Reglas:** crear membresía (Flow, transferencia o admin) **cancela todas las activas** del beneficiario y crea la nueva con `start_date = hoy Chile`; dedup de 10 min; índice `idx_memberships_one_active` + retry en `23505`.

### M7. Matrícula (inscripción a la academia)
- **Admin `/admin/inscripciones`:** tabs Planes (CRUD `enrollment_plans`) · Inscripciones (lista, filtros, asignación manual).
- **Compra:** sola o combinada con membresía en `CheckoutModal` (`includeEnrollment` + `enrollmentPlanId` → columnas `payments.include_enrollment`/`enrollment_plan_id`).
- **Reglas:** 1 activa por beneficiario; comprar otra **extiende** (`extendOrCreateEnrollment`); el vencimiento bloquea compras/inscripciones nuevas pero no anula la membresía vigente. INSERT por RLS solo admin/staff (el flujo de pago usa service role).

### M8. Clases personalizadas (módulo desacoplado)
- **Packs:** `personalized_plans` (catálogo público) → compra (`PersonalizedCheckoutModal`, concepto `"Clase Personalizada X"`) → `personalized_packs` vía `confirmPersonalizedPack`. **Nunca** se combina con membresía/matrícula en un mismo pago. No toca `memberships` ni tokens.
- **Horarios personalizados:** `schedules.mode='personalizado'`; inscripción por **RPC `enroll_personalized_class`** (consume 1 clase del pack más próximo a vencer de forma atómica, valida plan permitido y aforo; pack → `agotada` al llenarse). Registro en `personalized_enrollments` (no en `class_enrollments`).
- **Sin QR:** `/api/checkin` responde 403 para sesiones personalizadas; la asistencia se marca manualmente en `/admin/asistencia` reutilizando `attendance`.
- Admin: `AssignPersonalizedModal` y tab "Personalizadas" en `/admin/membresias`.

### M9. Inscripción a clases normales
- `EnrollModal` (desde `/horarios`): muestra titular + cargas, valida en cliente categoría, membresía activa, plan permitido (`class_plans`), tokens y duplicados; luego llama **RPC `enroll_class(p_session_id, p_beneficiary_ids[])`**, que revalida en servidor: sesión no pasada, autorización, membresía vigente (`NO_MEMBERSHIP`), matrícula vigente (`NO_ENROLLMENT`), aforo con lock (`CLASS_FULL`). Inserta `class_enrollments` con `source='horarios'`.
- `class_enrollments.source`: `horarios | admin | qr`. Modelo **por sesión** (`session_id`); existen filas legacy con solo `schedule_id` (inscripción recurrente) que algunos flujos aún consideran.

### M10. Asistencia (admin + check-in QR)
- **Admin `/admin/asistencia`** (página más grande, ~1.760 líneas): tabs **Próximas** / **Histórico** (rango de fechas, editable). Por sesión: lista de inscritos (`getAttendanceForSession`; ramifica por `mode`), marcar presente/ausente/justificado (`markAttendance`, upsert `onConflict session_id,beneficiary_id`), "Todos presentes", inscribir usuario manualmente (normal: insert `source='admin'`; personalizado: RPC), **desinscribir** (RPC `cancel_class_enrollment`, solo admin: borra inscripción + deuda pendiente + asistencia, devuelve token/clase, notifica al titular).
- **Flujo QR:** admin activa la sesión (`class_sessions.status='activa'` desde el browser) → se muestra `QRCodeSVG` con `/checkin/<sessionId>` → alumno escanea, inicia sesión (`/auth?redirect=…`) y elige beneficiarios → **`POST /api/checkin`**: verifica propiedad, sesión activa y no personalizada; si no estaba inscrito exige membresía vigente + matrícula vigente, inscribe con `source='qr'` y, sin tokens, crea `debts`; marca `presente` y devuelve estado `al_dia|atrasado|sin_membresia|sin_matricula`. La alerta en pantalla dura `academy_settings.qr_alert_duration` s.
- **Contraseña de sesión QR (v1.9.0):** tabla singleton `qr_session_lock` (hash scrypt, RLS admin-only; **sin fila = sin bloqueo**). `GET/POST /api/admin/qr-lock` (`set`/`clear`/`verify`, nunca devuelve el hash). **"Finalizar asistencia" va obligatoriamente por `POST /api/admin/close-session`** (verifica contraseña, marca ausentes, `status='cerrada'`, devuelve resumen). El desbloqueo vive solo en estado React (nunca `localStorage`). Config en `/admin/configuracion`.
- **Usuario `/dashboard/asistencia`:** historial agrupado por fecha con estadísticas (`getUserAttendance`, `getUserAttendanceStats`).

### M11. Deudas
- **Admin `/admin/deudas`:** lista `debts` con beneficiario y sesión, filtros pendientes/resueltas/todas, marcar `pagada` o `condonada` (`resolved_at`, `resolved_by`). Escritura solo admin por RLS. Usuario lee las propias (`getPendingDebts`).

### M12. Pagos online (Flow) — canal 2, hoy desactivado para membresías/matrícula/packs
> Con `payment_settings` en `manual` (estado actual), `create-order` responde 400 y la UI muestra solo transferencia. Este flujo sigue vivo para la **tienda** (M14) y para cuando se reactive. Todas las escrituras de `payments` van con el admin client y el monto cobrado se valida contra `payments.amount` (`isVerificationAmountMatch`, migración 035).
```
CheckoutModal / PersonalizedCheckoutModal
  → POST /api/flow/create-order {planId?, beneficiaryId, includeEnrollment?, enrollmentPlanId?, personalizedPlanId?}
      valida plan(es), propiedad del beneficiario, matrícula existente, modo de pago (400 si está en "manual")
      reutiliza pago pendiente previo si Flow aún lo acepta (si no, lo marca y crea uno nuevo — B-019)
      inserta payments(status='pendiente', method='flow', concept, commerce_order=uuid) + createFlowOrder
  → redirect a Flow
  → Flow llama POST/GET /api/flow/confirmation (responde 200 de inmediato; after()):
      buscar pago por flow_token → si ya 'pagado' salir → verifyFlowPayment
      status≠2 → marcar rechazado/cancelado, restaurar tienda, notificar usuario
      commerceOrder debe coincidir (B-007) → marcar 'pagado'
      concepto con "Membresía" → createMembershipForPayment
      include_enrollment → extendEnrollment
      "Clase Personalizada" → confirmPersonalizedPack
      "Tienda:" + order_id → handleStorePaymentApproved
      fallo de asignación → notifyPaymentWithoutMembership (alerta a staff); éxito → notifyUserPaymentStatus('approved')
  → Flow retorna a /dashboard/pagos?token=… → GET /api/flow/verify (requiere sesión; reintenta la misma asignación de forma idempotente y devuelve estado para el banner / PaymentSuccessModal / PaymentErrorModal)
```
- **Nunca confiar en el `returnUrl`**: el estado se verifica contra la API de Flow.
- Las rutas `/api/flow/debug` y `/api/flow/force-confirm` fueron **eliminadas** (B-020). No recrearlas.
- Usuario: `/dashboard/pagos` (historial paginado, `PaymentRow`, `TransferRequestsPanel`).

### M13. Pago manual por transferencia (v1.1.0+, migración 013) — canal 1, **activo hoy**
- Es el canal principal en producción: ~56 transferencias aprobadas a oct-2026. Junto con la asignación directa del admin (`AssignMembershipModal`, `AssignPersonalizedModal`, `/admin/inscripciones` con métodos efectivo/transferencia/cortesía), cubre toda la venta de beneficios.
- Toggle por tipo (`memberships`, `personalized`, `enrollment`) + datos bancarios en `academy_settings.payment_settings`, editable en `/admin/configuracion` → "Modo de Pago".
- Usuario: `TransferPaymentStep` (en el checkout) → **`POST /api/payments/transfer`** (voucher base64 ≤ 5 MB a `vouchers/`, crea `payments` `method='transferencia'`, `status='pendiente'`, `commerce_order='REF-ZE-XXXXXX'`, IDs de plan explícitos; notificación staff + email a todos los admin).
- Admin: `/admin/ventas?tab=solicitudes` → **`POST /api/payments/review`** (solo admin; guard `WHERE status='pendiente'`): **aprobar** → `pagado` + asigna membresía/pack/matrícula con los mismos helpers (cada beneficio con su propio `if`, ninguno se pierde) + `admin_note` opcional; **rechazar** → `rechazado` + motivo. En ambos casos notificación in-app + email al usuario.
- Feedback: `PendingTransferProvider` (poll 30 s) → badge en "Ventas" + `PendingTransferBanner`; espejo en usuario con `UserPendingTransferProvider` + badge en "Pagos" + `UserPendingTransferBanner`.

### M14. Tienda, carrito y órdenes (v1.4.0, migraciones 020–021)
- **UI:** `/productos`, `/productos/[id]` (galería hasta 3 imágenes, "Agregar al carrito" / "Comprar ahora"), `/carrito`, `/tienda/confirmacion`, `/dashboard/tienda` ("Mis compras"). Carrito en `CartContext` (`localStorage` `ze_cart`, fallback en memoria).
- **Checkout `POST /api/store/checkout`:** usuario logueado **o invitado** (email + teléfono obligatorios); precios siempre desde BD; **reserva stock** atómica (`decrement_product_stock`, guarda `stock >= qty`) → `product_orders` (`pendiente`, `reference`) + `order_items` + `payments` (`concept='Tienda: <ref>'`, `order_id`) → Flow con `returnUrl=/api/store/return`. Si algo falla tras reservar, restaura stock.
- `/api/store/return` normaliza GET/POST de Flow a `303 → /tienda/confirmacion?token=…`; la página consulta `GET /api/store/order-status`.
- Confirmación/rechazo en el callback de Flow: `pagado` + email de recibo, o `cancelado` + `increment_product_stock`.
- **Admin `/api/store/admin/orders`:** GET lista; PATCH `enviado` (desde `pagado`) / `entregado` (desde `pagado|enviado`) / `cancelar` (restaura stock). Guard optimista por estado.
- Estados de orden: `borrador | pendiente | pagado | enviado | entregado | cancelado`. CRUD de productos en `/admin/productos` (`products` + `product_images`).

### M15. Ventas (admin)
- `/admin/ventas` (~1.380 líneas): tabs **Pagos** (todos los `payments` con filtro por tipo, export), **Solicitudes** (transferencias pendientes/revisadas, ver voucher, aprobar/rechazar con nota, toast de confirmación), **Tienda** (órdenes y cambio de estado). Abre la tab por `?tab=solicitudes`.

### M16. Eventos y lista de asistencia (v1.8.0–v1.10.0)
- **Admin `/admin/eventos`:** CRUD `events` (`type` torneo|graduacion|seminario|clase_especial — CHECK real, `event_date`, `location_name`, `location_url` para Google Maps, imagen en `events/`); columna **Asistencia** con contador → `EventAttendeesModal` (lista + quitar con `cancel_event_attendance`).
- **Público:** `/eventos` (tabs por tipo), `/eventos/[id]` (hero, mapa embebido, imagen como **adjunto descargable** con lightbox `ImagePreviewModal`), `EventEnrollButton` + `EventEnrollModal` (selección múltiple titular/cargas → RPC `enroll_event`; botón "Inscrito" con hover "Eliminar asistencia").
- **Reglas:** `event_attendees` sin policies de escritura (solo RPC); sin aforo, sin tokens, sin exigir membresía ni matrícula; eventos pasados bloqueados (lista histórica). No toca tablas de clases.

### M17. Notificaciones y correos
- **Dos tablas distintas:**
  - `notifications` — **broadcast** creado por admin en `/admin/notificaciones` (`type` ∈ `correo_masivo|aviso|recordatorio|comunicado`, `target` ∈ `todos|segmento` por CHECK real; los usuarios solo leen `target='todos'`). **Bug F-1:** el código guarda alertas de sistema con `type='sistema'`, `target='staff'` (pago sin membresía, nueva transferencia) y el CHECK real las rechazaba → nunca se guardaban. La migración 035 amplía los CHECK.
  - `user_notifications` — **personales** (`user_id`, `title`, `content`, `read`): resultados de pago, token/clase devuelta, etc.
- Usuario: `/dashboard/notificaciones` (historial + filtros), campana en `Navbar` (`getUnreadNotificationCount`).
- Correos (`src/lib/email.ts`, best-effort): bienvenida con contraseña temporal, solicitud de transferencia (a admins), resultado de revisión (a usuario), recibo de tienda.

### M18. Blog
- Admin `/admin/blog`: CRUD `blog_posts` con estados `borrador | programado | publicado`, portada y galería. Público `/blog` (feed) y `/blog/[slug]` (`generateMetadata`).

### M19. Reglamento interno
- Tabla `reglamento_interno` (contenido único). Admin edita en `/admin/reglamento`; usuarios leen en `/dashboard/reglamento`. RLS: lectura pública, escritura admin.

### M20. Configuración y galería
- `/admin/configuracion`: datos de la academia (`academy_settings`: nombre, logo, dirección, WhatsApp, `social_links`, `qr_alert_duration`), **Modo de Pago** (M13), **Seguridad de la sesión QR** (M10), **Galería de Espacios** (`gallery_images`: agregar/quitar/reordenar/visibilidad; se muestra en `/quienes-somos`).
- `academy_settings` es legible por todos (`USING (true)`) → **nunca guardar secretos ahí**.

### M21. Dashboard admin y métricas
- `/admin`: `StatsCard`, `RevenueChart`, `NewStudentsChart`, `MembershipBreakdown`, `MonthlyComparison`, `PaymentOverview`, `AttendanceOverview` (`getAdminAttendanceAnalytics`). Usa límites de mes/trimestre Chile-aware.

### M22. Dashboard del usuario
- `/dashboard`: resumen (`getDashboardSummary`: membresías, pagos recientes, cargas, pagado este mes; dispara `expire_benefits`), `EnrollmentBanner`, `AlertBanner`, `QuickStats`, `MembershipCard`, `PurchaseSuccessBanner`. Tabs (`DashboardNav`): Resumen, Membresías, Pagos, Mi Tienda, Cargas, Asistencia, Alertas, Reglamento.

### M23. Changelog de desarrolladores
- Tabla `changelog` (`version` UNIQUE, `title`, `summary`), **solo lectura admin** en `/admin/changelog`. Las entradas se agregan **solo por migración SQL** `NNN_changelog_vX_Y_Z.sql` con `ON CONFLICT (version) DO NOTHING`. Última: **v1.10.0**.

### M24. Guía interactiva (onboarding)
- `src/components/guide/`: `GuideProvider`/`useGuide`, `GuideTour` (spotlight por selector `[data-guide='…']`), `GuideTooltip`, `GuideHelpButton`. Tours definidos como datos en `guide-data.ts`: `membresias`, `horarios`, `cargas`, `perfil`, `landing`, `dashboard`. Vistos se recuerdan en `localStorage` (`ze_guide_viewed_<id>`). Al cambiar una UI con tour, **actualizar los `data-guide`**.

---

## 6. Base de datos

Proyecto Supabase `sfkkfcticgqdqvzthimz` ("Web principal zona elite", Postgres 17, `ca-central-1`). Espejo documental: `documentacion/squema-sql-actualizado.sql` (**tablas/columnas fieles; RLS, triggers y CHECK no**). Esta sección refleja la **base real** auditada el 2026-10-16 (`contexto/auditoria-esquema-real.md`). RLS habilitado en todas las tablas **excepto `roles`**; **87 policies** reales.

### 6.1 Tablas (≈41) por dominio

| Dominio | Tablas |
|---------|--------|
| Identidad | `roles`, `profiles`, `dependents`, `beneficiaries`, `audit_logs` |
| Fichas | `medical_records`, `body_metrics`, `consent_forms`, `belt_grades`, `sport_profiles`, `sports_podiums` |
| Clases | `disciplines`, `schedules`, `class_sessions`, `class_plans`, `class_enrollments`, `attendance`, `debts`, `qr_session_lock` |
| Membresías / matrícula | `membership_plans`, `memberships`, `enrollment_plans`, `academy_enrollments` |
| Personalizadas | `personalized_plans`, `personalized_packs`, `personalized_schedule_plans`, `personalized_enrollments` |
| Pagos / tienda | `payments`, `products`, `product_images`, `product_orders`, `order_items` |
| Contenido | `events`, `event_attendees`, `blog_posts`, `gallery_images`, `reglamento_interno`, `changelog` |
| Comunicación | `notifications`, `user_notifications` |
| Config | `academy_settings` (singleton, incl. `payment_settings` jsonb) |

`body_metrics` y `consent_forms` existen en BD pero no tienen UI activa.

### 6.2 Valores de estado (texto con CHECK real, no ENUM nativo)

- `payments.status`: `pendiente | pagado | rechazado | expirado | cancelado`; `payments.method`: `efectivo | transferencia | flow | otro` + `cortesia` tras la migración 035 (antes el CHECK rechazaba la opción "Cortesía" de `/admin/inscripciones` — bug F-2)
- `memberships.status`: `activa | vencida | cancelada` (no existe `suspendida`)
- `academy_enrollments.status`: `activa | vencida | cancelada`
- `personalized_packs.status`: `activa | agotada | vencida | cancelada`
- `attendance.status`: `presente | ausente | justificado`
- `class_sessions.status`: `activa | cerrada` (default `cerrada`)
- `class_enrollments.source`: `horarios | admin | qr`
- `debts.status`: `pendiente | pagada | condonada`
- `product_orders.status`: `borrador | pendiente | pagado | enviado | entregado | cancelado`
- `schedules.mode`: `normal | personalizado`; `schedules.category`: `text[]` ⊆ `{ninos, juveniles, adultos}`
- `dependents.category` / `membership_plans.category`: `nino | juvenil | adulto`
- `blog_posts.status`: `borrador | publicado | programado`; `events.type`: `torneo | graduacion | seminario | clase_especial`
- `notifications.type`: `correo_masivo | aviso | recordatorio | comunicado` (+ `sistema` tras 035); `notifications.target`: `todos | segmento` (+ `staff` tras 035)
- `roles.name`: `administrador | instructor | recepcion | alumno`; `schedules.day_of_week`: 0–6 (0 = domingo)
- Sin CHECK en BD: `schedules.category` (el espejo declara uno que no existe)
- `sports_podiums.position`: `1 | 2 | 3 | participacion`

### 6.3 Funciones / RPC

| Función | Tipo | Uso |
|---------|------|-----|
| `is_admin()`, `is_staff()`, `owns_beneficiary(b_id)` | helpers RLS (SECURITY DEFINER) | En casi todas las policies |
| `chile_today()` | fecha local | Policies y RPCs |
| `handle_new_user()` | trigger `trg_on_auth_user_created` (auth.users) | Crea `profiles` (role 4 por default) |
| `create_beneficiary_for_profile()` / `create_beneficiary_for_dependent()` | triggers `trg_profiles_create_beneficiary` / `trg_dependents_create_beneficiary` | Crean el `beneficiaries` correspondiente |
| `set_updated_at()` | triggers `trg_*_updated_at` | academy_settings, blog_posts, dependents, medical_records, products, profiles |
| `update_updated_at()` | triggers | qr_session_lock, sport_profiles, sports_podiums |
| `compute_category_from_birth(date)` | helper SQL | nino < 10, juvenil < 16, adulto (sin uso desde la app; la app tiene su propia copia en TS) |
| `sport_profile_validate_grade()` | trigger | Coherencia grado/disciplina |
| `expire_benefits()` | RPC | Pasa a `vencida` membresías/matrículas/packs vencidos |
| `get_remaining_tokens(b, m)` / `get_enrollment_debt(b, m)` | RPC | Tokens dinámicos / detalle de exceso |
| `enroll_class(session, b[])` | RPC | Inscripción normal con validaciones y lock |
| `enroll_personalized_class(session, b[])` | RPC | Inscripción personalizada, consume pack |
| `cancel_class_enrollment(session, b)` | RPC (solo admin) | Desinscribir + devolver token/clase |
| `enroll_event(event, b[])` / `cancel_event_attendance(event, b)` | RPC | Lista de asistencia a eventos |
| `decrement_product_stock` / `increment_product_stock` | RPC | Reserva/restauración de stock |
| `notify_token_return(user, beneficiary_name, date, discipline)` | RPC | Notificación "Token devuelto" al justificar (existe en BD; falta en el espejo) |

### 6.4 Restricciones clave

- `idx_memberships_one_active` — único parcial: 1 membresía `activa` por beneficiario.
- `membership_plans_one_featured_idx` — 1 plan destacado.
- UNIQUE: `class_sessions (schedule_id, session_date)`, `attendance (session_id, beneficiary_id)`, `class_enrollments (session_id, beneficiary_id)`, `class_plans (schedule_id, plan_id)`, `personalized_enrollments (session_id, beneficiary_id)`, `event_attendees (event_id, beneficiary_id)`, `sport_profiles (beneficiary_id, discipline_id)`, `beneficiaries (profile_id)`, `beneficiaries (dependent_id)`, `medical_records (beneficiary_id)`, `disciplines (name)`, `blog_posts (slug)`, `roles (name)`, `changelog (version)`, `product_orders (reference)` parcial.
- CHECK estructurales: `beneficiaries.chk_beneficiary_exactly_one`, `class_enrollments.chk_enrollment_target` (`session_id` o `schedule_id` no nulo).
- **No existe índice en `payments.flow_token`** (se consulta en cada callback de Flow).

### 6.5 RLS real (resumen)

Todas las policies tienen rol `public`; el filtro es `auth.uid()`/`is_admin()`/`is_staff()`/`owns_beneficiary()`. Catálogos → lectura pública, escritura admin. Datos de alumno → dueño + admin, y en varias tablas **staff con escritura completa** (`payments`, `attendance`, `class_sessions`, `medical_records`, `product_orders`). `event_attendees` → solo SELECT (escritura por RPC). Tabla completa por tabla en `contexto/auditoria-esquema-real.md` §4.

**Agujeros de seguridad:** S-1 un usuario podía cambiar su propio `role_id` → admin · S-2 el usuario podía editar sus pagos flow y el callback no validaba monto · S-3 inserción/borrado directo de `class_enrollments` sin validaciones · S-4 cualquier autenticado podía borrar/reemplazar archivos del bucket · S-5 cualquiera podía insertar `user_notifications` · S-6 `roles` sin RLS. **Corregidos en la migración `035_security_hardening.sql` (v1.10.1), APLICADA en producción el 2026-10-16 y verificada contra la BD**: usuarios sin escritura sobre `payments`/`class_enrollments`/`user_notifications`/storage; `profiles` protegido por el trigger `trg_profiles_protect_privileged`. Abierto por decisión de negocio: S-7 (staff con escritura amplia).

---

## 7. Migraciones y versionado

- Carpeta `contexto/migrations/`, numeradas `001…034`, **idempotentes**, aplicadas **manualmente** en el SQL Editor de Supabase. Cada feature con cambios de BD agrega su migración **y** replica el DDL en `documentacion/squema-sql-actualizado.sql` (la suite lo verifica).
- Ojo: hay números repetidos (`018_*`, `019_*`, `020_*` tienen dos archivos cada uno: feature + changelog). La próxima migración libre es **039** (reservada para la BD de migración de cargas).
- Cada feature registra su changelog con una migración `NNN_changelog_vX_Y_Z.sql`. Historial:

| Versión | Feature | Migraciones |
|---------|---------|-------------|
| v1.0.0 | Mejoras membresías/asistencia/disciplinas, desinscribir | 011, 012 |
| v1.1.0 | Pago por transferencia | 013, 014 |
| v1.1.1 | Crear/asignar carga desde admin | 015 |
| v1.1.2 | Editar cargas + validación RUT | 016 |
| v1.2.0 | Nota del admin en aprobaciones | 017 |
| v1.2.1 | Dirección en perfil y cargas | 018 |
| v1.3.0 | Datos físicos + Ver Ficha | 019 |
| v1.4.0 | Tienda de productos | 020, 021 |
| v1.4.1 | Vencimiento automático de beneficios | 022, 023 |
| v1.5.0 | Perfil deportivo | 024, 025 |
| v1.6.0 | Categoría juvenil + horarios multi-categoría | 026, 027 |
| v1.7.0 | Histórico de asistencia | 029 |
| v1.8.0 | Adjunto de imagen en eventos | 030 |
| v1.9.0 | Contraseña de sesión QR | 031, 032 |
| v1.10.0 | Lista de asistencia a eventos | 033, 034 |
| v1.10.1 | Endurecimiento de seguridad (RLS, storage, CHECK, monto Flow) — aplicada 2026-10-16 | 035, 036 |
| v1.11.0 | Una cuenta por persona (RUT único, correo canónico) — **pendiente de aplicar** | 037, 038 |

Anteriores (001–010): tokens, membresía activa única, `chile_today` en RLS, `enroll_class`, ventana de tokens, deudas + RLS, `location_url`, reglamento, packs personalizados, horarios personalizados. `028`: FK `personalized_packs.purchased_by`.

---

## 8. Pruebas

`scripts/test-flows.mjs` — Node 24+, sin dependencias, mezcla tests unitarios (importa `src/lib/*.ts` directamente; por eso esos archivos usan imports con extensión `.ts`) y **análisis estático** del código y del espejo SQL. Secciones A…AE: zona horaria, scan de fechas UTC, HMAC Flow, contratos de esquema/RLS, inscripciones, vencimientos, atomicidad, deudas, reglamento, navbar, feedback Flow, personalizadas, desinscripción, changelog, transferencias, cargas, RUT, dirección, datos físicos, perfil deportivo, adjunto de eventos, QR lock, eventos. Al agregar una feature, **agregar su sección** y mantener el espejo SQL sincronizado o la suite falla.

---

## 9. Huecos conocidos y riesgos (verificar antes de asumir)

1. **Seguridad (S-1…S-7) y bugs de esquema (F-1…F-4):** ver `contexto/auditoria-esquema-real.md`. S-1…S-6, F-1 y F-2 corregidos por la migración 035, aplicada y verificada en producción el 2026-10-16. Siguen abiertos por decisión de negocio: S-7 (staff con escritura amplia) y vouchers en bucket público.
2. **El espejo SQL diverge de producción** en policies, triggers, CHECK, índices y 5 funciones. La suite solo valida espejo ↔ migraciones, **nunca contra la BD real**. Cualquier afirmación sobre RLS debe verificarse en la base (ver auditoría §5).
3. Varias migraciones del repo (p.ej. las policies "endurecidas" de B-005/B-013) **no se reflejan en producción**: o no se aplicaron, o se aplicaron sobre policies con otros nombres que siguen activas en paralelo (las permisivas se suman por OR).
4. El espejo SQL repite bloques (`enrollment_plans`/`academy_enrollments` aparecen dos veces). Es histórico; no "limpiar" sin revisar la suite.
5. Asignación de planes por **nombre** en pagos Flow (ver §3.4).
6. `class_sessions.status` se activa desde el browser client (RLS admin); el **cierre** sí pasa por servidor.
7. Rate-limit de QR lock en memoria: se reinicia con cada instancia serverless.
8. `contexto/01-project-context-flow.md` y `02-database-interaction.md` pueden estar desactualizados en detalles; ante conflicto, manda el código y el espejo SQL.

---

## 10. Reglas para la IA

1. **Antes de implementar cualquier feature**, ejecutar las 4 fases de `documentacion/guia-de-trabajo.md`: (1) requisito en `contexto/requisitos/<feature>.md`, (2) análisis de impacto (checkout/Flow, fechas Chile, tokens/dashboard), (3) implementación, (4) documentación: actualizar `documentacion/flujo-modulos.md`, `documentacion/requisitos-implementados.md`, el espejo SQL, **este BRAIN.md** y la migración de changelog.
2. Cambios de BD → nueva migración numerada idempotente en `contexto/migrations/` + espejo 1:1 en `documentacion/squema-sql-actualizado.sql` + sección en `scripts/test-flows.mjs`. **Antes de diseñar**, verificar el estado real de la tabla en Supabase (policies/CHECK/triggers), porque el espejo puede mentir. Al crear policies nuevas, **eliminar también las permisivas existentes** con otros nombres (se combinan por OR).
3. Fechas: solo helpers de `src/lib/dates.ts` / `chile_today()`.
4. `getAdminClient()` es **server-only** (solo dentro de `src/app/api/**`). Nunca importarlo en componentes.
5. Operaciones con reglas de negocio o concurrencia → RPC `SECURITY DEFINER` (patrón: auth dentro, lock `FOR UPDATE`, idempotente, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`) o route handler con validación de `role_id`. No abrir policies de escritura nuevas para "hacer funcionar" algo desde el cliente.
6. Pagos: nunca confiar en el retorno del navegador; toda asignación debe ser idempotente (Flow puede llamar el callback más de una vez y `verify` reintenta). No recrear `force-confirm`/`debug`.
7. Clases personalizadas, eventos y tienda son **módulos desacoplados**: no deben tocar `memberships`, tokens, `class_enrollments` ni `attendance` de clases normales (salvo la asistencia manual de personalizadas, que reutiliza `attendance`).
8. Desinscribir de una sesión → siempre RPC `cancel_class_enrollment`. Cerrar sesión QR → siempre `/api/admin/close-session`.
9. Secretos nunca en `academy_settings` (lectura pública).
10. UI: Tailwind v4 con tokens del tema, Material Symbols, componentes admin existentes (`DataTable`, `FormModal`, `Toast`, …). Todo texto visible en español.
11. Next.js 16: `proxy.ts` (no `middleware.ts`); consultar `node_modules/next/dist/docs/` ante APIs dudosas.
12. Las historias de `/quienes-somos` son estáticas (`src/components/history/stories.ts`), no vienen de BD.

---

## 11. Índice de documentación de referencia

| Archivo | Para qué |
|---------|----------|
| `documentacion/guia-de-trabajo.md` | SOP obligatorio |
| `contexto/auditoria-esquema-real.md` | **BD real vs. espejo** + hallazgos de seguridad (2026-10-16) |
| `documentacion/squema-sql-actualizado.sql` | Esquema documental (tablas/columnas fieles; RLS/triggers/CHECK no) |
| `documentacion/flujo-modulos.md` | Resumen técnico por módulo, secciones 1–15 |
| `documentacion/requisitos-implementados.md` | Registro de features |
| `contexto/flujo-modulos.md` | Comportamiento vigente de check-in, tokens, deudas, Flow |
| `contexto/02-database-interaction.md` | Queries y RLS por módulo (detalle profundo) |
| `contexto/informe-bugs.md` | Historial de bugs B-001…B-020 y sus fixes |
| `contexto/requisitos/*.md` | Requisito + análisis de impacto de cada feature (p.ej. `pago-manual-transferencia.md`, `bloqueo-sesion-qr.md`, `lista-asistencia-eventos.md`, `tienda-carrito-ventas.md`, `perfil-deportivo-alumnos.md`, `clases-horario-personalizadas.md`, `sistema-tokens/`) |
| `PLAN-PRODUCCION.md` | Fixes pre-producción (histórico, completado) |
