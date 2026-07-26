# ZonaElite — Contexto Completo del Proyecto

> Documento único de referencia para el sistema de gestión de la academia de artes marciales **ZONAELITE**.

---

## 1. ¿Qué es ZonaElite?

**ZONAELITE** es una academia de artes marciales ubicada en La Serena, Chile, que ofrece entrenamiento en Kenpo, Kickboxing, Entrenamiento Funcional y MMA. El sistema web gestiona toda la operación académica: usuarios, membresías, pagos, horarios, asistencia, productos, eventos, blog, notificaciones y administración.

### Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.10 |
| UI | React | 19.2.4 |
| Lenguaje | TypeScript | ^5 |
| Estilos | Tailwind CSS v4 | ^4 (via `@theme inline` en globals.css, sin `tailwind.config.js`) |
| Base de datos + Auth + Storage | Supabase | `@supabase/supabase-js` 2.110.5, `@supabase/ssr` 0.12.3 |
| Gráficos | Recharts | ^3.9.2 |
| PDFs | @react-pdf/renderer | ^4.5.1 |
| Pagos | Flow.cl (sandbox) | API REST con HMAC-SHA256 |
| Linting | ESLint + eslint-config-next | ^9 |

### Diseño visual

- **Tema**: Material Design 3 dark theme
- **Fuentes**:
  - `Anton` → titulares / headlines (`--font-anton`)
  - `Hanken Grotesk` → cuerpo / body (`--font-hanken`)
  - `JetBrains Mono` → etiquetas / labels (`--font-jetbrains`)
- **Iconografía**: Material Symbols Outlined (via CDN en `<head>`)
- **Paleta MD3**: Definida vía CSS custom properties en `globals.css` (`@theme inline`), con tonos superficie oscura y acentos rojo/coral (`#ffb4ac`, `#ff544c`)
- **Componentes de estilo**: `.glass-panel`, `.glass-card`, `.btn-primary-gradient`, `.hero-gradient`, `.text-glow-red`, `.fade-up`
- **Idioma**: Español en toda la aplicación (`lang="es"`)

### Guard de administración

Solo `role_id === 1` tiene acceso al panel admin. Esto se valida en:
- `AdminGuard` (`src/components/admin/AdminGuard.tsx`) → componente client-side que redirige a `/auth` o `/dashboard`
- `SessionProvider` expone `isAdmin` (role_id === 1) e `isStaff` (role_id 1-3)

---

## 2. Roles del sistema

| role_id | Rol | Acceso |
|---------|-----|--------|
| 1 | Administrador | Acceso total. Panel admin completo (`/admin/*`). Protegido por `AdminGuard`. |
| 2 | Instructor | Acceso staff (`isStaff = true`). Vista limitada del panel. |
| 3 | Recepción | Acceso staff (`isStaff = true`). Vista limitada del panel. |
| 4 | Alumno | Rol por defecto al registrarse (asignado por trigger `handle_new_user()`). Acceso solo a `/dashboard` y rutas públicas. |

**Flujo de registro**: Al crear usuario en Supabase Auth → trigger `handle_new_user()` crea fila en `profiles` con `role_id=4` + crea fila en `beneficiaries` vinculando el perfil al propio usuario (`profile_id = user.id`, `dependent_id = NULL`).

---

## 3. Flujo completo de cada funcionalidad

### 3.1 Landing Page `/`

**Ruta**: `src/app/page.tsx`

Sección de la página principal, de arriba a abajo:

1. **Navbar** (global, en root layout)
2. **Hero** → sección principal con imagen de fondo, headline, CTA
3. **IntroSection** → presentación breve de la academia
4. **Disciplines** → bento grid con las 4 disciplinas (Kenpo, Kickboxing, Funcional, MMA)
5. **Memberships** → planes de membresía cargados desde la BD
6. **CTA** → llamado a acción de contacto
7. **Footer**

#### Navbar (global)

Presente en todas las páginas vía `src/app/layout.tsx`. Incluye:

- Links: Nosotros, Disciplinas (`#anchor`), Horarios, Membresías (`#anchor`), Tienda, Eventos, Blog
- Campana de notificaciones (solo si hay sesión activa)
- Botón "Mi Panel" (solo si hay sesión activa)
- Botón Perfil / CTA (según estado de autenticación)
- **ContactModal** se activa desde la navbar vía `ContactModalContext`

