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

## 14. Clases de Horario para Modalidad Personalizada (2026-08-04)
**Requisito**: Habilitar bloques horarios propios para el plan personalizado (`mode` en `schedules`), desacoplados de membresías, tokens y check-in QR, con CRUD en admin, filtro en admin + público + dashboard, inscripción restringida a packs activos y asistencia reutilizando la tabla `attendance`.
- **Decisiones de diseño (confirmadas con el usuario)**: 1) columna `mode` en `schedules` + tablas propias (`personalized_schedule_plans`, `personalized_enrollments`) + RPC `enroll_personalized_class`; 2) reuso de asistencia existente, sin QR; 3) filtro en admin + público `/horarios` + dashboard.
- **Migración**: `contexto/migrations/010_personalized_schedule_classes.sql` (creada; **pendiente aplicar en Supabase**). Espejo 1:1 en `documentacion/squema-sql-actualizado.sql`.
- **Componentes**: `PersonalizedEnrollModal.tsx` (nuevo); `admin/horarios`, `admin/asistencia`, `horarios` público, `dashboard/membresias`, `src/lib/supabase/dashboard.ts` (getUpcomingSessions/getAttendanceForSession con `mode`), guarda 403 en `/api/checkin`.
- **Estado**: Implementado. Suite secciones A–Q en verde (295 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/clases-horario-personalizadas.md`, plan por fases en `documentacion/plan-clases-horario-personalizadas.md`.

## 15. Desinscripción de Usuario en Asistencia con Devolución de Token (2026-08-07)
**Requisito**: Poder eliminar desde `/admin/asistencia` a un beneficiario que se inscribió por error en una sesión, devolviendo automáticamente el token/clase consumido (devolución real), limpiando la deuda pendiente y la asistencia marcada, y notificando al titular.
- **Implementación**:
  - RPC `cancel_class_enrollment(p_session_id, p_beneficiary_id)` (migración `011_cancel_class_enrollment.sql`, SECURITY DEFINER): valida `is_admin()`, resuelve la sesión y el titular; en modalidad normal borra `class_enrollments` (por sesión u horario recurrente) y la deuda `pendiente` de la sesión → `get_remaining_tokens` recalcula y devuelve el token solo; en modalidad personalizada restaura 1 clase al pack (`used_classes-1`, `status='activa'`); limpia `attendance` y notifica vía `user_notifications`.
  - UI en `admin/asistencia`: botón `person_remove` por fila + modal de confirmación "Desinscribir a {nombre}" con aviso de devolución; al confirmar recarga la lista sin colapsar la sesión.
  - No requiere policies DELETE nuevas (`class_enrollments_delete_admin` ya existía; el resto va dentro del RPC).
- **Migración**: `contexto/migrations/011_cancel_class_enrollment.sql` (creada; **pendiente aplicar en Supabase**). Espejo 1:1 en `documentacion/squema-sql-actualizado.sql`.
- **Estado**: Implementado. Suite secciones A–R en verde (310 tests), `npx tsc --noEmit` limpio. Requisito/detalle en `contexto/requisitos/eliminar-usuario-asistencia.md`.

## 16. Changelog de Desarrolladores en Panel Admin (2026-08-07)
**Requisito**: Incorporar a la sección Admin un changelog de desarrolladores muy resumido y versionado, para que el administrador conozca los nuevos cambios realizados, visible solo desde el panel admin.
- **Implementación**:
  - Tabla `changelog` (migración `012_changelog.sql`): `id uuid PK`, `version text UNIQUE`, `title text`, `summary text`, `created_at timestamptz DEFAULT now()`. RLS habilitada con una única policy `changelog_admin_read` (`FOR SELECT USING (is_admin())`) → solo el administrador lee; la escritura va por service role / SQL Editor.
  - Seed idempotente **v1.0.0** que resume el sprint: vista de membresías rediseñada, botón "Desinscribir" en asistencia con devolución de token/clase, y disciplinas con descripción desplegable con transición suave.
  - Página `admin/changelog` (solo lectura): tarjetas por versión con badge, título, resumen y fecha. Link "Changelog" en el sidebar admin (icono `update`).
  - Convención: cada feature nueva agrega una entrada de changelog vía SQL seed/migración (regla IA #20 de BRAIN).
- **Migración**: `contexto/migrations/012_changelog.sql` (creada; **pendiente aplicar en Supabase**). Espejo 1:1 en `documentacion/squema-sql-actualizado.sql`.
- **Estado**: Implementado. Suite secciones A–S en verde, `npx tsc --noEmit` limpio. Requisito/detalle en `contexto/requisitos/changelog-admin.md`.



## 17. Pago Manual por Transferencia (2026-08-08)
**Requisito**: Modo de pago manual por transferencia como alternativa a Flow.cl, activable por tipo de producto (Membres�as / Clases Personalizadas / Inscripciones). Cuando un tipo est� en modo manual, el checkout no inicia Flow: muestra los datos bancarios de la academia y un formulario para que el usuario suba el comprobante (voucher). El admin recibe correo + notificaci�n in-app, revisa el voucher en `/admin/ventas` (tab "Solicitudes") y aprueba o rechaza la solicitud; al aprobar se asigna el beneficio (sustituci�n de membres�a activa / apilamiento de packs / extensi�n de inscripci�n), al rechazar queda `rechazado` con nota visible.
- **Implementaci�n**:
  - `academy_settings.payment_settings` jsonb (migraci�n `013_manual_payment_mode.sql`): `{ memberships, personalized, enrollment }` cada uno `"online"|"manual"` + `bank` (datos bancarios). Librer�a isom�rfica `src/lib/payment-settings.ts`. UI de toggle por tipo + datos bancarios en `admin/configuracion`.
  - `payments` + `membership_plan_id`, `personalized_plan_id`, `reviewed_by`, `reviewed_at`, `admin_note`; `profiles.rut` nullable; 4 �ndices nuevos (incl. parcial `idx_payments_manual_pending`).
  - `POST /api/payments/transfer`: valida modo manual + banco + voucher (JPG/PNG/WebP/GIF/PDF =5MB) + beneficiario + plan/monto; sube voucher a `public/vouchers`, inserta `payments` `method='transferencia'` `status='pendiente'` `commerce_order='REF-ZE-xxxxxx'`; notifica staff + `sendTransferRequestEmail` a todos los admins (enlaza voucher, no adjunta).
  - `POST /api/payments/review`: solo admin; rechazo ? `rechazado` + `admin_note` + notificaci�n; aprobaci�n ? guard de concurrencia `UPDATE ... WHERE status='pendiente'`, marca `pagado` (tambi�n persiste `admin_note` si el admin dej� nota, aunque el pago est� OK) y asigna con `createMembershipForPayment`/`confirmPersonalizedPack` (override de plan) o `extendEnrollment`.
  - Guarda en `create-order`: tipo en `manual` ? 400 "El pago online est� desactivado para este producto. Usa transferencia."
  - UI cliente: `TransferPaymentStep` (datos bancarios + copiar, RUT autocargado, upload voucher, estado enviado) integrado en `CheckoutModal` y `PersonalizedCheckoutModal` (bot�n "Pagar por transferencia"); `PaymentRow` muestra "En revisi�n" + referencia + nota (roja en rechazados, verde en aprobados con nota).
  - UI admin: tab "Solicitudes" en `admin/ventas` con badge de pendientes, filtros, modal de revisi�n con voucher (img/iframe PDF) y aprobar/rechazar; la nota se muestra en aprobadas y rechazadas; tras revisar se muestra un toast de confirmaci�n. El label del modal aclara que la nota es "visible para el usuario".
  - Perfil: campo RUT (state, load, save).
- **Migraci�n**: `contexto/migrations/013_manual_payment_mode.sql` (creada; **pendiente aplicar en Supabase**). Espejo 1:1 en `documentacion/squema-sql-actualizado.sql`.
- **Estado**: Implementado. Suite secciones A-X en verde (469 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/pago-manual-transferencia.md`.

## 18. Crear y Asignar Carga desde Panel Admin (2026-08-08)
**Requisito**: El administrador debe poder crear una carga (hijo/familiar) y asignarla a un usuario (profile padre) directamente desde `/admin/usuarios`, con todos sus datos (nombre, RUT, fecha de nacimiento, categoría), comportándose igual que una carga creada por el propio usuario.
- **Implementación**:
  - Botón "Crear y Asignar Carga" en `/admin/usuarios` → `CreateDependentModal` (`src/components/admin/CreateDependentModal.tsx`) con selector del usuario tutor (padre/madre) + campos `full_name`, `rut`, `birth_date`, `category`.
  - `POST /api/admin/create-dependent` (server-only, admin client, patrón de `create-user`): valida sesión/rol/categoría, inserta en `dependents` (con `tutor_id` del profile seleccionado) y **asegura** el registro en `beneficiaries` con `dependent_id` (idempotente: select previo por `dependent_id`, insert si no existe) para que la carga quede usable en checkout/membresías. Registra en `audit_logs`.
  - `POST /api/admin/update-dependent`: edita los datos de una carga existente desde la tabla (el `onEdit` de filas dependientes ya no retorna temprano).
  - `beneficiaries` no tiene policy INSERT para browser client (solo SELECT), por eso la creación/beneficiary va por API con admin client.
- **Estado**: Implementado. Suite secciones A-V en verde (443 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/crear-carga-admin.md`. Sin cambios de esquema (no requiere migración).

## 19. Editar Cargas desde el Dashboard con Validación de RUT (2026-08-08)
**Requisito**: El usuario (tutor) debe poder editar los datos de sus cargas desde `/dashboard/cargas` (nombre, RUT, fecha de nacimiento, categoría), y el RUT debe validarse con el formato chileno real (dígito verificador módulo 11).
- **Implementación**:
  - Helper isomórfico `src/lib/rut.ts`: `normalizeRut` (limpia puntos/guiones/espacios, `k`→`K`), `isValidRut` (cuerpo 1–8 dígitos en rango 1.000.000–25.000.000, DV `[0-9K]`, algoritmo módulo 11), `formatRut` (`12.345.678-9`).
  - `EditDependentModal.tsx` (dashboard): edita la carga con `dependents.update(...).eq("id", dependent.id)` vía browser client (RLS `dependents_update_own_or_admin` permite; sin API server). Botón "Editar datos" en `DependentCard`, wiring en `cargas/page.tsx`.
  - La validación de RUT aplica también al **agregar** carga (`AddDependentModal`) y en el modal admin (`CreateDependentModal`) — si el RUT no está vacío debe pasar `isValidRut`, si no muestra error inline.
- **Estado**: Implementado. Suite secciones A-W en verde (458 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/editar-cargas-dashboard.md`. Sin cambios de esquema (no requiere migración).

## 20. Nota de Revisión Visible en Aprobaciones + Más Feedback (2026-08-08)
**Requisito**: El administrador puede dejar una nota al aprobar un pago por transferencia aunque todo esté en orden; la nota debe guardarse y el usuario debe verla en pagos exactamente igual que en un rechazo. Además, más feedback para usuario y admin (toast de confirmación en la revisión, nota visible en aprobadas/rechazadas, notificación in-app y correo con la nota).
- **Implementación**:
  - `POST /api/payments/review`: en la **aprobación** también se persiste `admin_note` (UPDATE del guard con `admin_note: adminNote || null`). La nota se pasa a `notifyUserPaymentStatus(..., adminNote)` y a `notifyTransferReviewEmail(..., adminNote)` en **ambos** outcomes.
  - `notifyUserPaymentStatus` (`flow-helpers.ts`) acepta `adminNote?: string` opcional y lo agrega al content de la notificación ("Nota del administrador: ..."); las llamadas existentes no lo pasan → backward-compatible.
  - `sendTransferReviewEmail` (`email.ts`) muestra la nota en aprobación **y** rechazo, con label según outcome: "Nota del administrador" (verde) o "Motivo del rechazo" (rojo).
  - `admin/ventas`: label del modal "Nota (opcional, visible para el usuario)"; `SolicitudesSection` muestra la nota en aprobadas (verde) y rechazadas (rojo); tras revisar aparece un **toast** de éxito ("Solicitud aprobada y pago registrado…" / "Solicitud rechazada…") con el componente `Toast`.
  - `TransferRequestsPanel` (usuario): caja verde "Nota del administrador" cuando la solicitud aprobada tiene `admin_note`; caja roja "Motivo del rechazo" para rechazos.
  - `PaymentRow` (`/dashboard/pagos`): muestra la nota también en `pagado` (verde, "Nota: …") además del rechazado (rojo).
- **Estado**: Implementado. Suite secciones A-X en verde (469 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/nota-aprobaciones-feedback.md`. Sin cambios de esquema (no requiere migración); changelog `017_changelog_v1_2_0.sql` creado (pendiente aplicar junto con 013/014/015/016).

## 21. Dirección en Perfil y Cargas (2026-08-09)
**Requisito**: El perfil del tutor puede registrar su dirección; las cargas (niño/adulto) también tienen dirección, con un checkbox "Usar la misma dirección que el tutor" que autocompleta desde el perfil, tanto en el dashboard del usuario como en el panel de administración. La tarjeta de cada carga muestra su dirección.
- **Implementación**:
  - Esquema: migración `018_address_dependents_profiles.sql` (idempotente, `ADD COLUMN IF NOT EXISTS`) agrega `profiles.address text` y `dependents.address text` (nullable). Sin cambios de RLS: los policies `own_or_admin` existentes cubren la columna nueva.
  - `src/lib/supabase/dashboard.ts`: `DependentData.address: string | null`, `getProfileForEdit` (select + retorno con `address`), `updateProfile` acepta `address`, y `getUserMemberships`/`getUserDependents` incluyen `address` en dependents.
  - `/perfil/page.tsx`: campo "Dirección" (state, carga desde `getProfileForEdit`, se guarda en `updateProfile`).
  - `AddDependentModal.tsx`/`EditDependentModal.tsx` (dashboard): campo dirección + checkbox "Usar la misma dirección que el tutor" que autocompleta desde `profiles.address` del tutor (query browser client); insert/update con `address: address.trim() || null`.
  - `DependentCard.tsx`: muestra "Dirección" cuando `dependent.address` existe.
  - Admin: `CreateDependentModal.tsx` agrega `address` al tipo del dependiente en edición y al body (mismo checkbox, autocompleta desde la dirección del tutor seleccionado vía la prop `tutors`, que ahora incluye `address`). APIs `POST /api/admin/create-dependent` y `update-dependent` aceptan y persisten `address`, la incluyen en el select de retorno y en `audit_logs.metadata`. `admin/usuarios` carga `address` de dependents, la guarda en `_address` y la pasa a `openEdit` y a la lista de tutores.
- **Estado**: Implementado. Suite secciones A-Y en verde (484 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Changelog `018_changelog_v1_2_1.sql` creado (seed v1.2.1, idempotente; pendiente aplicar junto con 012/013/014/015/016/017). Espejo actualizado en `documentacion/squema-sql-actualizado.sql`.

## 22. Datos Físicos (Peso/Altura/Mano) y Ver Ficha (2026-08-09)
**Requisito**: El perfil y las cargas pueden registrar datos físicos (peso, altura, mano dominante) con validación estricta de formato y rangos; se editan en el perfil, en los modales de carga (dashboard y admin) y en una card editable dentro de la ficha médica. En `/admin/usuarios`, un botón "Ver Ficha" (solo para cargas) abre un modal de solo lectura con todos los datos personales y físicos.
- **Implementación**:
  - Esquema: migración `019_physical_info_profiles_dependents.sql` (idempotente, `ADD COLUMN IF NOT EXISTS`) agrega `weight numeric`, `height numeric`, `dominant_hand text` en `profiles` y `dependents` + CHECK constraints vía DO block (patrón 010): `profiles_weight_check`/`dependents_weight_check` (`weight > 0 AND weight <= 300`), `profiles_height_check`/`dependents_height_check` (`height > 0 AND height <= 250`), `profiles_dominant_hand_check`/`dependents_dominant_hand_check` (`dominant_hand IN ('diestro','zurdo')`). Sin cambios de RLS.
  - Helper isomórfico `src/lib/medidas.ts`: `normalizeMedida` (trim + coma→punto), `parseMedida` (solo `^\d+(\.\d+)?$`, rechaza vacíos/dobles), `isValidPeso` (0–300), `isValidAltura` (0–250), `isValidDominantHand` (`diestro`|`zurdo`). NULL permitido.
  - `src/lib/supabase/dashboard.ts`: `DependentData` con `weight/height/dominant_hand: number | string | null`; `getProfileForEdit` y `updateProfile` los incluyen.
  - `/perfil/page.tsx`: campos Peso (kg) y Altura (cm) + select de mano, validación inline en `handleSave` (mensajes verdes/rojos), envía `parseMedida` o null.
  - `AddDependentModal.tsx`/`EditDependentModal.tsx` (dashboard): bloque "Datos físicos" (2 inputs + botones diestro/zurdo), validación antes de guardar, insert/update con `parseMedida` o null.
  - `DependentCard.tsx`: fila "Datos físicos" (`70.5 kg · 170 cm · Zurdo`) cuando hay datos.
  - Ficha médica (`/dashboard/cargas/[id]/medico/page.tsx`): select incluye los campos físicos; `PhysicalInfoCard.tsx` (nuevo, patrón `MedicalInfoCard`) edita y guarda por browser client con `dependents.update(data).eq("id", dependentId).eq("tutor_id", user.id)`; refresca estado con `setDependent`.
  - Admin: `CreateDependentModal.tsx` soporta físicos (editing, validación, body). APIs `create/update-dependent` validan en server (400: "El peso debe ser mayor a 0 y hasta 300 kg", "La altura debe ser mayor a 0 y hasta 250 cm", "La mano dominante debe ser diestro o zurdo"), persisten, incluyen en select de retorno y en `audit_logs.metadata`.
  - `DataTable.tsx`: props opcionales `onView?: (item) => void` y `canView?: (item) => boolean`; botón ojo "Ver Ficha" (colspan dinámico). `VerFichaModal.tsx` (nuevo): solo lectura, filas de datos personales + físicos (fecha de nacimiento con `new Date(birth_date + "T12:00:00")`). `admin/usuarios` carga los físicos (`_weight/_height/_dominantHand`), `openFicha` y `DataTable onView={openFicha} canView={(u) => !!u._isDependent}`.
- **Estado**: Implementado. Suite secciones A-Z en verde (502 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Changelog `019_changelog_v1_3_0.sql` creado (seed v1.3.0 "Datos Físicos y Ver Ficha", idempotente; pendiente aplicar junto con 012/013/014/015/016/017/018). Espejo actualizado en `documentacion/squema-sql-actualizado.sql`.

## 23. Tienda de Productos: Carrito, Checkout Flow y Stock con Reserva (2026-08-09)
**Requisito**: Vender productos físicos con carrito en el navegador y pago Flow online, totalmente desacoplado de membresías/inscripciones/clases personalizadas. Reservar el stock al checkout (baja atómica) y restaurarlo automáticamente si Flow rechaza/cancela o si el admin cancela la orden. Compra como usuario logueado o invitado (email + teléfono obligatorios, nombre opcional; recibo al correo). Ventas visibles en los dashboards de usuario y admin.
- **Esquema** (migración `020_store_checkout.sql`, idempotente): `product_orders.user_id` y `payments.user_id` → nullable (compra de invitado, vía DO block `DROP NOT NULL`); `product_orders` gana `guest_email`, `guest_phone`, `guest_name`, `reference text` + índice único parcial `idx_product_orders_reference_unique WHERE reference IS NOT NULL`; CHECK `order_items_quantity_check (quantity > 0)`; RPCs `SECURITY DEFINER` `decrement_product_stock` (UPDATE atómico `stock >= p_qty`, evita sobreventa) e `increment_product_stock` (restauración), `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated`. Sin cambios de RLS (las inserciones de invitado van por service role/server).
- **Librería de negocio**: `src/lib/store.ts` (nuevo) — `STORE_CONCEPT_PREFIX = "Tienda:"`, `isStorePayment(payment)` (doble gate: `order_id` + concepto `Tienda:`), `buildStoreReference()` (`REF-ZE-prod-<ts14><uuid8>` con `crypto.randomUUID`), `StockError`, `reserveStock`/`restoreStock` (vía RPC), `getOrderItems`, `getOrderContactEmail` (user_id → profiles.email, si no guest_email), `confirmProductOrder` (idempotente: `product_orders → 'pagado'`), `cancelStoreOrder` (idempotente: `→ 'cancelado'` + restaura stock, evita doble stock), `sendStoreOrderReceipt` y handlers unificados `handleStorePaymentApproved`/`handleStorePaymentRejected`. `src/lib/email.ts` → `sendProductReceiptEmail` (+ `StoreReceiptItem`/`ProductReceiptEmailData`). `src/lib/flow.ts` → `CreateOrderParams.returnUrl?: string` opcional (default `/dashboard/pagos`, backward compatible).
- **API**: `POST /api/store/checkout` (valida carrito/stock con `EMAIL_REGEX`/`PHONE_REGEX` para invitados, precio siempre del servidor, reserva stock → 409 en `StockError`, crea `product_orders` + `order_items` (snapshot `unit_price`) + `payments` flow `pendiente` con `order_id`, `createFlowOrder` con `returnUrl = /api/store/return`, restaura stock en fallo post-reserva); `GET /api/store/return`/`POST /api/store/return` (normaliza la vuelta de Flow GET/POST → 303 `/tienda/confirmacion?token=…`); `GET /api/store/order-status?token=` (público, resuelve orden por `flow_token`); `GET`/`PATCH /api/store/admin/orders` (solo admin; máquina de estados: enviado desde `pagado`, entregado desde `pagado|enviado`, cancelar desde cualquier no-cancelado → `cancelStoreOrder`).
- **Branches Flow desacoplados**: `confirmation`, `verify` y `force-confirm` incluyen `order_id` en el select; con `isStorePayment(payment)` llaman a `handleStorePaymentApproved` (confirmación + recibo) en aprobado y a `handleStorePaymentRejected` (cancelación + restaura stock) en rechazado/cancelado. No tocan `confirmAndCreateMembership`, tokens, QR ni transferencias. La notificación in-app `approved` aplica solo si `payment.user_id` existe (invitados reciben solo el email recibo).
- **Frontend**: `src/context/CartContext.tsx` (localStorage `ze_cart`, add/remove/setQuantity/clear + totales) con `CartProvider` en `layout.tsx`; `Navbar` con badge de carrito (desktop + móvil); `/carrito` con formulario invitado (nombre opcional/email/teléfono) y POST a checkout → agrega el token de Flow a la URL y redirige con `window.location.href` (el carrito ya NO se vacía al iniciar el pago: se vacía en `/tienda/confirmacion` solo cuando el pago se confirma y solo si se inició checkout en la sesión, vía `sessionStorage ze_store_checkout_started`); `/productos` y `/productos/[id]` con botones "Agregar al carrito"/"Comprar ahora"; `/tienda/confirmacion` pública con polling a `order-status` (estados pagado/enviado/entregado, pendiente, cancelado → "stock devuelto").
- **Dashboards**: `src/app/dashboard/tienda/page.tsx` "Mis Compras de Tienda" (lista de `product_orders` del usuario con `order_items`→products y badges de estado) + tab "Mi Tienda" en `DashboardNav`; ventas de tienda aparecen en `/dashboard/pagos` (`PaymentRow` con concepto `Tienda: ...`); admin `/admin/ventas` con filtro por tipo y tab "Órdenes de Tienda" con acciones (las filas de pago con `user_id` nullable ya no crashean en el detalle).
- **Migraciones**: `020_store_checkout.sql` y `020_changelog_v1_4_0.sql` (seed v1.4.0 "Tienda de Productos", idempotente; pendientes aplicar en SQL Editor). Espejo 1:1 actualizado en `documentacion/squema-sql-actualizado.sql`.
- **Fix producción (2026-08-09)**: checkout fallaba con `23514 violates check constraint "product_orders_status_check"` (el constraint pre-existente de `product_orders` no incluía `'pendiente'`, el estado inicial que inserta el checkout). Migración `021_product_orders_status.sql` (idempotente) agrega `'pendiente'` a los estados permitidos; el catch del checkout ahora expone el error real como `detail` en la respuesta 500.
- **Fix producción (2026-08-09) — "Error Processing Request" y 404 en pay.php**: Flow devuelve la URL de pago (`/app/web/pay.php`) **sin el `?token=`**; la tienda redirigía con `router.push(data.url)` sin token → `pay.php` no resolvía la orden ("Error Processing Request"). Además la rama de reuso de pago pendiente de membresías construía `…/payment?token=` (ruta inexistente → 404). Fix: `carrito/page.tsx` agrega el token (`flowUrl.searchParams.set("token", data.token)` + `window.location.href`) y nuevo helper `buildFlowPaymentUrl(token)` en `src/lib/flow.ts` (`/app/web/pay.php?token=…`) usado en ambas ramas de reuso de `create-order/route.ts`.
- **Fix producción (2026-08-09) — 405 en `/tienda/confirmacion` tras pagar**: Flow legacy (`pay.php`) vuelve al comercio con **POST** (token en el body) y las páginas de Next.js solo aceptan GET → 405 en el primer hit (el reload GET funcionaba). Fix: nuevo route `GET`+`POST` en `/api/store/return` que normaliza ambos métodos y hace 303 → `/tienda/confirmacion?token=…`; el checkout de tienda ahora usa `returnUrl = "/api/store/return"`.
- **Estado**: Implementado. Suite secciones A–AA en verde (543 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Requisito/detalle en `contexto/requisitos/tienda-carrito-ventas.md`.

## 24. Vencimiento Automático + Accesibilidad Visual (2026-08-11)
**Requisito**: (a) Las membresías, inscripciones a la academia y packs de clases personalizadas vencidos por fecha (`end_date`) deben persistir su `status` como `'vencida'` (no depender solo del cálculo en runtime), con un botón "Reservar Clase" que lleve a `/horarios` (no a `/auth`). (b) Accesibilidad: eliminar el `backdrop-blur` de toda la UI —las personas mayores perciben el desenfoque de fondo como texto borroso— y reemplazar los paneles de cristal por fondos planos con suficiente contraste.
- **Implementación (a) vencimiento**:
  - Migración `022_expire_benefits.sql`: RPC `public.expire_benefits()` (PL/pgSQL, `SECURITY DEFINER`, idempotente y transaccional) que pasa a `'vencida'` todo beneficio `'activa'` con `end_date < public.chile_today()` en `memberships`, `academy_enrollments` y `personalized_packs` (packs agotados por uso ya quedan `'agotada'` vía `enroll_personalized_class`). `REVOKE` de `PUBLIC` + `GRANT EXECUTE TO authenticated`. Incluye backfill inmediato (un `SELECT expire_benefits()` al final).
  - `src/lib/supabase/dashboard.ts` (`getDashboardSummary`): disparo best-effort de `expire_benefits()` al cargar el dashboard (fire-and-forget con catch), así el estado persistido queda sincronizado con la fecha real de Chile.
  - `src/components/dashboard/MembershipCard.tsx`: el `StatusBadge` usa `effectiveStatus` (derivado de fecha en Chile) en vez de `membership.status` crudo, evitando que una membresía vencida se muestre "Activa" mientras no corra el RPC.
- **Implementación (b) accesibilidad**:
  - `src/app/globals.css`: regla global `*, ::before, ::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important }` (kill switch de blur); `.glass-panel` ahora `rgba(32,31,31,0.92)` plano; `.glass-card` ahora `rgba(32,31,31,0.94)` plano (sin `backdrop-filter`).
  - `Navbar.tsx`: nav `bg-surface/95` al hacer scroll / `bg-surface/90` fijo (antes `bg-surface/80` + blur); overlay móvil `bg-surface-container-lowest/95` sin blur.
  - `Disciplines.tsx` chip: `bg-background/75 backdrop-blur-sm` → `bg-background/90`; `eventos/[id]` botón "Volver": `bg-black/40 backdrop-blur-sm` → `bg-black/70`; `admin/layout.tsx` header: `bg-surface/80 backdrop-blur-xl` → `bg-surface/95`.
  - `PageCTA.tsx`: botón final → "Reservar Clase" enlazando a `/horarios` (antes "Reservar Clase de Prueba" → `/auth`). `Hero.tsx`: CTA principal ya iba a `/horarios`; botón secundario "Ver Horarios" pasa a fondo sólido `bg-surface-container-high`.
- **Estado**: Implementado. Esquema: solo `022_expire_benefits.sql` (función + grants, sin cambios de tablas/RLS). Espejo actualizado en `documentacion/squema-sql-actualizado.sql`. La app ya no usa blur en ninguna capa visible.

## 25. Perfil Deportivo de Alumnos: Disciplina, Grado/Cinturón y Podios (2026-08-11)
**Requisito**: Registrar el perfil deportivo de cada alumno (titular y cargas): disciplina principal, grado/cinturón (con colores oficiales) y un historial de podios (torneos, fecha, disciplina, resultado, categoría, descripción e imagen). El tutor ve la información en su dashboard (card del titular y cards de sus cargas) y el administrador la gestiona desde `/admin/usuarios`. El alumno no puede auto-asignarse su grado: solo el admin escribe.
- **Esquema** (migración `024_sport_profiles.sql`, idempotente; 1:1 en el espejo):
  - `belt_grades`: `(discipline_id FK, position int CHECK > 0, name text, color char(7))`, UNIQUE `(discipline_id, position)`. Seed por disciplina activa: Blanco `#F5F5F5`, Amarillo `#FBC02D`, Naranja `#F57C00`, Verde `#388E3C`, Azul `#1976D2`, Morado `#7B1FA2`, Marrón `#5D4037`, Negro `#212121` (`ON CONFLICT (discipline_id, position) DO NOTHING`). RLS: lectura autenticado, escritura admin.
  - `sport_profiles`: `(beneficiary_id uuid NOT NULL, discipline_id FK, grade_id FK)` + UNIQUE `beneficiary_id` (1 perfil por beneficiario). Trigger `sport_profile_validate_grade()` que valida que `belt_grades.discipline_id = discipline_id` (imposible guardar el cinturón de otra disciplina). RLS: lectura `owns_beneficiary(beneficiary_id) OR is_admin()`, escritura solo admin.
  - `sports_podiums`: `(beneficiary_id FK, tournament, event_date date, discipline_id FK nullable, category text nullable, position CHECK IN ('1','2','3','participacion'), description, image_url)` + índice `idx_sports_podiums_beneficiary_date`. RLS: lectura `owns_beneficiary OR is_admin()`, escritura solo admin.
  - Sin columnas nuevas en `profiles`/`dependents`: anclar a `beneficiaries` impide que el tutor se autoconceda un grado vía `dependents_update_own_or_admin`.
- **Librería de negocio**: `src/lib/sport-profile.ts` (nuevo, isomórfico): tipos `DisciplineRef/BeltGradeRef/SportProfileData/SportPodiumData`, `PODIUM_POSITIONS` (1/2/3/participacion, alineado con el CHECK SQL), `SUGGESTED_CATEGORIES`, `podiumPositionMeta`, `computePodiumStats` (medallas/participaciones, calculadas en runtime, nunca persistidas), `formatPodiumDate` (es-CL) y `sortPodiumsByDateAsc/Desc`.
- **Dashboard**: `src/lib/supabase/dashboard.ts` — `DependentData` con embeds `sport_profiles` (1:1, con `disciplines` + `belt_grades`) y `sports_podiums`; helpers `sportProfileFrom`/`sportPodiumsFrom`; `UserSportProfileData`, `getUserSportProfile(userId)` y `getDependentSportProfile(dependentId)`.
- **UI dashboard**: `BeltBanner.tsx` (franja superior con el color del grado, proviene de la BD), `PodiumStatsLine.tsx` (contadores 🥇🥈🥉🎖️), `SportProfileInfo.tsx` (disciplina + grado + línea de podios) y `TutorSportCard.tsx` (card del titular con su perfil deportivo). `DependentCard.tsx` muestra la franja del cinturón de fondo + `SportProfileInfo`; `/dashboard/cargas` renderiza `TutorSportCard` sobre la lista de cargas.
- **Admin**: `DataTable.tsx` gana `onSport`/`canSport` (botón `sports_martial_arts`); `SportProfileModal.tsx` (nuevo) gestiona disciplina/grado (preview del cinturón con `BeltBanner`) y el CRUD de podios con stats; `PodiumFormModal.tsx` (nuevo) con torneo, fecha, disciplina, resultado, categoría (datalist), descripción e `ImageUpload` (carpeta `podiums`). `admin/usuarios/page.tsx`: `openSportProfile` resuelve el beneficiario por `profile_id` o `dependent_id` (`from("beneficiaries")`), toast si no existe, y pasa `onSport`/`canSport` (true cuando el usuario tiene beneficiario).
- **Migraciones**: `024_sport_profiles.sql` (tablas + trigger + seeds + policies) y `025_changelog_v1_5_0.sql` (seed v1.5.0 "Perfil Deportivo de Alumnos", idempotente; pendientes aplicar en SQL Editor junto con las anteriores). Espejo 1:1 actualizado en `documentacion/squema-sql-actualizado.sql` (3 tablas tras `beneficiaries`, policies tras `medical_records`, seed v1.5.0 al final — 9 seeds de changelog en total).
- **Estado**: Implementado. Suite secciones A–AB en verde (567 tests, `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs`), `npx tsc --noEmit` limpio. Requisito/detalle en `contexto/requisitos/perfil-deportivo-alumnos.md`.

## 26. Quiénes Somos: Historia Interactiva (Kenpo / Kickboxing / MMA) (2026-08-13)
**Requisito**: Rediseñar por completo la página pública "Nosotros" y renombrarla a **"Quiénes Somos"** (`/quienes-somos`), presentándola como una **historia interactiva** con animaciones profundas y foco en la usabilidad (invita a seguir leyendo). El eje narrativo es el **American Kenpo** (primero "qué es" y luego su historia completa); al inicio se ofrecen además dos cards de historia secundarias (**Kickboxing** y **MMA**), pero el Kenpo es la principal y la página abre con él.
- **Rutas**: nueva `src/app/quienes-somos/page.tsx` (Server Component, SEO + JSON-LD LocalBusiness/FAQ). `/nosotros` → **redirect 301** a `/quienes-somos` en `next.config.ts` (se eliminó `src/app/nosotros/`).
- **Contenido**: `src/components/history/stories.ts` — modelo `DisciplineStory`/`StoryChapter` con 3 historias: **American Kenpo** (qué es + 7 capítulos: Shaolin s.VI → James Mitose en Hawái → William Chow → Ed Parker 1954-56 → Hollywood/IKKA → ciencia "Infinite Insights" → legado/ZonaElite), **Kickboxing** (qué es + 5 capítulos: Muay Thai/boxeo → Japón/Osamu Noguchi → Full Contact/PKA → K-1 → actualidad) y **MMA** (qué es + 5 capítulos: Pankration 648 a.C. → Vale Todo/Gracie → UFC 1 (1993) → reglas unificadas/TUF → era moderna/Chile). Cada capítulo tiene periodo/año, lead, párrafos, cita y facts.
- **UX interactiva**: `src/components/history/HistoryExplorer.tsx` (`"use client"`) — **selector de 3 cards** (Kenpo activa por defecto con badge "Nuestra raíz", acentos propios por disciplina; tilt 3D sutil en desktop), **barra de lectura sticky** con % y "Capítulo X de N", **revelado por scroll** (IntersectionObserver con escalonado de párrafos), **línea de tiempo** que se pinta, divisores **"Continuar leyendo"** (smooth-scroll al siguiente capítulo), navegación rápida de capítulos (rail flotante) y cierre con CTAs (volver al inicio / cambiar de historia).
- **Animaciones con profundidad** (`globals.css`): `story-reveal` (fade+translate escalonado), brasas ascendentes en el hero (`ember-rise`), pulso de nodos de la línea de tiempo, glow respirante de la card activa, rebote de "continuar leyendo". Todo **sin `backdrop-filter`** (regla de accesibilidad del proyecto) y con `prefers-reduced-motion` que desactiva las animaciones.
- **Integraciones actualizadas**: `Navbar` (label "Quiénes Somos"), `Footer`, `sitemap.ts` → `/quienes-somos`, texto informativo en `admin/configuracion`. `GalleryCarousel`/`PageCTA`/FAQ reutilizados sin cambios.
- **Sin cambios de BD**: no hay migraciones ni cambios en `squema-sql-actualizado.sql` (el espejo queda 1:1). Requisito/análisis en `contexto/requisitos/quienes-somos-historia-interactiva.md`.
- **Verificación**: `npx tsc --noEmit` limpio, `npx eslint src/components/history` limpio, `npm run build` OK (ruta estática), suite `scripts/test-flows.mjs` en verde (570 tests).
