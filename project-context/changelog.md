# Changelog

## 2026-07-17 (noche)

### Flow Payments — Fixes
- **`/api/flow/verify`** (GET) — Verificación client-side del pago al retornar de Flow
- **`create-order`** — Previene pagos duplicados (reutiliza token si ya existe pago pendiente)
- **`confirmation`** — Búsqueda por `commerceOrder` como fallback (además de `token`)
- **`pagos/page.tsx`** — Verifica pago via `/api/flow/verify?token=XXX` al retornar de Flow
- **RLS policies**: `payments_user_insert_own` (solo method=flow), `payments_flow_update` (para callback)

## 2026-07-17 (tarde-noche)

### Módulo 4 — Asistencia y Ficha Médica ✅
- **Ficha Médica**: `/dashboard/cargas/[id]/medico` — ver/editar info médica por dependiente
  - `MedicalInfoCard.tsx` — enfermedades, lesiones, medicamentos, alergias (edición inline)
  - `EmergencyContactCard.tsx` — contacto de emergencia: nombre y teléfono (edición inline)
  - `upsertMedicalRecord()` en dashboard.ts — upsert con onConflict
  - `DependentCard.tsx` actualizado — botón "Ver ficha médica" con link
- **Asistencia Admin**: `/admin/asistencia` — marcar asistencia por sesión de clase
  - Lista de sesiones próximas con disciplina, hora, instructor
  - Grid de asistencia: Presente / Ausente / Justificado por beneficiario
  - Conteo resumen de presentes, ausentes, justificados
  - `getUpcomingSessions()`, `getAttendanceForSession()`, `markAttendance()` en dashboard.ts
  - AdminSidebar actualizado con link de Asistencia
- **Historial Asistencia**: `/dashboard/asistencia` — usuario ve su historial
  - Estadísticas: total, presentes, ausentes
  - Lista cronológica con disciplina, beneficiario, estado
  - `getUserAttendance()` en dashboard.ts
  - DashboardNav actualizado con tab "Asistencia"
- Build: 35 rutas, 0 errores TypeScript

## 2026-07-17 (tarde)

### Plan de Implementación Flow Payments
- **`true-project-context/FLOW-PAYMENTS-PLAN.md`** — Plan completo en 8 fases para integrar Flow.cl
- Incluye: modelo de datos, flujos de usuario, edge cases, testing checklist
- Cubre: compra online (Flow Webpay) + asignación manual (admin) como sistema dual
- **Medios de pago**: Solo Webpay para usuario online. Transferencia/efectivo solo para admin manual.

### Flow Payments — Implementación (FASE 0-5)
- **`src/lib/flow.ts`** — Utilidades: signFlowParams, createFlowOrder, verifyFlowPayment
- **`src/app/api/flow/create-order/route.ts`** — POST: crea payment + orden Flow
- **`src/app/api/flow/confirmation/route.ts`** — POST: callback Flow, verifica pago, crea membresía
- **`src/components/CheckoutModal.tsx`** — Modal: selección beneficiario + resumen plan + botón Webpay
- **`src/components/PurchaseSuccessBanner.tsx`** — Banners de éxito/error post-pago
- **`src/components/Memberships.tsx`** — Botón "Comprar" (logueado) / "Seleccionar" (no logueado)
- **`src/app/dashboard/pagos/page.tsx`** — Banner de estado post-pago (?status=success|failed)
- **`project-context/sql-flow-payments.sql`** — ALTER TABLE para columnas de Flow
- **`.env.local`** — Variables FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_API_URL, NEXT_PUBLIC_BASE_URL

### Bug Fixes
- **FadeUpObserver**: Removido `fade-up` de páginas async-loaded (dashboard, sub-routes, perfil)
- **DependentCard**: Fix `beneficiaries?.flatMap` → normalizar a array (Supabase retorna objeto)
- **getUserMemberships**: Fix `d.beneficiaries?.[0]?.id` → manejar array u objeto
- **AddDependentModal**: Nuevo componente para que usuarios agreguen sus propias cargas
- **`/dashboard/cargas`**: Agregado botón "Agregar carga" + modal de formulario

## 2026-07-17

