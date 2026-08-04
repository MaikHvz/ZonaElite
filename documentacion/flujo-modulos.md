# Flujos y Módulos Completos de la Plataforma (Documentación Técnica)

Este documento detalla **cada módulo** de la aplicación web ZonaElite, su flujo operativo y la estructura de archivos que lo respalda. Funciona como un mapa para comprender todo el ecosistema de código.

---

## 1. Módulo Público (Frontend - Landing y Contenido)
**Propósito**: Portal de acceso para usuarios anónimos, venta de membresías y exposición de contenido.
- **Rutas Principales**:
  - `/` (`src/app/page.tsx`): Landing principal. Agrupa `Hero.tsx`, `IntroSection.tsx`, `Disciplines.tsx`, `Memberships.tsx` (con visualización de membresía destacada PRO), `GalleryCarousel.tsx`, `Philosophy.tsx`, `Lifestyle.tsx`.
    - 🔵 **PLANIFICADO (Clases Personalizadas)**: sección "¿Necesitas Clases Personalizadas?" debajo de las membresías normales, vía `PersonalizedPlans.tsx` (lee `personalized_plans`). Ver requisito citado en la sección 7.
  - `/nosotros` (`src/app/nosotros/page.tsx`): Información sobre la academia.
  - `/horarios` (`src/app/horarios/page.tsx`): Tabla interactiva pública generada dinámicamente desde la BD.
  - `/blog`, `/blog/[slug]`: Motor de blog público leyendo desde la tabla `posts`.
  - `/eventos`, `/eventos/[id]`, `/torneos`, `/ceremonias`: Visualización pública de actividades, torneos y ceremonias.
- **Módulo de Contacto**: `ContactModalContext.tsx` y `ContactModal.tsx` proveen un modal global.
- **UI/UX Global**: `Navbar.tsx`, `Footer.tsx` (inyectados en `src/app/layout.tsx`). Uso intensivo de `FadeUpObserver.tsx` para animaciones en scroll.

---

## 2. Módulo de Autenticación y Perfiles
**Propósito**: Identidad de usuario, gestión de roles y estructuración de dependientes (cargas).
- **Flujo de Registro**:
  1. `src/app/auth/page.tsx`: Pantalla unificada (Login / Registro).
  2. Al crear un usuario en Supabase Auth, se dispara el **Trigger SQL** `handle_new_user()`.
  3. El trigger inserta al usuario en la tabla `profiles` (con `role_id = 4` por defecto) y crea un registro en `beneficiaries` (representando al usuario titular sin un `dependent_id`).
  4. Redirección a `src/app/auth/confirm/page.tsx` tras validación de email.
- **Recuperación**: `src/app/auth/update-password/page.tsx`.
- **Perfiles Propios**: `src/app/perfil/page.tsx` para modificar avatar y datos básicos.

---

## 3. Módulo Dashboard del Alumno (Portal Privado)
**Propósito**: Auto-gestión de membresías, familiares y métricas personales del alumno.
- **Layout Privado**: `src/app/dashboard/layout.tsx` y `DashboardNav.tsx`. Protegido por sesión.
- **Sub-Módulos del Dashboard**:
  - **Resumen (`/dashboard/page.tsx`)**: Muestra `AlertBanner.tsx` si la suscripción va a vencer, y renderiza `QuickStats.tsx` de métricas.
  - **Membresías (`/dashboard/membresias/page.tsx`)**: Consulta y muestra en tiempo real las membresías activas usando `MembershipCard.tsx` y llama a `getRemainingTokens()` para planes limitados.
    - 🔵 **PLANIFICADO (Clases Personalizadas)**: sección "Mis Clases Personalizadas" (cards por beneficiario Yo + cargas) y chip "X clases personalizadas disponibles" en `MembershipCard.tsx`. Ver `contexto/requisitos/clases-personalizadas-modulo-independiente.md`.
  - **Cargas/Dependientes (`/dashboard/cargas/page.tsx`)**:
    - Permite al titular (Tutor) agregar hijos/parejas a través de `AddDependentModal.tsx`.
    - Estos se guardan en la tabla `dependents` y se auto-asignan en la tabla `beneficiaries`.
  - **Fichas Médicas (`/dashboard/cargas/[id]/medico/page.tsx`)**: Utiliza `MedicalInfoCard.tsx` y `EmergencyContactCard.tsx` para hacer *upsert* en la tabla `medical_records` (alergias, lesiones, contactos).
  - **Pagos (`/dashboard/pagos/page.tsx`)**: Lista de transacciones en `PaymentRow.tsx`.
  - **Asistencia (`/dashboard/asistencia/page.tsx`)**: Muestra el porcentaje y listado de clases asistidas mediante `AttendanceSummary.tsx`.
  - **Notificaciones (`/dashboard/notificaciones/page.tsx`)**: Centro de notificaciones (`NotificationItem.tsx`). Consultas ubicadas en `src/lib/supabase/dashboard.ts`.