#### Animaciones

- `FadeUpObserver` → componente global que observa elementos con clase `.fade-up` y los anima al hacerse visibles en el viewport

---

### 3.2 Autenticación `/auth`

**Ruta**: `src/app/auth/`

| Sub-ruta | Función |
|----------|---------|
| `/auth` | Página principal con tabs de Login y Register |
| `/auth/confirm` | Confirmación de email (enlace de verificación de Supabase) |
| `/auth/update-password` | Restablecimiento de contraseña |

**Flujo de registro**:
1. Usuario ingresa email + contraseña en el form de registro
2. Supabase Auth crea el usuario
3. Trigger `handle_new_user()` se ejecuta automáticamente:
   - Crea fila en `profiles` con `role_id = 4` (alumno)
   - Crea fila en `beneficiaries` con `profile_id = user.id` y `dependent_id = NULL` (el usuario es su propio beneficiario)
4. Se envía email de confirmación
5. Usuario confirma en `/auth/confirm`

---

### 3.3 Dashboard del Usuario `/dashboard`

**Ruta**: `src/app/dashboard/`

#### Resumen principal (`/dashboard/page.tsx`)

- **Badge de estado de inscripción**: card entre hero y alertas — verde "Inscripción {plan} vigente hasta {fecha}" o ámbar "Sin inscripción" con enlace a `/dashboard/membresias`
- Membresías activas
- Pagos recientes
- Número de dependientes (cargas)
- Indicador de si pagó este mes

#### Sub-páginas

| Sub-ruta | Función |
|----------|---------|
| `/dashboard/membresias` | Detalle de membresías del usuario + estado de inscripción + botón "Comprar Inscripción" |
| `/dashboard/pagos` | Historial de pagos + verificación de pago Flow (`?token=XXX`) |
| `/dashboard/cargas` | Gestión de dependientes (cargas familiares) |
| `/dashboard/notificaciones` | Notificaciones recibidas |
| `/dashboard/asistencia` | Asistencia agrupada por fecha: disciplina, rango de horario, nombre del beneficiario, iconos de estado, contadores resumen |

#### Perfil

- Edición de perfil en `/perfil`

#### Registro Médico

- `/dashboard/cargas/[id]/medico`: vista/edición de información médica por dependiente
- **MedicalInfoCard**: enfermedades, lesiones, medicamentos, alergias
- **EmergencyContactCard**: nombre, teléfono
- Almacenamiento en tabla `medical_records` con upsert por `beneficiary_id`

---

### 3.4 Horarios `/horarios`

**Ruta**: `src/app/horarios/page.tsx`

**Descripción**: Cuadrícula semanal completamente dinámica, alimentada desde la BD.

- **Cuadrícula**: Grid semanal (lunes a sábado), coloreada por disciplina
- **Filtros**: Por disciplina
- **Barras de capacidad**: Muestran inscritos / cupo total de la próxima sesión de cada clase
- **Fecha próxima**: Cada celda muestra la fecha de la próxima sesión programada
- **Botón "Agendar"**: Abre `EnrollModal` con selección de sesión por fecha

#### EnrollModal

- Muestra el usuario actual + todos sus dependientes
- **Selección de fecha**: muestra las próximas sesiones del horario como botones con fecha y cupos disponibles
- Validación en tiempo real (orden estricta):
  1. Coincidencia de categoría (niño/adulto)
  2. **Inscripción a la academia activa** (`academy_enrollments` con `status='activa'` y `end_date >= hoy`)
  3. Membresía activa
  4. Compatibilidad de plan (el plan del usuario debe ser compatible con la clase según `class_plans`)
  5. No estar ya inscrito en esa sesión específica
- Si no tiene inscripción activa: `ineligibleReason = "Sin inscripción a la academia"` + enlace "Comprar inscripción"
- Inscripción almacenada en tabla `class_enrollments` vía `session_id` (una inscripción por sesión, no por horario)

---

### 3.5 Nosotros `/nosotros`

**Ruta**: `src/app/nosotros/page.tsx`