### Dashboard del Usuario — Implementación Completa
- **`/dashboard`** reescrito: resumen real con membresías, pagos, notificaciones desde Supabase
- **`/dashboard/membresias`** — Vista completa con filtros (todas/activas/vencidas/canceladas)
- **`/dashboard/pagos`** — Historial paginado con resumen del mes
- **`/dashboard/cargas`** — Lista de dependientes con info de membresía
- **`/dashboard/notificaciones`** — Historial de notificaciones con filtros por tipo
- **`/perfil`** — Ahora editable: nombre, teléfono, nacimiento + cambio de contraseña

### Componentes Dashboard (`src/components/dashboard/`)
- `DashboardNav.tsx` — Navegación horizontal por tabs
- `MembershipCard.tsx` — Card con barra de progreso, badge de estado, beneficios
- `QuickStats.tsx` — 3 cards: membresías activas, pagos del mes, cargas
- `AlertBanner.tsx` — Alertas de membresía por vencer/vencida/sin membresía
- `DashboardSkeleton.tsx` — Loading states para cada sección
- `NotificationItem.tsx` — Fila de notificación con icono por tipo
- `PaymentRow.tsx` — Fila de pago con método, monto, estado, comprobante
- `DependentCard.tsx` — Card de dependiente con edad y membresía

### Queries (`src/lib/supabase/dashboard.ts`)
- `safeQuery()` — Wrapper centralizado de manejo de errores
- `getUserMemberships()` — Membresías propias + de cargas
- `getUserPayments()` — Pagos paginados
- `getUserDependents()` — Dependientes con membresía activa
- `getUserNotifications()` — Notificaciones paginadas
- `getDashboardSummary()` — Resumen para dashboard principal
- `getProfileForEdit()` + `updateProfile()` — Edición de perfil

### Navbar
- Link "Mi Panel" agregado (desktop + mobile)
- Campana de notificaciones ahora enlaza a `/dashboard/notificaciones`

### SEO — sitemap.xml y robots.txt
- `sitemap.ts` generado dinámicamente: páginas estáticas + blog posts + eventos desde Supabase
- `robots.ts` con reglas de acceso: bloquea /admin, /dashboard, /perfil, /auth
- `metadataBase` agregado a layout.tsx para URLs absolutas
- Build: 27 rutas (antes 25)

### true-project-context
- Carpeta `true-project-context/` creada con contexto consolidado para IA
- `CONTEXT.md` — Visión completa del proyecto (stack, DB, rutas, componentes)
- `SQL.md` — Esquema SQL completo (22 tablas + triggers + RLS + funciones)
- `COMPONENTS.md` — Todos los componentes, rutas, tipos y tokens de diseño

### Asignación Manual de Membresías
- Modal `AssignMembershipModal` para asignar membresías manualmente (pagos por transferencia/efectivo)
- Búsqueda de usuario con autocompletado, selección de beneficiario (usuario o carga)
- Selección de plan existente, ajuste de fecha inicio, método de pago, monto
- Upload de comprobante de transferencia a Supabase Storage
- Registro automático en tabla `payments` (method='transferencia', status='pagado')
- Membresía creada directamente con status='activa'
- Modal de edición de membresías: cambiar `end_date` y `status`
- Cancelación de membresías con confirmación
- Generación de PDF recibo con `@react-pdf/renderer` (nombre, plan, fechas, monto)
- Tab "Membresías" con acciones: Editar, Cancelar, Recibo PDF
- Nombre del beneficiario muestra carga + tutor cuando aplica
- Búsqueda agrupada: cargas aparecen bajo su tutor en buscador de usuarios

### Dashboard Admin — Métricas
- `RevenueChart` — Gráfico de barras de ingresos de los últimos 6 meses (recharts)
- `NewStudentsChart` — Gráfico de área de nuevos alumnos por mes (últimos 12 meses)
- `MembershipBreakdown` — Gráfico donut de membresías activas por plan
- `MonthlyComparison` — Comparación mes actual vs mes anterior (ingresos, nuevos usuarios, membresías, asignaciones)
- `PaymentOverview` — Estado de pagos (pagado/pendiente/rechazado/expirado) con barra de proporción
- StatsCard actualizado con "Ingresos del Mes"
- 8 accesos rápidos en dashboard

### Usuarios — Cargas Agrupadas
- Tabla de usuarios muestra cargas indentadas bajo su tutor
- Cargas muestran "Carga de [tutor]" en vez de email
- Cargas no se pueden editar (solo el tutor)

