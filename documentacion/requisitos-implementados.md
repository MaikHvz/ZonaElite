# Requisitos Implementados (Escaneo Completo)

Este documento contiene un desglose exhaustivo de los requisitos de negocio y funcionales que están implementados y operativos en el sistema ZonaElite. Todos los módulos técnicos mencionados en `flujo-modulos.md` convergen para satisfacer estos requisitos.

---

## 1. Venta Cruzada de Planes (Matrícula + Mensualidad)
**Requisito**: Permitir que un alumno pague la mensualidad y, en la misma transacción, asocie un plan de inscripción base a la academia (matrícula).
- **Implementación**:
  - `CheckoutModal.tsx` contiene un `Switch` (Toggle) para "Incluir inscripción anual/semestral". Si se activa, envía un parámetro booleano al servidor.
  - `src/app/api/flow/create-order/route.ts` recibe el request, suma el precio del `membership_plan` con el del `enrollment_plan` y genera el concepto consolidado ("Membresía X + Inscripción Y").
  - Al confirmarse (`confirmation/route.ts`), la función `confirmAndCreateMembership()` en `src/lib/flow-helpers.ts` extrae ambos ítems. Llama a `extendEnrollment()` para crear/actualizar la inscripción del usuario, y luego asigna la membresía normalmente.

## 2. Prevención de Multi-Membresías "Zombie"
**Requisito**: Un alumno solo debe tener 1 membresía activa a la vez por lógica de negocio. Si compra una nueva antes de que la vieja expire, la vieja se cancela inmediatamente (es "pisada").
- **Implementación**:
  - Se eliminaron las lógicas de `.maybeSingle()` que generaban caídas de BD por error de múltiples resultados cuando había una cuenta corrupta.
  - En `flow-helpers.ts` y en `AssignMembershipModal.tsx`, se efectúa una **actualización masiva** o *Bulk Update* a la tabla `memberships`:
    ```typescript
    await supabase.from("memberships").update({ status: "cancelada" })
      .eq("beneficiary_id", targetBeneficiaryId).eq("status", "activa");
    ```
  - Esto asegura que el beneficiario entre al nuevo plan con un historial limpio y una única membresía activa, descartando cobros o tiempos superpuestos.

## 3. Control Exhaustivo de Tokens y Asistencia
**Requisito**: Soporte a membresías limitadas (ej. 8 o 12 clases por mes). Cuando el profesor marca presente o ausente, descuenta; cuando marca justificado, no descuenta.
- **Implementación**:
  - Toda la matemática recae en la función RPC de Supabase `get_remaining_tokens` (Ubicada en la BD, respaldada en `contexto/migrations/001_add_tokens_to_membership_plans.sql`).
  - Resta la suma de los conteos de `class_enrollments` en ese rango, y suma de vuelta los registros marcados con `status = 'justificado'` en la tabla `attendance`.
  - **Filtro del Mismo Día**: Si un alumno asiste a las 10:00 y renueva su membresía a las 11:00, la función valida `ce.enrolled_at >= v_created_at`. De este modo, no descuenta a la membresía nueva la clase que tomó con la membresía antigua, impidiendo fugas (empezar con "una clase menos").
  - **Uso Frontend**: `MembershipCard.tsx` obtiene este número y muestra gráficamente (barras) la proporción de tokens consumidos sobre el total.

## 4. Gestión de Cargas / Familiares Multicuenta
**Requisito**: Un padre puede inscribirse, pagar por él, pagar por sus dos hijos usando la misma tarjeta de crédito, y tener el control estadístico de cada uno por separado.
- **Implementación**:
  - El sistema de Auth enlaza a la tabla `profiles`. 
  - La tabla transaccional es `beneficiaries`. Cada `profile_id` (Padre) puede insertar en `dependents` los datos del hijo, lo que autogenera un `beneficiary_id` distinto.
  - Al realizar un pago en `CheckoutModal.tsx`, el usuario elige en un Dropdown a quién comprarle la membresía.
  - El perfil médico (`MedicalInfoCard.tsx`) aísla la tabla `medical_records` utilizando el `beneficiary_id`, de modo que el padre y el hijo no se mezclan.