Secciones:
1. **Filosofía** → información de la academia
2. **GalleryCarousel** → carrusel de imágenes (auto-play, flechas, puntos, transiciones fade)
3. **Disciplinas** → datos hardcodeados (mock) de las 4 disciplinas (Kenpo, Kickboxing, Funcional, MMA)
4. **FAQ** → preguntas frecuentes con schema markup

**SEO**: Schema `LocalBusiness` + `FAQ` para rich snippets

---

### 3.6 Productos `/productos`

**Ruta**: `src/app/productos/`

- **Listado**: Grid de productos con filtros por categoría
- **Detalle**: `/productos/[id]`
  - Galería con thumbnails (hasta 3 imágenes via tabla `product_images`)
  - Precio, stock

---

### 3.7 Eventos `/eventos`

**Ruta**: `src/app/eventos/`

- **Página unificada**: Torneos + Ceremonias con filtros por tab
- **Detalle**: `/eventos/[id]`
  - Hero image
  - Tarjetas de información
  - Google Maps embebido (desde `location_url` en la BD)

> **Nota**: Existen rutas separadas `/torneos` y `/ceremonias` en el directorio `src/app/` pero la funcionalidad principal está en `/eventos`.

---

### 3.8 Blog `/blog`

**Ruta**: `src/app/blog/`

- Estilo feed de redes sociales
- Posts individuales en `/blog/[slug]`
  - `generateMetadata` para Open Graph tags
  - `ShareButton` para compartir

---

### 3.9 Pagos con Flow.cl (flujo completo)

Sistema de pagos integrado con la pasarela de Flow.cl en modo sandbox.

#### Flujo paso a paso

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Usuario     │────▶│  CheckoutModal   │────▶│  POST        │────▶│  Flow.cl       │
│  selecciona  │     │  selecciona      │     │  /api/flow/  │     │  sandbox       │
│  plan        │     │  beneficiario    │     │  create-order│     │  (pago)        │
└─────────────┘     └──────────────────┘     └──────────────┘     └───────┬────────┘
                                                                          │
                                                                          ▼
                                                              ┌────────────────────┐
                                                              │  Return URL:       │
                                                              │  /dashboard/pagos  │
                                                              │  ?token=XXX        │
                                                              └────────┬───────────┘
                                                                       │
                  ┌────────────────────────────────────────────────────┤
                  ▼                                                    ▼
       ┌──────────────────┐                              ┌──────────────────────┐
       │  POST callback:  │                              │  GET /api/flow/      │
       │  /api/flow/      │◄──── Flow.cl notifica ─────│  verify?token=XXX    │
       │  confirmation    │      (server-side)           │  (client-side check) │
       └────────┬─────────┘                              └──────────┬───────────┘
                │                                                   │
                ▼                                                   ▼
       ┌──────────────────┐                              ┌──────────────────────┐
       │  after():        │                              │  Muestra banner      │
       │  1. Verificar    │                              │  éxito/error         │
       │  2. Marcar pago  │                              │  en /dashboard/pagos │
       │  3. Crear        │                              └──────────────────────┘
       │     membresía    │
       └──────────────────┘