### Membresías — Beneficiario con Tutor
- Tabla de membresías muestra "Nombre — Carga de tutor" para dependientes
- Query actualizado con join a `dependents.profiles` para obtener nombre del tutor

### Módulo 5 — Blog y Notificaciones
- Blog `/blog` rediseñado como feed de redes sociales (posts inline, no grid de cards)
- Ruta `/blog/[slug]` para publicaciones individuales
- Admin CRUD blog con estados: borrador, programado, publicado
- Admin CRUD notificaciones: aviso, recordatorio, comunicado, correo_masivo
- Campana de notificaciones en Navbar con badge de contador (solo usuarios logueados)

### Navbar Global
- Navbar, FadeUpObserver y ContactModal movidos a root layout (`layout.tsx`)
- Eliminados imports duplicados de estas 3 páginas: landing, nosotros, horarios
- Navbar actualizada con todos los links: Nosotros, Disciplinas, Horarios, Membresías, Tienda, Eventos, Blog

### Membresías desde BD
- Memberships.tsx ahora carga planes desde Supabase `membership_plans` (antes era estático)
- Admin membresías con CRUD de planes + lista de beneficios dinámica

## 2026-07-16

### Módulo 1 — Páginas catálogo
- Ruta `/productos` con grid de productos y filtros por categoría
- Ruta `/eventos` unificada (torneos + ceremonias) con pestañas de filtro
- Redirects: `/torneos` → `/eventos`, `/ceremonias` → `/eventos`
- Componente `EventCard` reutilizable

### Módulo 2 — Panel Admin completo
- AdminGuard: auth guard verificando role_id === 1
- AdminLayout con AdminSidebar (9 links)
- Dashboard admin con 5 stat cards + links rápidos
- CRUD Productos (con `inputMode="numeric"` para evitar bug React 19)
- CRUD Eventos (torneo/graduacion/seminario/clase_especial)
- CRUD Horarios (con selects de disciplina/profesor)
- CRUD Usuarios (vista, cambio de roles, activar/desactivar)
- CRUD Membresías (planes con beneficios dinámicos + vista de membresías)
- CRUD Blog (borrador/programado/publicado)
- CRUD Configuración (edición de settings de la academia)

### Fixes
- FadeUpObserver: removida clase `fade-up` de componentes async-loaded (Memberships, EventCard, Productos, Eventos)
- React 19 controlled `type="number"` inputs: reemplazados con `inputMode="numeric"` en productos, membresías, horarios
- FormModal: overlay `onClick` → `onMouseDown`, escape handler con `useCallback`
- SessionProvider: extendido con `profile`, `isAdmin`, `isStaff`, `refreshProfile()`

## 2026-07-15

### Módulo 0 — Base de datos
- SQL completo ejecutado en Supabase (22+ tablas, RLS, triggers, seed data)
- `profile.ts` corregido para consultar tabla `profiles` (no `users`)
- Interface UserProfile actualizada con todas las columnas

### Auth
- Sistema completo: login, registro, forgot password, email confirmation, password reset
- Middleware protegiendo /dashboard, /perfil, /admin
- Roles: administrador(1), instructor(2), recepcion(3), alumno(4)

## 2026-07-14

### Creado
- Proyecto Next.js 16.2.10 + Tailwind v4 + TypeScript + App Router
- Landing page completa (Hero, IntroSection, Disciplines, Memberships, CTA, Footer)
- Ruta `/horarios` con calendario semanal
- Ruta `/nosotros` con SEO (schema, FAQ, metadata)
- Navbar responsive con mobile menu
- Modal de contacto con ContactModalContext
- Animaciones fade-up

### Diseño
- Tema oscuro Material Design 3
- Fuentes: Anton, Hanken Grotesk, JetBrains Mono
- Iconos: Material Symbols Outlined
- Logo: `public/logo.png` (tamaños: 40px navbar, 80px footer, 144px nosotros)

### Contenido
- Textos en español
- Precios en pesos chilenos (ahora desde BD)
- Horarios Julio 2026 (Lun-Dom)

### SEO
- Title tags optimizados por ruta
- Schema LocalBusiness en /nosotros
- FAQ Schema en /nosotros
- OpenGraph tags
- Keywords targeting local (La Serena)