## 5. Prevención de Bugs Horarios (Timezone GMT-4)
**Requisito**: Solucionar el "Salto de Fecha" que ocurría porque los servidores UTC cerraban el día chileno a las 20:00 hrs o 21:00 hrs según la estación, expirando membresías antes de tiempo.
- **Implementación**:
  - Eliminación de todas las referencias directas a `new Date().toISOString().split("T")[0]` en toda la lógica de servidor y cliente.
  - Centralización en `src/lib/dates.ts` usando la API `Intl.DateTimeFormat` configurada en `"es-CL"` y `"America/Santiago"`.
  - Las funciones `getChileToday()` y `addDaysChile(fecha, dias)` garantizan que si se renueva a las 23:59 hrs en Chile, en BD se inserte la fecha correcta correspondiente a Chile y no "mañana" (UTC).
- **Auditoría 2026-08 (Escaneo Exhaustivo)**:
  - Se eliminaron los últimos 20 usos de patrones riesgosos que quedaban en paneles admin y dashboard: límites de mes/trimestre calculados con `new Date(y, m, 1).toISOString()` (corría el corte 3-4h y filtraba pagos de las últimas horas del mes anterior) y `.split("T")[0]` sobre columnas DATE (off-by-one en `session_date`/`event_date`).
  - Fixes aplicados en: `admin/page.tsx`, `admin/usuarios/page.tsx`, `admin/asistencia/page.tsx`, `admin/ventas` (charts `RevenueChart.tsx`, `NewStudentsChart.tsx`, `MonthlyComparison.tsx`), `AttendanceOverview.tsx`, `src/lib/supabase/dashboard.ts`, `AssignMembershipModal.tsx`, `flow-helpers.ts`.
  - `generate-sessions/route.ts` ahora genera las sesiones iterando fechas chilenas reales (`getChileToday()`/`addDaysChile()`) en vez de `new Date()` del servidor, y obtiene el `day_of_week` de cada fecha calendario (independiente de zona horaria).
  - El bucket de gráficos por mes usa `chileMonthKey()` (asigna cada pago al mes chileno real, no al mes UTC).
  - Todos los fixes están protegidos por la suite `scripts/test-flows.mjs` (Sección 12).

## 6. Panel Administrativo a Medida
**Requisito**: Un sistema integral para manejar usuarios, roles, creación y listado de horarios y la gestión del contenido público. Todo con permisos estructurados.
- **Implementación**:
  - Seguridad provista por `AdminGuard.tsx` para interceptar a todo aquel que no sea `role_id=1` (Administrador) o staff.
  - **Módulo de Asistencia**: Interfaz (`AttendanceOverview.tsx` y `AsistenciaRow.tsx`) para la asistencia manual o mediante un auto-generador de sesiones basado en la tabla semanal `schedules`.
  - **Asignación Manual**: Componente `AssignMembershipModal.tsx` capaz de insertar un pago manual ignorando Flow.cl, aplicando la lógica correcta de cancelación y fechas chilenas. Emisión de comprobantes internos a PDF con `MembershipReceipt.tsx`.
  - **Gráficos Dinámicos**: Dashboard (`/admin/page.tsx`) alimentado con la librería **Recharts**, filtrando pagos completados (`status = 'pagado'`) para crear comparativas mensuales automáticas.

## 7. Escalabilidad y Componentes de Landing Dinámicos
**Requisito**: El frontend debe ser altamente estético (UI Dark, Material) y estar totalmente enlazado a lo transaccional, no siendo solo visual.
- **Implementación**:
  - `Memberships.tsx` hace solicitudes asíncronas para obtener los `membership_plans` desde BD y renderizarlos en tarjetas tridimensionales (Glassmorphism).
  - Las animaciones con `FadeUpObserver.tsx` no bloquean el Render Cycle porque se cargan estrictamente con la API de "Intersection Observer" una vez la UI está lista en cliente.
  - Motor de Blog e interfaz de Torneos/Ceremonias integrado directamente en el Next.js App Router (rutas estáticas paramétricas `/blog/[slug]`), listo para ser posicionado en buscadores con Meta Datos (`sitemap.ts` y `robots.ts` presentes en raíz).