```

#### Archivos clave

| Archivo | Método | Función |
|---------|--------|---------|
| `src/lib/flow.ts` | — | Funciones core: `signFlowParams` (HMAC-SHA256), `createFlowOrder`, `verifyFlowPayment`, `verifyFlowCallbackSignature` |
| `src/lib/flow-helpers.ts` | — | Helpers: `confirmAndCreateMembership`, `markPaymentAsPaid`, `findPaymentByToken`, `findPaymentByTokenAndUser`, `extractPlanName`, `extendEnrollment` |
| `src/app/api/flow/create-order/route.ts` | POST | Crea pago pendiente en DB + orden en Flow API. Almacena `include_enrollment` y `enrollment_plan_id` en `payments`. Previene duplicados (reutiliza pago pendiente de últimos 5 min). Retorna URL de Flow. |
| `src/app/api/flow/confirmation/route.ts` | POST/GET | Callback de Flow. Usa `after()` de `next/server` para procesamiento background. Flujo: verificar firma → verificar pago → marcar pagado → crear membresía → extender inscripción (lee de `payments.include_enrollment`). |
| `src/app/api/flow/verify/route.ts` | GET | Verificación client-side. El frontend llama con el token para confirmar estado y mostrar banner. |
| `src/app/api/flow/force-confirm/route.ts` | POST | Recuperación manual para admin. Verifica con Flow API y fuerza confirmación si está pagado. |
| `src/app/api/flow/debug/route.ts` | GET | Diagnóstico de pagos: config, pagos recientes, verificación con Flow API. |

#### Detalles de implementación

**Creación de orden** (`create-order`):
- Valida autenticación del usuario
- Valida plan activo y beneficiario válido (perteneciente al usuario)
- Si `includeEnrollment=true`: valida plan de inscripción activo, calcula monto total (plan + enrollment)
- Genera `commerceOrder` como UUID
- Previene duplicados: busca pago pendiente del mismo usuario en últimos 5 minutos
- Inserta en `payments` con status `'pendiente'`, concepto `"Membresía {plan.name}"` o `"Inscripción {enrollmentPlan.name} + Membresía {plan.name}"`
- **Almacena `include_enrollment` y `enrollment_plan_id` directamente en la tabla `payments`** (no confía en el campo `optional` de Flow que no se retorna en `getStatus`)
- Llama a Flow API con `subject`
- Guarda `flow_token` y `flow_order` en el pago

**Confirmación** (`confirmation`):
- Accepta POST (form-urlencoded o JSON) y GET (fallback con query params)
- Usa `after()` de `next/server` para procesamiento asíncrono sin bloquear respuesta a Flow
- Flujo interno (`processInBackground`):
  1. Busca pago por `flow_token`
  2. Si ya está pagado, salta
  3. Verifica con Flow API (`status === 2` = pagado)
  4. Marca pago como `'pagado'` con `paid_at`
  5. Extrae nombre del plan del concepto (`"Membresía X"` → `"X"` o `"Inscripción Y + Membresía X"` → `"X"`)
  6. Busca plan en `membership_plans` por nombre (case-insensitive)
  7. Busca o crea beneficiario para el usuario
  8. Verifica dedup de membresía (ventana de 10 minutos)
  9. Crea membresía con `start_date` = hoy, `end_date` = hoy + `duration_days`
  10. **Si `payments.include_enrollment` está en `true`** (leído del registro de pago, NO de Flow): crea o extiende inscripción en `academy_enrollments` vía `extendEnrollment()`

**Verificación client-side** (`verify`):
- El frontend llama a `GET /api/flow/verify?token=XXX` al cargar `/dashboard/pagos`
- Si Flow confirma pago (`status === 2`), marca pagado y crea membresía
- Si Flow dice cancelado (`status === 4`), actualiza estado a `'cancelado'`
- Retorna JSON con estado para mostrar banner

**Cross-tab recovery** (`SessionProvider`):
- `flow_pending_token` se almacena en `sessionStorage`
- Al detectar `SIGNED_IN` o `INITIAL_SESSION`, redirige a `/dashboard/pagos?token=XXX` si hay token pendiente

#### Estados de pago Flow

| status | Significado |
|--------|------------|
| 1 | Pendiente |
| 2 | Pagado |
| 3 | Rechazado |
| 4 | Cancelado |
| 5 | Expirado |

#### Estados de inscripción

| status | Significado |
|--------|------------|
| activa | Inscripción vigente (end_date >= hoy) |
| vencida | Inscripción expirada (end_date < hoy) |
| cancelada | Inscripción cancelada por admin |

---

### 3.10 Panel Admin `/admin`

**Ruta**: `src/app/admin/`

Todas las rutas admin están protegidas por `AdminGuard` (role_id === 1) y usan `AdminSidebar` para navegación.

#### 3.10.1 Dashboard `/admin`

**Ruta**: `src/app/admin/page.tsx`

Componentes:
- **StatsCard** → estadísticas generales
- **RevenueChart** → gráfico de barras de ingresos (últimos 6 meses)
- **NewStudentsChart** → gráfico de área de nuevos alumnos (últimos 12 meses)
- **MembershipBreakdown** → gráfico donut de distribución de membresías
- **MonthlyComparison** → comparativa mensual
- **PaymentOverview** → resumen de pagos
- 8 accesos directos a sub-módulos

#### 3.10.2 CRUD Productos `/admin/productos`

- **DataTable** → tabla con búsqueda y paginación
- **FormModal** → modal para crear/editar productos
- **DeleteConfirm** → confirmación de eliminación
- **StatusBadge** → badge de estado (activo/inactivo)
- **ImageUpload** → carga de imágenes (hasta 3 por producto, almacenadas en Supabase Storage)
- Relación con tabla `product_images`

#### 3.10.3 CRUD Eventos `/admin/eventos`

- Filtros por tipo: torneo, graduación, seminario, clase especial
- Campo `location_url` para Google Maps embebido

#### 3.10.4 CRUD Horarios `/admin/horarios`

- Categoría (niño/adulto)
- Estado activo/inactivo
- Descripción
- Sala
- Selección de disciplina y profesor
- Restricciones de plan por horario vía tabla `class_plans`

#### 3.10.5 CRUD Tipos de Clase `/admin/tipos-clase`

- CRUD de disciplinas con: nombre, `color_hex`, icono, descripción, estado activo

#### 3.10.6 Usuarios `/admin/usuarios`

- Vista de usuarios + dependientes agrupados bajo tutor
- Cambio de roles
- Activar/desactivar usuarios

#### 3.10.7 Membresías `/admin/membresias`

- CRUD de planes de membresía
- Modal de asignación manual de membresías
- Edición/cancelación de membresías existentes
- Generación de recibos PDF (via `@react-pdf/renderer`)

#### 3.10.8 Asistencia `/admin/asistencia`

**UI**: Acordeón sesgado centrado en sesión, agrupado por fecha.

**Flujo de administración**:
1. **Generar sesiones**: Botón "Generar sesiones próximas" → llama a `POST /api/admin/generate-sessions`
   - Genera `class_sessions` para las próximas 4 semanas desde horarios activos
   - Idempotente: `ON CONFLICT DO NOTHING`
2. **Expandir acordeón de sesión**: Carga solo beneficiarios inscritos en ese horario
3. **"Todos presentes"**: Marca todos como presente de una vez
4. **Acciones individuales**: Botones de estado por beneficiario (presente/ausente/justificado)
5. **"Inscribir usuario"**: Modal de búsqueda por nombre → muestra usuarios + dependientes que coincidan → inscribe en el horario

**Vista del usuario** (`/dashboard/asistencia`):
- Agrupada por fecha
- Muestra disciplina, rango horario, nombre del beneficiario, iconos de estado, contadores resumen

#### 3.10.9 CRUD Blog `/admin/blog`

- Estados: borrador, programado, publicado

#### 3.10.10 CRUD Notificaciones `/admin/notificaciones`

- Tipos: aviso, recordatorio, comunicado, correo masivo

#### 3.10.11 Configuración `/admin/configuracion`

- Ajustes generales de la academia (`academy_settings`)
- CRUD de Galería:
  - Agregar/eliminar/reordenar imágenes
  - Toggle de visibilidad
  - `ImageUpload` a carpeta `gallery` en Supabase Storage

#### 3.10.12 Inscripciones `/admin/inscripciones`

**Ruta**: `src/app/admin/inscripciones/page.tsx`

Sistema de inscripciones (matrícula) a la academia. Dos tabs:

**Tab "Planes"**:
- CRUD de `enrollment_plans` con campos: nombre, precio, duración (días), activo
- `DataTable` + `FormModal` + `DeleteConfirm`
- `StatusBadge` con estado activo/inactivo

**Tab "Inscripciones"**:
- Tabla de `academy_enrollments` con joins a beneficiarios, dependientes y planes
- Botón "Asignar inscripción" → modal con:
  1. Búsqueda de usuario por nombre/email
  2. Selección de beneficiario
  3. Selección de plan de inscripción
  4. Método de pago (efectivo, transferencia, cortesía)
  5. Monto y comprobante
- INSERT en `academy_enrollments` con `start_date = hoy`, `end_date = hoy + duration_days`
- INSERT en `payments` con `method = 'transferencia'|'efectivo'|'cortesia'`, `status = 'pagado'`

**Reglas de negocio**:
- 1 inscripción activa por beneficiario
- Comprar una nueva **extiende** la inscripción desde la fecha de vencimiento actual
- La inscripción es **prerequisito** para comprar membresías e inscribirse en clases

---

## 4. Arquitectura técnica

### Estructura de directorios

```
src/
├── app/
│   ├── admin/              # Panel administrativo (protegido)
│   │   ├── asistencia/
│   │   ├── blog/
│   │   ├── configuracion/
│   │   ├── eventos/
│   │   ├── horarios/
│   │   ├── inscripciones/
│   │   ├── membresias/
│   │   ├── notificaciones/
│   │   ├── productos/
│   │   ├── tipos-clase/
│   │   └── usuarios/
│   ├── api/
│   │   ├── admin/
│   │   │   └── generate-sessions/
│   │   └── flow/
│   │       ├── confirmation/
│   │       ├── create-order/
│   │       ├── debug/
│   │       ├── force-confirm/
│   │       └── verify/
│   ├── auth/
│   ├── blog/
│   ├── dashboard/
│   │   ├── asistencia/
│   │   ├── cargas/
│   │   ├── membresias/
│   │   ├── notificaciones/
│   │   └── pagos/
│   ├── eventos/
│   ├── horarios/
│   ├── nosotros/
│   ├── productos/
│   ├── layout.tsx          # Root layout (Navbar, FadeUpObserver, ContactModal, SessionProvider)
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Tema MD3 + animaciones
│   ├── robots.ts           # SEO
│   └── sitemap.ts          # SEO
├── components/
│   ├── admin/              # Componentes del panel admin
│   ├── dashboard/          # Componentes del dashboard de usuario
│   └── *.tsx               # Componentes landing y compartidos
├── lib/
│   ├── flow.ts             # SDK de Flow.cl
│   ├── flow-helpers.ts     # Helpers de Flow
│   └── supabase/
│       ├── admin.ts        # getAdminClient() — service role, bypasses RLS
│       ├── auth.ts         # Funciones de autenticación
│       ├── client.ts       # createClient() — browser client, con auth, RLS enforced
│       ├── dashboard.ts    # Queries del dashboard
│       ├── middleware.ts   # Middleware de Supabase
│       ├── profile.ts      # Queries de perfil
│       ├── server.ts       # Server client para Server Components
│       └── storage.ts      # Funciones de Storage
└── providers/
    └── SessionProvider.tsx  # Context global de sesión, perfil, isAdmin, isStaff