---

## 4. Módulo de Pagos y E-commerce (Checkout)
**Propósito**: Integración con Flow.cl, carritos de tienda y pagos de membresías/matrículas conjuntas.
- **Flujo de Suscripciones**:
  - `src/components/CheckoutModal.tsx`: El modal captura al beneficiario seleccionado, el plan a comprar, e inyecta la cuota de "Inscripción/Matrícula" (Academia Enrollment) si es requerido.
  - **Iniciador de Pago**: `src/app/api/flow/create-order/route.ts` usa funciones de `src/lib/flow.ts` para crear el payload firmado con HMAC-SHA256 y comunicarse con el Sandbox/Producción de Flow.
  - **Verificador**: `src/app/api/flow/verify/route.ts` retorna el resumen de la compra y despliega el modal emergente `PaymentSuccessModal.tsx` con el desglose del producto, beneficiario, monto y fecha.
- **Manejador Asíncrono (Webhook)**:
  - `src/app/api/flow/confirmation/route.ts`: Captura el HTTP POST automático de Flow (solo manda `token`; la firma `s` se usa en las llamadas a la API, no en el webhook).
  - Se ejecuta en background (`after()` de Next 15+) enviando datos a `confirmAndCreateMembership()` dentro de `src/lib/flow-helpers.ts`.
  - Cancela masivamente (Bulk Update) membresías anteriores para evitar duplicidades, e inserta la nueva fecha de inicio (`getChileToday()`) y fin (`addDaysChile()`).
  - **Integridad del callback (B-007)**: `confirmation` y `verify` descartan el pago si el `commerceOrder` devuelto por Flow no coincide con el guardado en `payments` (`isVerificationOrderMatch`).
  - **Alerta post-pago (B-008)**: si la membresía falla tras el pago, `notifyPaymentWithoutMembership` inserta una notificación `target='staff'` (solo visible para admin/staff) en `notifications`; el reintento manual es `POST /api/flow/force-confirm`.
- **Módulo de Productos (Tienda)**:
  - Públicos: `/productos` y `/productos/[id]`
  - Las transacciones de la tienda operan integradas con Flow generando órdenes distintas a las de las membresías.

---