## 8. Membresía Destacada (PRO)
**Requisito**: Desde el panel de administración, se debe poder marcar un plan de membresía como destacado (PRO), el cual debe tener exclusividad absoluta (solo 1 destacado a la vez) y presentarse en la landing con un diseño prismático especial centrado en la cuadrícula.
- **Implementación**:
  - Se agregó la columna `featured` (BOOLEAN) a la tabla `membership_plans` en Supabase, resguardada con un `UNIQUE INDEX ... WHERE (featured = TRUE)`.
  - El modal de edición del Admin Panel (`admin/membresias/page.tsx`) gestiona el estado a través de la función `handleSetFeatured`, que ejecuta un "bulk update" desmarcando todos los previos antes de marcar el nuevo.
  - La UI en la landing page (`Memberships.tsx`) reorganiza el arreglo de planes para situar el `featuredPlan` en el índice central del grid. Inyecta keyframes en línea (`@keyframes prismatic-shift`, `diamond-pulse`) aplicando sombras, gradientes (League of Legends Prismatic) y un badge "⬡ PRO" sobre el componente.

## 9. Exportación a Excel Avanzada en Paneles Administrativos
**Requisito**: Permitir la descarga de reportes Excel (.xlsx) directamente desde el navegador en los paneles de Ventas, Usuarios, Horarios y Asistencia con filtros temporales y formatos visuales/estadísticos.
- **Implementación**:
  - **Motor Global (`src/lib/excel.ts`)**: Implementa `SheetJS` (xlsx) con autofit inteligente (`!cols`) para formatear texto y arreglos matriciales.
  - **Panel de Ventas (`admin/ventas/page.tsx`)**: Genera "Cartola" de ingresos totales, desglose por método de pago y listado detallado filtrable por Mes, Año e Histórico.
  - **Panel de Usuarios (`admin/usuarios/page.tsx`)**: Cruza la información de perfiles y cargas (`dependents`) con `memberships` y `academy_enrollments`. Diferencia explícitamente la `Fecha Nacimiento` (`birth_date`) de la `Fecha Registro Ingreso` (`created_at`). Genera además la hoja "Tablas para Gráficos" con matrices estructuradas listas para renderizar gráficos de torta y barras en Excel.
  - **Panel de Horarios (`admin/horarios/page.tsx`)**: Mapea la grilla semanal (Lunes a Domingo) en una matriz visual horizontal con bloques horarios.
  - **Panel de Asistencia (`admin/asistencia/page.tsx`)**: Genera el reporte mensual con tasa de asistencia, presentes, ausentes y justificados.

## 10. Creación de Usuarios por Administrador
**Requisito**: El administrador debe poder crear nuevos usuarios directamente desde el panel admin, con contraseña auto-generada visible una sola vez, y envío de correo de bienvenida con credenciales.
- **Implementación**:
  - Botón "Crear Usuario" en `/admin/usuarios` que abre un modal con email, nombre y rol.
  - `POST /api/admin/create-user` (server-only, usa `getAdminClient()`):
    1. Verifica que el usuario logueado sea admin (`role_id=1`)
    2. Genera contraseña aleatoria de 12 caracteres via `crypto.randomBytes()`
    3. Crea el Auth user con `supabase.auth.admin.createUser()` y `email_confirm: true`
    4. El trigger `handle_new_user()` crea `profiles` automáticamente
    5. Si el rol elegido no es `alumno`, actualiza `profiles.role_id`
    6. Crea `beneficiaries` si el trigger no lo hizo
    7. Envía email de bienvenida vía Resend con las credenciales
    8. Registra en `audit_logs`
  - Modal de resultado muestra la contraseña con botón "Copiar" y advertencia de que solo se ve una vez
  - El usuario puede iniciar sesión inmediatamente sin confirmar email
  - Archivos: `src/app/api/admin/create-user/route.ts`, `src/lib/email.ts`