```

### Patrones de arquitectura

| Concepto | Implementación |
|----------|---------------|
| **App Router** | Rutas bajo `src/app/`, layouts anidados, route handlers en `src/app/api/` |
| **Server Components** | Por defecto. No llevan `"use client"`. |
| **Client Components** | Llevan `"use client"` al inicio del archivo. Usados para interactividad. |
| **Admin client** | `getAdminClient()` en `src/lib/supabase/admin.ts` — usa `SUPABASE_SERVICE_ROLE_KEY`, bypassa RLS. Singleton. |
| **Browser client** | `createClient()` en `src/lib/supabase/client.ts` — usa `createBrowserClient` de `@supabase/ssr`, con autenticación, RLS enforced. |
| **Server client** | `createClient()` en `src/lib/supabase/server.ts` — para Server Components y route handlers. |
| **Error handling** | `safeQuery()` wrapper para queries de Supabase |
| **Tailwind v4** | Configuración vía `@theme inline` en `globals.css` (no usa `tailwind.config.js`) |
| **SEO** | `sitemap.ts`, `robots.ts`, `metadataBase` en root layout, JSON-LD, `generateMetadata` en páginas |
| **Providers** | `SessionProvider` (context global), `ContactModalProvider` (context de modal de contacto) |
| **Estilos MD3** | Custom properties CSS para todos los tokens de color MD3 |

### Variables de entorno requeridas

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo server-side) |
| `FLOW_API_URL` | URL de la API de Flow (sandbox: `https://sandbox.flow.cl/api`) |
| `FLOW_API_KEY` | API key de Flow |
| `FLOW_SECRET_KEY` | Secret key de Flow (para HMAC-SHA256) |
| `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_SITE_URL` | URL base del sitio |