## 5. Módulo Panel Administrativo (Admin)
**Propósito**: Gestión completa del gimnasio, roles `role_id = 1` (Admin) o `role_id = 2,3` (Staff).
- **Protección y Autenticación**: `AdminGuard.tsx` evita carga en cliente si no eres admin. `src/lib/supabase/admin.ts` invoca `getAdminClient()` usando la *Service Role Key* para bypassear el RLS.
- **Sub-Módulos (Secciones en `/admin`)**:
  - **Dashboard Principal (`/admin/page.tsx`)**: Métricas renderizadas con Recharts. `RevenueChart.tsx` (Ingresos mensuales), `MonthlyComparison.tsx`, `NewStudentsChart.tsx`, `StatsCard.tsx`.
  - **Asistencia y Check-In (`/admin/asistencia/page.tsx`)**: 
    - Llama a `AttendanceOverview.tsx`. 
    - Genera sesiones semanales usando el endpoint `/api/admin/generate-sessions/route.ts`.
    - Sistema de Check-in público (QR) soportado por `src/app/checkin/[sessionId]/page.tsx` y el route handler `/api/checkin/route.ts`.
    - **Inscripción a clases (B-006)**: `EnrollModal.tsx` ya no inserta directo a `class_enrollments`; llama a la RPC transaccional `public.enroll_class` (migración `004`) que valida acceso, membresía/inscripción activas, sesión no pasada y aforo (`CLASS_FULL`) con `SELECT ... FOR UPDATE`. El check cliente queda como UX rápida; la fuente de verdad es la RPC.
  - **Membresías (`/admin/membresias/page.tsx`)**: 
    - CRUD de Planes (tabla `membership_plans`). Permite designar un único plan como Destacado (PRO) con exclusividad garantizada en UI y base de datos.
    - Asignación manual usando `AssignMembershipModal.tsx` (replicando la lógica de cancelación y activación que usa Flow).
    - Emisión de recibos usando `@react-pdf/renderer` en `MembershipReceipt.tsx`.
    - 🔵 **PLANIFICADO (Clases Personalizadas)**: sub-tabs "Planes | Membresías | Personalizadas", botón "Crear Plan Personalizado" y gestión de packs (consumir/cancelar). Ver requisito citado en la sección 7.
  - **Usuarios (`/admin/usuarios/page.tsx`)**: Visor maestro de perfiles, roles y dependientes por usuario usando `DataTable.tsx`. Incluye exportación a Excel con fechas de nacimiento, estado de membresía/inscripción y pestaña especial de gráficos de torta y barras.
  - **Horarios (`/admin/horarios/page.tsx`)**: Interfaz para añadir clases (lunes a domingo, profesor, disciplina). Estos datos alimentan el auto-generador de sesiones y permiten exportar la mallas horaria en formato visual tipo calendario.
  - **Ventas (`/admin/ventas/page.tsx`)**: Panel de métricas transaccionales con exportador de Excel tipo "Cartola" filtrado por Mes, Año e Histórico.
  - **Exportación General a Excel (`src/lib/excel.ts`)**: Motor del cliente basado en `xlsx` (SheetJS) con auto-ajuste de ancho de columnas y soporte para JSON plano o matrices visuales.
  - **Configuración (`/admin/configuracion/page.tsx`)**: Configuración global del sitio, imágenes, y gestión de `GalleryCarousel.tsx` (subidas en `ImageUpload.tsx`).
   - **Creación de Usuarios**: Botón "Crear Usuario" en `/admin/usuarios` que permite al admin crear nuevos usuarios con email, nombre y rol. Genera una contraseña aleatoria que se muestra **una sola vez** al admin. El usuario recibe un correo de bienvenida con sus credenciales vía Resend. La API route `POST /api/admin/create-user` utiliza `supabase.auth.admin.createUser()` con `email_confirm: true` para que el usuario pueda iniciar sesión inmediatamente.
   - **Otros CRUDS**: `/admin/blog`, `/admin/eventos`, `/admin/notificaciones`, `/admin/productos`, `/admin/tipos-clase` (disciplinas). Cada uno usa modales unificados como `FormModal.tsx` y confirmaciones en `DeleteConfirm.tsx`.

---