## 11. Pop-up Modal de Confirmación de Pago Exitoso
**Requisito**: Al completar exitosamente un pago o compra, la plataforma debe desplegar un modal emergente (Pop-up) con animaciones y un desglose detallado de lo obtenido.
- **Implementación**:
  - `src/components/PaymentSuccessModal.tsx`: Modal flotante responsivo con estética Glassmorphism, animaciones de éxito y tarjeta resumen de la transacción.
  - Muestra el **Concepto Adquirido** (ej: Membresía Adulto / Inscripción), **Beneficiario**, **Monto Pagado** ($XX.XXX CLP), **Fecha** y **N° de Orden**.
  - `src/app/api/flow/verify/route.ts`: Retorna los detalles del pago de la BD para alimentar dinámicamente el modal.
  - Integrado automáticamente en la experiencia del usuario tras retornar de Flow.cl en `/dashboard/pagos`.

## 12. Escaneo Exhaustivo y Suite de Pruebas de Producción
**Requisito**: Correr una auditoría de flujos (zonas horarias, pagos Flow, RLS, inscripción per-session) con un script de pruebas aparte, con testing realista de producción.
- **Implementación**:
  - `scripts/test-flows.mjs`: Suite standalone (Node 24+, sin dependencias) con **110 checks**:
    1. **Zona horaria**: demuestra los bugs UTC vs Chile (instante 02:00Z es 22:00 del día anterior en Chile), valida límite de mes correcto (`04:00Z` invierno / `03:00Z` verano), detecta las 2 transiciones DST 2026 y valida `addDaysChile()` cruzando DST.
    2. **Scan estático**: recorre `src/` y falla (exit 1) si reaparecen `toISOString().split("T")[0]` o `new Date(y,m,1).toISOString()`.
    3. **Firma HMAC-SHA256 de Flow**: determinismo, sensibilidad a monto/secret, validación real de `verifyFlowCallbackSignature()`, y **B-007** verificación de `commerceOrder` (helper `isVerificationOrderMatch` + scans de `confirmation/route.ts` y `verify/route.ts`).
    4. **Contratos de esquema/RLS**: columnas `payments.include_enrollment`/`enrollment_plan_id`, policies de `class_enrollments` con `chile_today()`, UNIQUE per-session, y guards de membresía en `/api/checkin`.
    5. **Ciclo de vida de inscripción**: `extendEnrollment` (base = max(end_date, hoy) + duración) y modelo per-session (`session_id` como clave).
    6. **Vencimiento efectivo (B-001/B-009)**: `effectiveMembershipStatus`/`daysRemaining` DST-safe y que `MembershipCard`/`AlertBanner`/página usen el estado efectivo, no el literal.
    7. **Atomicidad (B-002/B-015)**: mock con índice único parcial → 2 confirmaciones paralelas terminan en 1 sola membresía activa; **B-008** alerta admin (`notifyPaymentWithoutMembership`) con mock de `notifications`.
  - **Comando**: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs`
- **Hallazgos de seguridad (pendientes de decisión, sin cambios de BD aplicados)**:
  1. RLS `academy_enrollments.user_insert_enrollment_flow` permite a un usuario autenticado insertar su propia inscripción sin pago.
  2. RLS `class_enrollments_insert_qr_walkin` y `attendance_insert_own_beneficiary` permiten auto-inscripción/auto-asistencia directa por API; los endpoints (`/api/checkin`) ya las validan con el client admin, pero conviene restringirlas a admin/staff.
  3. UNIQUE legacy `(beneficiary_id, schedule_id)` sigue presente junto al nuevo `(beneficiary_id, session_id)`; las inscripciones antiguas con solo `schedule_id` no matchean en el check-in por `session_id`.

## 13. Corrección de Flujos Críticos de Producción (Fases 1–9, auditoría 2026-08)
**Requisito**: Corregir los bugs críticos del informe `contexto/informe-bugs.md` priorizando los flujos de membresía post-pago, vencimiento/renovación, inscripciones y pagos Flow, con una fase a la vez y verificación (tests + build) antes de avanzar.
- **Implementación por fase** (detalle en `contexto/requisitos/plan-fixes-produccion.md`):
  1. **Fase 1 (B-001, B-003, B-009) — Vencimiento dinámico**: módulo `src/lib/membership-status.ts` (`effectiveMembershipStatus`/`isMembershipExpired`/`daysRemaining` DST-safe). `MembershipCard`, `AlertBanner`, `dashboard/membresias` y `getDashboardSummary` derivan el estado de `end_date < getChileToday()` y no del literal `status='vencida'`. Botón "Renovar" ahora enlaza a `/#membresias` (sección de compra), no a WhatsApp.
  2. **Fase 2 (B-002, B-015) — Atomicidad**: migración `002_unique_active_membership.sql` (índice único parcial `WHERE status='activa'` + dedupe conservando la más reciente + backfill de vencidas). `flow-helpers.ts` captura SQLSTATE 23505 con retry idempotente. `AssignMembershipModal` recarga ante 23505.
  3. **Fase 3 (B-005) — Fecha chilena en RLS**: migración `003_chile_today_rls.sql` con `public.chile_today()` (`timezone('America/Santiago', now())::date`) y policy `class_enrollments_insert_admin_or_self` regenerada. Aplicada en Supabase.
  4. **Fase 4 (B-004) — Dedup de inscripciones**: helper `src/lib/enrollments.ts` (`extendOrCreateEnrollment`): si hay inscripción activa la extiende desde `max(end_date, hoy)`, si no crea con `getChileToday()`/`addDaysChile()`. `handleAssign` del admin y `extendEnrollment` de flow-helpers delegan en él.
  5. **Fase 5 (B-007) — Integridad del callback Flow**: doc oficial de Flow confirma que el callback solo manda `token` (no `s`). Se agregó `isVerificationOrderMatch` (`flow-helpers.ts`): `confirmation/route.ts` y `verify/route.ts` descartan el pago si el `commerceOrder` devuelto por Flow no coincide con el guardado en `payments`.
  6. **Fase 6 (B-008) — Alerta post-pago**: `notifyPaymentWithoutMembership` (`flow-helpers.ts`): si la membresía no se crea tras un pago pagado, inserta `notifications` (`type='sistema'`, `target='staff'`, content con `payment_id`/`error`, `sent_by` = primer admin) en los 3 handlers (`confirmation`, `verify`, `force-confirm`). El reintento manual sigue siendo `force-confirm`.
  7. **Fase 7 (B-006) — Capacidad de clase server-side**: RPC transaccional `public.enroll_class` (migración `004_enroll_class_rpc.sql`, aplicada) con `SELECT ... FOR UPDATE` sobre la sesión: valida sesión no pasada (`session_date >= chile_today()`, sin exigir `status='activa'` para permitir inscripción anticipada), acceso, membresía e inscripción de academia activas, aforo (`CLASS_FULL`) e idempotencia. `EnrollModal` reemplazó el insert directo por la RPC y muestra el error de la BD.
  8. **Fase 8 (B-010, B-011) — Tokens atados a la membresía**: migración `005_tokens_membership_window.sql` (aplicada): `get_remaining_tokens` sigue siendo dinámico pero cada reserva queda atada a la membresía por `enrolled_at ∈ [created_at, end_date]` (límite superior nuevo en `v_consumed` y `v_justified`). B-011: eliminadas las RPCs duplicadas del esquema (1 sola definición de `get_remaining_tokens` y `get_enrollment_debt`).
  9. **Fase 9 (B-012) — Esquema en espejo**: DDL de `user_notifications` agregado al esquema documentado, verificado contra la BD real vía OpenAPI/PostgREST (`id uuid PK`, `user_id uuid`, `title text`, `content text`, `read boolean DEFAULT false`, `created_at timestamptz`).
- **Migraciones creadas**: `002_unique_active_membership.sql` (aplicada), `003_chile_today_rls.sql` (aplicada), `004_enroll_class_rpc.sql` (aplicada), `005_tokens_membership_window.sql` (aplicada). Esquema documentado sincronizado (`squema-sql-actualizado.sql`).
- **Estado**: Fases 1–9 completadas. Suite en verde (131 tests), build OK. Pendientes de negocio (Fase 10): RLS `user_insert_enrollment_flow`/QR walk-in/auto-asistencia y constraint UNIQUE legacy.