---

## 5. Tablas principales de la base de datos

Total: 28 tablas en Supabase.

| # | Tabla | Descripción |
|---|-------|-------------|
| 1 | `roles` | Roles del sistema (1=admin, 2=instructor, 3=recepción, 4=alumno) |
| 2 | `profiles` | Perfiles de usuario vinculados a Auth users |
| 3 | `academy_settings` | Configuración general de la academia |
| 4 | `disciplines` | Disciplinas deportivas (nombre, color, icono) |
| 5 | `schedules` | Horarios semanales (disciplina, profesor, categoría, sala) |
| 6 | `class_sessions` | Sesiones de clase generadas desde schedules |
| 7 | `class_plans` | Restricciones de plan por horario |
| 8 | `class_enrollments` | Inscripciones de usuarios en sesiones específicas (`session_id`) |
| 9 | `dependents` | Dependientes (cargas familiares) |
| 10 | `beneficiaries` | Beneficiarios ( vínculo entre perfil/dependiente y el sistema) |
| 11 | `attendance` | Registro de asistencia |
| 12 | `membership_plans` | Planes de membresía (nombre, precio, duración) |
| 13 | `memberships` | Membresías activas de beneficiarios |
| 14 | `products` | Productos de la tienda |
| 15 | `product_images` | Imágenes de productos (hasta 3) |
| 16 | `product_orders` | Órdenes de productos |
| 17 | `order_items` | Items de órdenes |
| 18 | `payments` | Pagos (Flow, Webpay, etc.) |
| 19 | `events` | Eventos (torneos, ceremonias, seminarios) |
| 20 | `blog_posts` | Publicaciones del blog |
| 21 | `notifications` | Notificaciones a usuarios |
| 22 | `audit_logs` | Logs de auditoría |
| 23 | `gallery_images` | Imágenes de la galería (admin manages, display on `/nosotros`) |
| 24 | `consent_forms` | Formularios de consentimiento |
| 25 | `body_metrics` | Métricas corporales |
| 26 | `medical_records` | Registros médicos de dependientes |
| 27 | `enrollment_plans` | Planes de inscripción a la academia (nombre, precio, duración en días) |
| 28 | `academy_enrollments` | Inscripciones activas de beneficiarios a la academia (con vencimiento) |