## 6. Módulos Utilitarios Internos (`src/lib/`)
- **Gestor de Fechas (`src/lib/dates.ts`)**: Impide los bugs de "Salto de Día" en la conversión UTC al forzar la zona horaria chilena (`America/Santiago`) en funciones como `getChileToday()` y `addDaysChile()`. Incluye helpers Chile-aware para límites de mes/trimestre y conversión a instantes UTC: `chileDateToUtc()`, `chileMonthStartDate()`, `chileMonthEndDate()`, `chilePrevMonthStartDate()`, `chilePrevMonthEndDate()`, `chileNextMonthStartDate()`, `chileQuarterStartDate()`, `chileQuarterEndDate()`, `chileMonthsBackStart()`, `chileMonthKey()`. Todos son DST-aware (probe a mediodía UTC) y deben usarse al filtrar columnas DATE (con strings `YYYY-MM-DD`) o TIMESTAMPTZ (con `chileDateToUtc()`).
- **Suite de Pruebas de Producción (`scripts/test-flows.mjs`)**: Test runner standalone (Node 24+, sin toolchain extra) con **131 checks**: límites de zona horaria `America/Santiago`, scan estático de patrones riesgosos (`toISOString().split("T")[0]` y límites de mes), firma HMAC-SHA256 de Flow (create-order + callback) y verificación de `commerceOrder` (B-007), contratos de esquema/RLS (incl. `chile_today()` en policies, RPC `enroll_class` B-006, tokens atados a membresía B-010, RPCs consolidadas B-011, `user_notifications` documentada B-012), ciclo de vida de inscripción (B-004), vencimiento efectivo (B-001/B-009), atomicidad de membresías (B-002) y alerta admin post-pago (B-008). Comando: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs`. Retorna exit 1 si reaparece cualquier bug de fechas o se rompe un contrato.
- **Servicios Admin (`src/lib/admin-helpers.ts`)**: Funciones genéricas compartidas para la validación de operaciones administrativas.
- **Helpers de Flow (`src/lib/flow-helpers.ts` & `src/lib/flow.ts`)**: SDK de pasarela de pago nativo y procesamiento transaccional en base de datos.
- **Supabase Clients (`src/lib/supabase/`)**:
  - `client.ts` (Navegador)
  - `server.ts` (Componentes del Servidor / SSR con cookies)
  - `admin.ts` (Client Service Role para tareas protegidas)
  - `dashboard.ts` (Consultas optimizadas para el dashboard del usuario).

---

## 7. Módulo Clases Personalizadas (🟢 IMPLEMENTADO — v1)

> Estado: **implementado y verificado en producción (2026-08-04)** — sección P en suite (244 tests A–P en verde), `npm run build` OK, migración 009 aplicada y 1:1 confirmada en Supabase, **pago Flow probado end-to-end** (pago `pagado` → pack `activa` con fechas Chile → notificación `approved` → clase visible en la tarjeta de membresía). Detalle completo en `contexto/requisitos/clases-personalizadas-modulo-independiente.md` y plan por fases en `documentacion/plan-clases-personalizadas.md`.

**Propósito**: Compra de packs de clases personalizadas (1 a 1 / grupos pequeños) como entidad **100% desacoplada** de membresías, tokens, inscripciones y check-in.
- **Tablas nuevas**: `personalized_plans` (nombre, precio, clases, vigencia, features) y `personalized_packs` (beneficiario, plan, comprador, pago, fechas Chile-aware, usadas/total, estado `activa/agotada/vencida/cancelada`). Sin índice único de packs activos (N packs en paralelo por beneficiario). RLS packs: `select_own_or_admin` (vía `owns_beneficiary`) + `admin_write`; planes: `select_all` + `admin_write`.
- **Pago Flow**: concepto `Clase Personalizada <name>` — no matchea el regex `/membres[íi]a/i` de los 3 routes, así que nunca crea membresía ni cancela activas. Rama nueva aditiva con helper `confirmPersonalizedPack`:
  - `create-order/route.ts`: acepta `personalizedPlanId` **excluyente** de `planId`/`includeEnrollment`/`enrollmentPlanId` (400 si se combinan); valida plan activo; `totalAmount = price`; concepto `Clase Personalizada <name>`; incluye `beneficiary_id`.
  - `src/lib/flow-helpers.ts` → `confirmPersonalizedPack(supabase, paymentId, userId)`: idempotente por `payment_id`, extrae plan del concepto con `extractPersonalizedPlanName`, resuelve beneficiario (fallback: beneficiario propio del usuario si `payment.beneficiary_id` es null), inserta pack con `start_date = getChileToday()` y `end_date = addDaysChile(start, validity_days)`, `used_classes = 0`, `status = 'activa'`.
  - Rama nueva en los 3 routes (tras `markPaymentAsPaid`): `confirmation`, `verify`, `force-confirm` — detección `/^Clase Personalizad[ao]/i`, setean `assignedSomething`, error → `notifyPaymentWithoutMembership`. Notificación `approved` vía `notifyUserPaymentStatus`.
- **Consumo**: manual desde admin (`used_classes + 1` → `agotada` al llegar al total). Sin QR ni integración con asistencia. Cancelación de pack desde admin.
- **UI**:
  - Admin `admin/membresias`: sub-tabs "Planes | Membresías | Personalizadas". Tab Planes incluye sub-sección "Planes de Clases Personalizadas" (CRUD: nombre, precio, clases, vigencia, features agregables, activo). Tab Personalizadas: filtros Todas/Activas/Agotadas/Vencidas/Canceladas con contadores; acciones Consumir clase y Cancelar Pack (vía `DeleteConfirm` con `confirmLabel`). Estado efectivo derivado: `activa` con `end_date < hoy` → `vencida`.
  - Dashboard `dashboard/membresias`: sección "Mis Clases Personalizadas" (cards por beneficiario Yo + cargas con estado/vigencia/barra usadas-total y botón Comprar) + chip en `MembershipCard` ("X clases personalizadas disponibles" / "agotadas"). `PersonalizedCheckoutModal` (selector de carga + plan + monto, manejo 401/timeout/`already_paid`).
  - Landing (`src/app/page.tsx`): sección **"¿Necesitas Clases Personalizadas?"** debajo de las membresías normales vía `PersonalizedPlans.tsx` (retorna `null` si no hay planes activos).
- **Verificación**: suite sección P (contratos de esquema/RLS, create-order, helper, 3 routes, admin, dashboard, landing) + `npx tsc --noEmit` limpio + `npm run build` OK.

## 8. Clases de Horario para Modalidad Personalizada (🟢 IMPLEMENTADO — v1)

> Estado: **implementado (2026-08-04)**, suite secciones A–Q en verde (295 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Migración `010_personalized_schedule_classes.sql` creada y espejada 1:1 en `documentacion/squema-sql-actualizado.sql`; **pendiente aplicar en Supabase (SQL Editor)**. Requisito en `contexto/requisitos/clases-horario-personalizadas.md`.

**Propósito**: Bloques horarios propios para el plan personalizado (desacoplados de membresías/tokens/check-in QR). Decisiones de diseño (confirmadas con usuario): columna `mode` en `schedules` + tablas propias, reuso de la tabla `attendance` (sin QR), filtro en admin + público + dashboard.

- **Esquema (migración 010)**:
  - `schedules.mode text NOT NULL DEFAULT 'normal'` (`ADD COLUMN IF NOT EXISTS` idempotente) + CHECK `schedules_mode_check IN ('normal','personalizado')` creado vía DO block (ALTER TABLE no soporta IF NOT EXISTS en constraints). Fijado al crear, inmutable al editar.
  - `personalized_schedule_plans(schedule_id FK→schedules CASCADE, plan_id FK→personalized_plans CASCADE)` — planes permitidos; **vacío = todos permitidos**. RLS: select_all + admin_write.
  - `personalized_enrollments(session_id FK→class_sessions CASCADE, beneficiary_id FK→beneficiaries CASCADE, pack_id FK→personalized_packs, UNIQUE(session_id,beneficiary_id))` — **no toca `class_enrollments`**. RLS: select_own_or_admin + admin_write. 4 índices.
  - RPC `enroll_personalized_class(p_session_id uuid, p_beneficiary_ids uuid[])` SECURITY DEFINER **VOLATILE** (a diferencia de `enroll_class` que es STABLE en el repo — aquí se usa la volatilidad semánticamente correcta). Devuelve `{beneficiary_id, success, error_code, error_message}`: lock de sesión `FOR UPDATE` (aforo, patrón B-006), idempotente (ya inscrito → success), autorización (admin u `owns_beneficiary`), restricción de plan permitido (`PLAN_NOT_ALLOWED`), consumo atómico del pack (`UPDATE ... WHERE used_classes < total_classes AND status='activa' AND end_date >= hoy`, `NO_PACK` si no existe, `agotada` al llenarse).
- **Check-in**: `/api/checkin` agrega guarda defensiva — selecciona `schedules(mode)` y devuelve 403 "Las clases personalizadas no usan check-in por QR" si `mode='personalizado'`. Las sesiones personalizadas nunca se activan por QR.
- **Sesiones**: `generate-sessions` itera `schedules.active=true` sin filtrar mode → genera sesiones de personalizadas automáticamente (sin cambios).
- **UI**:
  - Admin `admin/horarios`: doble botón "Nueva Clase Normal / Nueva Clase Personalizada"; `mode` en el formulario (read-only al editar); carga de `personalized_plans` y `personalized_schedule_plans`; sección "Planes permitidos" ramificada (personalizado → `personalized_schedule_plans`, normal → `class_plans`, delete+insert al guardar); columna Modalidad (badge purple/blue); filtros pills Todas|Membresías|Personalizadas; export Excel con columna Modalidad; delete explícito de la tabla de enlace antes de borrar el schedule.
  - Público `horarios`: toggle "Membresías | Personalizadas" (pills) que recarga la grilla filtrando por `mode`; botón Agendar ramifica a `EnrollModal` (normal) o `PersonalizedEnrollModal` (personalizado).
  - `PersonalizedEnrollModal` (nuevo, paralelo a EnrollModal sin tocarlo): sesiones futuras del schedule con cupos (conteo real en `personalized_enrollments`), beneficiarios propios/dependientes con pack activo, elegibilidad con restricción de plan permitido, estado por sesión (cupos/llena/inscrito), llama `enroll_personalized_class`, texto "consume 1 clase del pack".
  - Dashboard `dashboard/membresias`: sección "Próximas Clases Personalizadas" — cards por schedule con día/hora/sala, próxima sesión con cupos o "Inscrito" (según enrolamiento del usuario), botón Agendar → `PersonalizedEnrollModal`.
  - Admin `admin/asistencia`: badge "Personalizada" en la sesión; sin QR (se bloquea activación, no inicia polling, aviso de registro manual); `getAttendanceForSession` ramificado (personalizadas leen `personalized_enrollments`); al cerrar sesión los ausentes se calculan desde `personalized_enrollments`; modal "Inscribir" ramificado (personalizadas buscan packs vía `getEligibility` y llaman el RPC; etiquetas "clases"/"Sin pack").
- **Asistencia**: reuso de `attendance` (neutral, UNIQUE session_id+beneficiary_id) → métricas/export de `AttendanceOverview` suman personalizadas sin cambios.
- **Verificación**: suite sección Q (contratos migración 010 + espejo de esquema, guarda checkin, admin horarios, modal, público, dashboard, asistencia, regresión de `enroll_class`/`EnrollModal`) + `tsc` + `build`.