---

## 6. Galería

- **Administración**: El admin gestiona imágenes en la página de Configuración (`/admin/configuracion`)
  - Agregar/eliminar/reordenar
  - Toggle de visibilidad (visible/oculta)
- **Almacenamiento**: Supabase Storage bucket `"public"`, carpeta `"gallery"`
- **Visualización pública**: `GalleryCarousel` en `/nosotros`
  - Auto-play cada 5 segundos
  - Flechas de navegación controladas por usuario
  - Puntos indicadores
  - Transiciones fade

---

## 7. Diagrama de relaciones de usuarios y beneficiarios

```
┌──────────────────────────────────────────────────────────┐
│                    Supabase Auth                          │
│                   (user accounts)                         │
└────────────────────────┬─────────────────────────────────┘
                         │ user.id
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    profiles                               │
│  id = auth.users.id                                       │
│  role_id (1-4), full_name, email, phone, birth_date,     │
│  photo_url, active                                        │
└──────┬───────────────────────────────────────────────────┘
       │
       ├── triggers handle_new_user() on signup
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                    beneficiaries                           │
│  id (PK)                                                  │
│  profile_id ──── FK → profiles.id (NULL if dependent)     │
│  dependent_id ── FK → dependents.id (NULL if self)        │
└──────────────────────────────────────────────────────────┘
       │
       ├── Al crear usuario: profile_id=user.id, dependent_id=NULL
       │   (el usuario es su propio beneficiario)
       │
       └── Al agregar dependiente: se crea fila con
           profile_id=NULL, dependent_id=dep.id

┌──────────────────────────────────────────────────────────┐
│                    dependents                              │
│  id (PK)                                                  │
│  tutor_id ──── FK → profiles.id                           │
│  name, category (nino/adulto), birth_date, etc.           │
└──────────────────────────────────────────────────────────┘
```
