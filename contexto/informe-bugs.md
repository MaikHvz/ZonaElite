# Informe de Bugs y Fallos — ZonaElite

> **Estado del documento:** ACTIVO — se actualiza conforme se solucionan los bugs.
> **Última actualización:** 2026-08-02
> **Alcance:** Flujos críticos de producción (inscripción a clases, horarios, creación de clases, membresías post-pago, vencimiento y renovación).
---

## Convenciones de estado

| Estado | Significado |
|--------|-------------|
| 🔴 ABIERTO | Detectado, sin arreglo |
| 🟡 EN PROGRESO | Hay un fix en curso |
| 🟢 RESUELTO | Código corregido y verificado |
| ⚪ REVISAR | Requiere decisión de producto/negocio |

**Severidad:** 🔴 Crítico (pierde dinero / bloquea a usuarios) · 🟠 Alto (comportamiento incorrecto) · 🟡 Medio (defensa en profundidad) · ⚪ Bajo (higiene)

---

## B-001 — La membresía nunca "vence" visualmente (estado queda en `activa` para siempre)

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | 🔴 Crítico |
| **Módulo** | Membresías / Dashboard usuario |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** Al pagar, la membresía se guarda con `status = "activa"` (`src/lib/flow-helpers.ts:128`). **Nadie** la cambia a `"vencida"` automáticamente — no hay trigger SQL, ni cron, ni job en el código. Cuando pasa `end_date`, el usuario sigue viendo una membresía "activa" con 0 días restantes.

**Impacto:** El dashboard calculaba el vencimiento solo por el literal del status:
- `src/components/dashboard/MembershipCard.tsx:37` → `isExpired = membership.status === "vencida"`
- `src/components/dashboard/AlertBanner.tsx:15` → `expired = filter(m => m.status === "vencida")`
- `src/app/dashboard/membresias/page.tsx:154` → pestaña "Vencidas" filtra solo por status literal

Por lo tanto el **banner "Tu membresía ha vencido — Renovar" nunca se mostraba** y la pestaña "Vencidas" quedaba vacía. El check-in sí detecta el vencimiento por fecha (`src/app/api/checkin/route.ts:115`, `:212-219`), así que el usuario no podía entrar a clases, pero **no entendía por qué**.

**Solución aplicada (Fase 1):**
- Nuevo módulo puro `src/lib/membership-status.ts` con `effectiveMembershipStatus(status, endDate, today)`, `isMembershipExpired` y `daysRemaining` (anclado a mediodía UTC, DST-safe).
- Regla: una membresía vence cuando `end_date < getChileToday()`, sin depender del status literal. `cancelada` se respeta siempre.
- `MembershipCard.tsx` → `isExpired`/`isWarning` derivados del estado efectivo; `daysRemaining` Chile-aware.
- `AlertBanner.tsx` → `expired`/`expiring` derivados del estado efectivo; días restantes Chile-aware.
- `dashboard/membresias/page.tsx` → filtros "Activas"/"Vencidas"/"Canceladas" usan estado efectivo.
- `dashboard.ts:273-275` → `activeMemberships` filtra por estado efectivo (B-009 resuelto).
- Protegido por la sección F de `scripts/test-flows.mjs` (22 tests nuevos).

**Decisión registrada:** No se crea trigger/job para actualizar `status='vencida'` en BD; el cálculo dinámico por fecha es la fuente de verdad y evita jobs asíncronos frágiles.

**Referencias:** `flow-helpers.ts:120-131`, `MembershipCard.tsx:37`, `AlertBanner.tsx:15`, `dashboard/membresias/page.tsx:154`, `dashboard.ts:273-275`, `admin/membresias/page.tsx:213-220`.

---

## B-002 — Doble membresía activa posible (race condition en el pago Flow)

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | 🟠 Alto |
| **Módulo** | Membresías / Pago Flow |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `confirmAndCreateMembership` (`src/lib/flow-helpers.ts:22-151`) intenta garantizar "una sola membresía activa" cancelando las activas antes de insertar (`:99-116`), pero:
1. El dedup (`:80-88`) solo mira ventana de 10 min y mismo `plan_id`.
2. El "cancel-all" y el "insert" son **dos queries separadas, sin transacción ni constraint de BD**.
3. Dos callbacks de Flow en paralelo (confirmation GET/POST + verify + force-confirm) pueden pasar ambos el guard `payment.membership_id === null` y ambos crear membresía → **2 filas con `status='activa'`**.

**Impacto:** `get_remaining_tokens` no filtra por `membership_id` en el conteo (`squema-sql-actualizado.sql:903-908`), con membresías zombi los tokens se mezclan entre ambas. UI muestra duplicados.

**Solución aplicada (Fase 2):**
- Migración `contexto/migrations/002_unique_active_membership.sql`: crea el índice único parcial `idx_memberships_one_active ON memberships(beneficiary_id) WHERE status='activa'`, que **rechaza el segundo insert con SQLSTATE 23505** a nivel de BD. Antes de crear el índice, la migración (a) normaliza activas vencidas a `status='vencida'` (backfill de una sola vez, coherente con B-001) y (b) elimina duplicados activos **vigentes** conservando la **más reciente** (orden `created_at DESC, id DESC`).
- `flow-helpers.ts`: captura `23505` en el insert y hace **retry idempotente** — re-consulta la membresía activa existente y linkea el pago a esa en lugar de fallar (combinado con B-008).
- `AssignMembershipModal.tsx`: detecta `23505` en el insert del admin y recarga el listado (`onSaved()`) en vez de cerrar en silencio.

**Decisión de negocio registrada (2026-08-01):** ante duplicados activos vigentes se conserva la **más reciente** (mayor `created_at`); la limpieza solo toca vigentes (`end_date >= hoy`). El `DELETE` ordena por `created_at DESC, id DESC` porque `memberships.id` es UUID aleatorio (`gen_random_uuid()`) y no es secuencial.

**Verificación:** sección G de `scripts/test-flows.mjs` (mock de Supabase con índice único): 2 confirmaciones en paralelo → 1 sola membresía activa, ambos pagos linkeados a la misma.

**Referencias:** `flow-helpers.ts:99-151`, `AssignMembershipModal.tsx:161-199`, `migrations/002_unique_active_membership.sql`, `squema-sql-actualizado.sql:237-247`.

---

## B-003 — El botón "Renovar" apunta a un número de WhatsApp placeholder

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | 🟠 Alto |
| **Módulo** | Dashboard usuario |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `src/components/dashboard/AlertBanner.tsx:34` y `:61` enlazaban a `https://wa.me/56900000000?text=...` — número de teléfono placeholder que no pertenece a la academia.

**Impacto:** Un usuario con membresía vencida tocaba "Renovar" y escribía a un número inexistente → perdía la renovación y la academia perdía la venta.

**Solución aplicada (Fase 1):** `AlertBanner.tsx` ahora enlaza el botón "Renovar" (tanto en el banner de vencida como en el de "vence pronto") a la **sección de compra de membresías** `/#membresias`, donde está el `CheckoutModal` con los planes y el botón "Comprar ahora". Se descartó el enfoque de WhatsApp: el flujo correcto de renovación es la compra, no un chat.

**Referencias:** `AlertBanner.tsx:34,61`, `dashboard.ts` (academy_settings).

---

## B-004 — Inscripción de academia duplicable (sin verificación de activa) + fecha con zona horaria del servidor

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO |
| **Severidad** | 🟠 Alto |
| **Módulo** | Inscripciones admin |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `src/app/admin/inscripciones/page.tsx:235-259` (`handleAssign`):
1. Inserta `academy_enrollments` **sin verificar si el beneficiario ya tiene una activa** (crea dobles), a diferencia de `extendEnrollment` que sí busca y extiende (`flow-helpers.ts:184-191`).
2. Calcula `today` y `endDate` con `new Date()` local del servidor (`:244-247`), no con `getChileToday()`/`addDaysChile()` → viola la regla 16 de `BRAIN.md:462`. `endDate` usa `new Date(Date.now() + duration*86400000)` — suma en ms, no DST-safe.

**Impacto:** Dobles inscripciones activas que confunden el check-in (`al_dia`/`atrasado`); fechas con off-by-one en la franja 20:00-23:59 Chile y al cruzar DST.

**Solución implementada (2026-08-01):** Nuevo helper compartido `src/lib/enrollments.ts` (`extendOrCreateEnrollment`) que centraliza la lógica: si el beneficiario tiene inscripción ACTIVA vigente la EXTENDE desde `max(end_date, hoy)` + duration (DST-safe); si no, crea con `start_date = getChileToday()` y `end_date = addDaysChile(hoy, duration)`. `handleAssign` ahora lo reusa (dedup) y solo calcula fechas de pago; `extendEnrollment` de `flow-helpers.ts` delega en el mismo helper (sin lógica duplicada; importable en cliente porque `enrollments.ts` no arrastra `crypto` como `flow.ts`). Al extender sin pago nuevo se conserva el `payment_id` previo.

**Referencias:** `src/lib/enrollments.ts`, `admin/inscripciones/page.tsx:235-276`, `flow-helpers.ts:179-182`, `BRAIN.md:462`.

---

## B-005 — RLS de `class_enrollments` valida con `current_date` (UTC) en vez de fecha chilena

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO |
| **Severidad** | 🟠 Alto |
| **Módulo** | Inscripción a clases / RLS |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** La policy `class_enrollments_insert_admin_or_self` (`squema-sql-actualizado.sql:567-574`) usa `ae.end_date >= current_date` y `m.end_date >= current_date`. `current_date` es fecha del servidor PostgreSQL (UTC), mientras toda la app usa `America/Santiago`.

**Impacto:** En la franja 20:00–23:59 hora Chile, `current_date` es "mañana" en Chile → un usuario con membresía que vence HOY Chile podría que su insert se rechace (o se valide contra el día equivocado). Además el check-in QR tiene su propia política sin validación de fecha (`class_enrollments_insert_qr_walkin`).

**Solución implementada (2026-08-01):** Migración `003_chile_today_rls.sql` crea la función `public.chile_today()` (`timezone('America/Santiago', now())::date`) y regenera la policy `class_enrollments_insert_admin_or_self` comparando `end_date >= public.chile_today()`. La validación server-side del check-in (`checkin/route.ts:114,212`) ya usaba `getChileToday()`, por lo que quedó consistente. Migración **aplicada en Supabase el 2026-08-01**.

**Fuera de alcance (documentado):** `body_metrics.recorded_at date DEFAULT CURRENT_DATE` (`squema-sql-actualizado.sql:386`) tiene el mismo problema UTC, pero la columna no se usa en el código de la app.

**Referencias:** `contexto/migrations/003_chile_today_rls.sql`, `squema-sql-actualizado.sql:567-574`, `checkin/route.ts:114`, `flow-helpers.ts`.

---

## B-006 — Capacidad de clase validada solo en el cliente

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟡 Medio |
| **Módulo** | Inscripción a clases |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `src/components/EnrollModal.tsx` verificaba `remaining = capacity - enrolled` **solo en el navegador**. No hay enforcement server-side ni en RLS. Dos usuarios inscribiéndose en paralelo a la última cupo → se sobrepasa el aforo.

**Solución aplicada:** RPC transaccional `public.enroll_class(p_session_id uuid, p_beneficiary_ids uuid[])` en la migración `004_enroll_class_rpc.sql` (SECURITY DEFINER, VOLATILE). Bloquea la fila de la sesión con `SELECT ... FOR UPDATE` y recontaría `class_enrollments` dentro de la transacción, por lo que dos inscripciones concurrentes no pueden superar `schedules.capacity` (default 20). Valida por beneficiario: acceso (admin u `owns_beneficiary`), membresía activa vigente, inscripción a la academia activa vigente, cupo, e idempotencia (ya inscrito → success). Devuelve `(beneficiary_id, success, error_code, error_message)` con códigos `UNAUTHORIZED`, `NO_MEMBERSHIP`, `NO_ENROLLMENT`, `CLASS_FULL`. **Decisión clave:** la RPC **no** exige `class_sessions.status = 'activa'` porque `generate-sessions` crea sesiones futuras como `'cerrada'` (el admin las activa al momento de la clase); valida en cambio `session_date >= public.chile_today()`. `EnrollModal.tsx` ahora llama a la RPC (ya no inserta directo) y muestra el `error_message` de la BD. `REVOKE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated`.

> **Corrección 2026-08-10 (volatilidad):** la RPC estaba declarada `STABLE`, pero usa `SELECT ... FOR UPDATE` e `INSERT` → PostgreSQL lanza `SELECT FOR UPDATE is not allowed in a non-volatile function` al inscribir. Se corrigió a `VOLATILE` en la migración `004` y en el espejo `documentacion/squema-sql-actualizado.sql` (1:1). Re-aplicar la migración `004_enroll_class_rpc.sql` en Supabase (es idempotente, `CREATE OR REPLACE FUNCTION` permite cambiar la volatilidad).

**Verificación:** suite 119 tests (B-006 en sección D, incl. espejo 1:1 migración↔esquema), `npm run build` verde. **Migración `004_enroll_class_rpc.sql` aplicada en Supabase (2026-08-02).**

**Referencias:** `contexto/migrations/004_enroll_class_rpc.sql`, `EnrollModal.tsx:353`, `class_enrollments` RLS, `generate-sessions/route.ts`.

---

## B-007 — La firma HMAC del callback de Flow nunca se verifica

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | 🟡 Medio (seguridad) |
| **Módulo** | Pago Flow |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `verifyFlowCallbackSignature` está definida en `src/lib/flow.ts:207-228` y validada por la suite de tests, pero **no se usa en ningún handler**. `src/app/api/flow/confirmation/route.ts` acepta POST/GET con `token` sin verificar la firma `s` (solo valida estado vía `verifyFlowPayment` contra Flow, `:89`).

**Impacto:** El endpoint de confirmación es invocable sin autenticación. Un atacante que conozca un `flow_token` podría disparar el procesamiento, aunque el estado real lo decide Flow vía `verifyFlowPayment` (mitigación parcial). Riesgo principal: confusión de orden/parámetros.

**Hallazgo de la auditoría de documentación (2026-08-01):** la doc oficial de Flow NO envía una firma `s` en el body del callback de confirmación — el callback solo manda el `token` (POST form-urlencoded o JSON) y el comercio debe verificar el estado llamando a `payment/getStatus` con la secretKey (la firma `s` se usa en las llamadas a la API de Flow, no en el webhook). Por lo tanto `verifyFlowCallbackSignature` no es aplicable al webhook y se mantiene como utilidad para firmar las llamadas de la API.

**Solución aplicada (Fase 5):** la verificación real del callback quedó en dos capas server-side, ambas con la secret key:
1. `verifyFlowPayment(token)` consulta el estado real a Flow (ya existía, `flow.ts`).
2. **Nuevo helper `isVerificationOrderMatch`** (`src/lib/flow-helpers.ts`): compara el `commerceOrder` devuelto por Flow contra el `commerce_order` guardado en `payments`. Si no coinciden, el callback se descarta (log + retorno sin procesar). Aplicado en `confirmation/route.ts` y `verify/route.ts` justo después de confirmar `status === 2`.

Esto elimina el riesgo de confusión de orden/replay cross-tenant: aunque un atacante conozca un token válido de otro pago, el procesamiento solo avanza si el `commerceOrder` de Flow coincide con el registro local.

**Verificación:** sección C de `scripts/test-flows.mjs` ampliada (unit de `isVerificationOrderMatch` + scan de ambos routes). Suite en verde (102 tests) y build OK.

**Referencias:** `flow.ts:207-228`, `confirmation/route.ts:56-115`, `verify/route.ts:85-110`, `flow-helpers.ts`.

---

## B-008 — Falla silenciosa al crear la membresía post-pago

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | 🟡 Medio |
| **Módulo** | Pago Flow |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** En `confirmation/route.ts:116-125`, `verify/route.ts:92-103` y `force-confirm/route.ts:42`, si `confirmAndCreateMembership` falla, solo se loguea en consola (`console.error`). El pago queda `status='pagado'` pero el usuario **sin membresía**, sin retry ni notificación al admin.

**Impacto:** El cliente paga y no recibe su membresía. Nadie se entera hasta que el usuario reclama.

**Solución aplicada (Fase 6):**
- Nuevo helper `notifyPaymentWithoutMembership` en `src/lib/flow-helpers.ts`: best-effort, nunca lanza. Resuelve el primer admin (`profiles.role_id=1`) para satisfacer `notifications.sent_by NOT NULL` y inserta una notificación `type='sistema'`, `subject="Pago pagado sin membresía"`, `target='staff'` con `content` JSON que incluye `payment_id`, `user_id`, `concept` y el `error`. La RLS `notifications_select_all_or_admin` (esquema `:636`) garantiza que solo admin/staff la ven (los usuarios solo ven `target='todos'`).
- `confirmation/route.ts`, `verify/route.ts` y `force-confirm/route.ts` ahora llaman al helper cuando `confirmAndCreateMembership` devuelve `success: false` (y en el catch de `confirmation`). En `force-confirm` se agregó además la revisión del resultado que antes se ignoraba por completo.
- El reintento manual ya existía (`force-confirm`); con la alerta el admin sabe qué pago necesita el reintento.
- **Decisión:** se descartó el job/cron automático (el plan lo marcaba opcional) y el cambio de estado "procesando" — la alerta + reintento manual es suficiente para el flujo actual de volumen bajo.

**Verificación:** sección G de `scripts/test-flows.mjs` ampliada (mock con admin → insert en `notifications` con `target='staff'`/`type='sistema'`/content completo; sin admin → no inserta y no lanza; scans de los 3 handlers). Suite en verde (110 tests) y build OK.

**Referencias:** `flow-helpers.ts`, `confirmation/route.ts:127-139`, `verify/route.ts:102-115`, `force-confirm/route.ts:39-47`, `squema-sql-actualizado.sql:350-360,636-637`.

---

## B-009 — El dashboard cuenta membresías "activas" sin filtrar por vencimiento

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01, junto con B-001) |
| **Severidad** | 🟡 Medio |
| **Módulo** | Dashboard usuario |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `src/lib/supabase/dashboard.ts:273-275` (`getDashboardSummary`) filtraba `activeMemberships` solo por `m.status === "activa"`, sin comparar `end_date`. Las métricas del dashboard (QuickStats "membresías activas", sección "Mis Membresías") contaban membresías ya vencidas por fecha.

**Solución aplicada (Fase 1):** ahora filtra con `effectiveMembershipStatus(m.status, m.end_date, today) === "activa"` (estado efectivo Chile-aware).

**Referencias:** `dashboard.ts:273-275`.

---

## B-010 — `get_remaining_tokens` no filtra el conteo por `membership_id`

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟡 Medio |
| **Módulo** | Tokens |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** En `squema-sql-actualizado.sql`, el conteo de clases consumidas (`v_consumed`) NO filtra por `p_membership_id`; solo exigía que exista una membresía `activa` del beneficiario y usaba la ventana temporal sin límite superior. Con membresías solapadas (renovación antes de vencer, o el escenario de 2 activas que era B-002), los tokens se contaban cruzados entre ambas.

**Solución aplicada:** El conteo sigue siendo **dinámico** (se calcula en cada llamada, no se almacena) pero ahora queda **atado a la membresía que el usuario tiene**: una reserva "pertenece" a la membresía cuya ventana de vigencia contiene el momento en que se hizo (`ce.enrolled_at`). Se agregó el límite superior faltante en `get_remaining_tokens` (migración `005_tokens_membership_window.sql`):
- `ce.enrolled_at >= v_created_at` (ya existía) **y** `ce.enrolled_at < (v_end_date + INTERVAL '1 day')` (nuevo).
- Aplicado tanto a `v_consumed` como a `v_justified`.
Como B-002 garantiza una sola membresía activa por beneficiario, esta ventana identifica de forma inequívoca la membresía. La migración es `CREATE OR REPLACE` idempotente; no cambia firmas ni grants.

**Verificación:** suite 127 tests (B-010 en sección D, incl. espejo 1:1 migración↔esquema), `npm run build` verde. **Migración `005_tokens_membership_window.sql` aplicada en Supabase (2026-08-02).**

**Referencias:** `contexto/migrations/005_tokens_membership_window.sql`, `get_remaining_tokens` (única copia en el esquema), `MembershipCard.tsx:47`.

---

## B-011 — RPCs duplicadas en el esquema documentado

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | ⚪ Bajo (higiene) |
| **Módulo** | Documentación SQL |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `squema-sql-actualizado.sql` definía `get_remaining_tokens` dos veces y `get_enrollment_debt` dos veces (el bloque "MIGRACIÓN: Sistema de Tokens por Membresía" estaba duplicado). `CREATE OR REPLACE` hace que gane la última, pero la duplicación era riesgo de deriva entre el doc y producción.

**Solución aplicada (Fase 8):** eliminada la copia duplicada completa del esquema (bloque de migración repetido con ALTER tokens + índices + ambas funciones). Queda **una sola definición** de `get_remaining_tokens` y de `get_enrollment_debt`, y un único `ALTER TABLE membership_plans ADD COLUMN tokens`. Verificado por tests (B-011) que cada función y el ALTER aparecen exactamente 1 vez.

**Referencias:** `squema-sql-actualizado.sql` (sección de tokens), tests B-011 en sección D.

---

## B-012 — `user_notifications` no está documentada en el esquema

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | ⚪ Bajo (higiene) |
| **Módulo** | Documentación SQL |
| **Fuente** | Verificación BD 2026-08 |

**Descripción:** La BD real tiene la tabla `user_notifications` (1 fila) que **no existía** en `squema-sql-actualizado.sql` (grep = 0 resultados). También hay `notifications` (0 filas) sí documentada. La tabla se creó fuera del esquema documentado.

**Solución aplicada (Fase 9):** DDL de `user_notifications` agregado al esquema, reconstruido desde la BD real vía OpenAPI/PostgREST (con la service role key). Columnas verificadas: `id uuid PK`, `user_id uuid NOT NULL`, `title text NOT NULL`, `content text NOT NULL`, `read boolean DEFAULT false NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL`. Tests B-012 validan presencia, columnas, PK y no duplicación.

**Referencias:** `squema-sql-actualizado.sql` (tabla `user_notifications`), `dashboard.ts:1077-1140`, `Navbar.tsx:35`.

---

## B-013 — RLS demasiado permisivas (auto-inscripción/auto-asistencia por API)

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟠 Alto (seguridad) |
| **Módulo** | RLS |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** Las policies permiten a un usuario autenticado insertar directamente (bypass a la validación del client admin):
- `academy_enrollments.user_insert_enrollment_flow` (`squema-sql-actualizado.sql:683`) → `owns_beneficiary` **sin pago ni verificación de status**.
- `class_enrollments_insert_qr_walkin` (`:572+`) → walk-in sin membresía/inscripción.
- `attendance_insert_own_beneficiary` → auto-asistencia.

**Mitigación actual:** los endpoints (`/api/checkin`) usan el admin client y validan membresía/tokens, así que la vía normal es segura. Pero un usuario con la URL REST directa puede auto-inscribirse/asistir.

**Fix aplicado (Fase 10):** Migración `006_debts_and_rls.sql` elimina las 3 policies permisivas (`DROP POLICY IF EXISTS`) y las recrea restringidas a `is_admin() OR is_staff()`:
- `academy_enrollments_insert_admin_staff` (reemplaza `user_insert_enrollment_flow`).
- `class_enrollments_insert_qr_admin_staff` (reemplaza `class_enrollments_insert_qr_walkin`).
- `attendance_insert_admin_staff` (reemplaza `attendance_insert_own_beneficiary`).

El flujo QR legítimo pasa por `/api/checkin` (admin client, bypass RLS). El INSERT del propio usuario queda solo vía service role. Migración `006` **aplicada en Supabase (2026-08-02)**.

**Referencias:** `squema-sql-actualizado.sql:567-574,679-683`, `contexto/migrations/006_debts_and_rls.sql`.

---

## B-014 — Constraint UNIQUE legacy `(beneficiary_id, schedule_id)` coexiste con `(beneficiary_id, session_id)`

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟡 Medio |
| **Módulo** | Esquema BD |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `squema-sql-actualizado.sql:413-419` define ambos UNIQUE. Las inscripciones nuevas insertan solo `session_id` (EnrollModal `:353-358`), así que el constraint legacy por `schedule_id` nunca actúa en las nuevas. Pero inscripciones históricas con solo `schedule_id` no matchean el check-in por `session_id`.

**Fix aplicado (Fase 10):** Migración `006_debts_and_rls.sql`:
1. **Backfill:** las filas legacy (`schedule_id IS NOT NULL AND session_id IS NULL`) se mapean a la sesión futura más próxima (`session_date >= chile_today()`) del mismo schedule, con guard `NOT EXISTS` contra `(beneficiary_id, session_id)` para no duplicar.
2. **Drop del constraint legacy:** `DROP CONSTRAINT IF EXISTS class_enrollments_beneficiary_schedule_key` + `DROP INDEX IF EXISTS` del índice implícito.

El modelo per-session `(beneficiary_id, session_id)` queda como única fuente de verdad. Migración `006` **aplicada en Supabase (2026-08-02)**.

**Referencias:** `squema-sql-actualizado.sql:413-419`, `EnrollModal.tsx:353-358`, `contexto/migrations/006_debts_and_rls.sql`.

---

## B-015 — Código muerto en `confirmAndCreateMembership`

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-01) |
| **Severidad** | ⚪ Bajo (higiene) |
| **Módulo** | Membresías |
| **Fuente** | Auditoría 2026-08 |

**Descripción:** `src/lib/flow-helpers.ts:106-108` — `if (existingMembership?.id)` es inalcanzable: si `existingMembership` existiera, la función ya retornó en la línea 96. El bloque `cancelQuery.neq("id", ...)` nunca se ejecuta.

**Solución aplicada (Fase 2):** eliminado el bloque muerto; el `cancel-all` quedó como una query única directa. Test de scan en sección G verifica que `cancelQuery.neq` ya no existe en `flow-helpers.ts`.

**Referencias:** `flow-helpers.ts:99-116`.

---

## B-016 — Columna `location_url` faltante en `events`

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟠 Alto (bloquea crear/editar eventos) |
| **Módulo** | Eventos |
| **Fuente** | Reporte del usuario |

**Descripción:** al crear/editar un evento en `/admin/eventos` (con URL de Google Maps o imagen) el insert/update falla con `Could not find the 'location_url' column of 'events' in the schema cache`. La UI envía y lee `location_url` (campo "Ubicación Google Maps"), pero la tabla `events` no tenía esa columna (solo `location_name`, `location_lat`, `location_lng`).

**Fix aplicado:** migración `007_add_events_location_url.sql` — `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;` (idempotente). Espejo 1:1 actualizado en `squema-sql-actualizado.sql`. Sin cambios de frontend (ya consumía la columna).

**Verificación:** suite **161 passed, 0 failed**, `npm run build` verde. ⚠️ **Migración 007 pendiente de aplicar en Supabase.**

**Referencias:** `src/app/admin/eventos/page.tsx`, `src/components/EventCard.tsx`, `src/app/eventos/[id]/page.tsx`, `contexto/migrations/007_add_events_location_url.sql`.

---

## B-017 — Navbar público tapa el menú CRUD del admin en móvil

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟠 Alto (el admin no puede navegar los CRUD desde el celular) |
| **Módulo** | Panel admin / Navegación |
| **Fuente** | Reporte del usuario |

**Descripción:** en el celular, dentro del panel admin, al tocar el botón de menú (☰) se abre el menú del sitio público (Inicio, Nosotros, Disciplinas, Tienda, Blog...) en vez del menú de CRUD del admin (Productos, Eventos, Horarios, Asistencia, Usuarios, Deudas, Ventas...). El menú CRUD del admin nunca se veía en móvil.

**Causa raíz:** el `<Navbar />` público se renderiza en el layout raíz en todas las rutas (incluido `/admin`) y es `fixed top-0 z-50`. El layout del admin no tenía offset superior (a diferencia de `/dashboard`, que usa `pt-24 md:pt-28`), por lo que el navbar público quedaba **encima** del header del admin: el ☰ propio del admin (que abre el drawer de CRUD) quedaba invisible debajo, y el único ☰ visible era el del navbar público.

**Fix aplicado:**
1. `src/components/Navbar.tsx` — oculta el navbar público en rutas `/admin` vía `usePathname()` (`if (pathname.startsWith("/admin")) return null;`).
2. `src/app/admin/layout.tsx` — header auto-contenido: círculo de perfil enlazado a `/perfil` + botón "Cerrar sesión" (`signOut()` + `router.push("/auth")`), ya que el navbar público (que proveía logout/Perfil) ya no está en `/admin`.

**Verificación:** suite **178 passed, 0 failed** (sección L nueva), `npm run build` verde. Sin migración SQL.

**Referencias:** `src/components/Navbar.tsx`, `src/app/admin/layout.tsx`, `src/app/dashboard/layout.tsx`, `contexto/requisitos/fix-navbar-admin-movil.md`.

---

## B-018 — Pago Flow rechazado/anulado queda "pendiente" y sin feedback para el usuario

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟠 Alto (mala UX: el usuario cree que pagó / el registro queda con estado falso) |
| **Módulo** | Pago Flow / Dashboard pagos |
| **Fuente** | Prueba en sandbox con tarjeta rechazada |

**Descripción:** Flow devuelve en `payment/getStatus` los estados `1 = pendiente`, `2 = pagada`, `3 = rechazada`, `4 = anulada`. El código solo manejaba `2` (pagada) y `4` (cancelada):
- `src/app/api/flow/verify/route.ts` caía al `else` para `status === 3`, devolviendo el status de la BD (seguía `pendiente`) **sin actualizarla**.
- `src/app/api/flow/confirmation/route.ts` (callback server) logueaba "Flow not approved" y retornaba **sin marcar el pago**.
- `/dashboard/pagos` mapeaba todo resultado distinto de "pagado" a un banner genérico de fallo, sin distinguir rechazado/anulado/pendiente.

**Impacto:** al probar en sandbox con una tarjeta rechazada, el usuario volvía a `/dashboard/pagos` sin feedback claro de que el pago NO se realizó, y el registro quedaba como `pendiente` en vez de `rechazada`. El botón "Pagar de nuevo" dentro de la ventana de 5 min podía reutilizar ese payment pendiente.

**Solución aplicada:**
1. **`src/lib/flow.ts`** — nuevo helper `mapFlowStatus(status)` que traduce el estado de Flow a `pendiente | pagado | rechazado | cancelado` (única fuente de verdad, testeable).
2. **`verify/route.ts`** — para `status !== 2` actualiza el pago según `mapFlowStatus` (`rechazado`/`cancelado`) y devuelve `{ status: mapped }` al cliente. `status 1` devuelve `pendiente` (el callback asíncrono puede completarlo luego).
3. **`confirmation/route.ts`** — en el callback server, si `status !== 2` marca el pago como `rechazado`/`cancelado` en BD (ya no queda pendiente) y retorna sin crear membresía.
4. **`PurchaseSuccessBanner.tsx`** — `PurchaseFailedBanner` acepta `title`/`description`; nuevo `PurchasePendingBanner` (tinte ámbar) para pagos pendientes.
5. **`/dashboard/pagos`** — feedback diferenciado: `rechazado` → "Pago rechazado. No se realizó ningún cargo", `cancelado` → "Pago anulado/cancelado", `pendiente` → "Tu pago está pendiente de confirmación". Aplica a membresías, inscripciones y cualquier pago (mismo flujo verify).
6. **Overlays centrados (feedback explícito con botón OK):** nuevo `PaymentErrorModal` (panel rojo al centro de la pantalla con botón **OK** que lo cierra) para `rechazado`, `cancelado`, `not_found` y errores de verificación; `PaymentSuccessModal` (verde, ya existente) ahora tiene botón **OK** verde como acción primaria ("Ver Membresías" queda secundario).
7. **`/admin/ventas`** — filtro de estado **Rechazado** + tarjeta de conteo de rechazados.

**Verificación:** suite **198 passed, 0 failed** (sección M nueva: unit de `mapFlowStatus` + scans de routes/pagos/ventas/banner/esquema + overlays), `npm run build` verde. Sin migración SQL (`payments.status` es `text` sin CHECK; `StatusBadge` ya soportaba `rechazado`).

**Referencias:** `flow.ts:mapFlowStatus`, `api/flow/verify/route.ts:133-143`, `api/flow/confirmation/route.ts:100-114`, `PurchaseSuccessBanner.tsx`, `PaymentErrorModal.tsx`, `PaymentSuccessModal.tsx`, `dashboard/pagos/page.tsx`, `admin/ventas/page.tsx`, `contexto/requisitos/feedback-pagos-flow.md`.

---

## B-019 — La recompra tras un pago rechazado reutiliza el token muerto (y el botón queda en "Procesando...")

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-02) |
| **Severidad** | 🟠 Alto (bloquea la recompra; el usuario queda sin forma de pagar de nuevo) |
| **Módulo** | Pago Flow / Recompra |
| **Fuente** | Reporte del usuario (recompra post-rechazo en sandbox) |

**Descripción:** tras pagar con una tarjeta **rechazada** en sandbox, al comprar de nuevo dentro de los 5 min el botón "Pagar con Flow" quedaba en **"Procesando..."** o enviaba al usuario a Flow con un **token ya rechazado** (página de error de Flow).

**Causa raíz:** `src/app/api/flow/create-order/route.ts` — bloque "Prevent duplicate pending payments (5 min window)":
- Busca un pago del usuario con `status='pendiente'` creado hace < 5 min y llama `verifyFlowPayment(token)`, pero **solo maneja `status === 2`** (lo marca pagado).
- Para `status === 3` (rechazada) o `4` (anulada) caía al final del bloque y **reutilizaba el token muerto** → Flow muestra error.
- Si `verifyFlowPayment` se colgaba (Flow lento), el route no respondía y el botón quedaba en "Procesando..." indefinidamente (el cliente no tenía timeout).

**Análisis de "sesión perdida" (logs de Vercel):** los `304` a `/dashboard`, `/admin`, `/perfil` son `Not Modified` (caché), no errores de auth; el `303` a `/auth` es el redirect **normal** del middleware (`src/lib/supabase/middleware.ts:53-57`) cuando un usuario YA autenticado visita `/auth`. La sesión **no se perdió**.

**Solución aplicada:**
1. **`create-order/route.ts`** — el bloque `existingPending` usa `mapFlowStatus`:
   - `2` (pagado, race del callback) → marca `pagado` y responde `{ status: "already_paid", token }` para que el cliente muestre el éxito sin volver a cobrar.
   - `3`/`4` → marca el pago `rechazado`/`cancelado` en BD y **NO reutiliza**: continúa y crea una **orden nueva** con token fresco.
   - `1` (sigue pendiente) → reutiliza el mismo token (comportamiento original).
   - Error de `verifyFlowPayment` → mantiene el comportamiento original (reutiliza como pendiente).
2. **`CheckoutModal.tsx`** — refactor de `handlePay`/`handleConfirmOverwrite` a un helper único `doCreateOrder` con `AbortController` timeout **~20 s** (el botón **nunca** queda en "Procesando..."): maneja `data.status === "already_paid"` redirigiendo a `/dashboard/pagos?token=...`, mensaje específico para `401` ("Tu sesión expiró...") y para timeout ("El pago tardó demasiado. Intenta de nuevo."), y `setProcessing(false)` garantizado en `finally`.

**Verificación:** suite **206 passed, 0 failed** (sección N nueva: scan de `create-order` + `CheckoutModal` + unit de `mapFlowStatus` tolerando string), `npm run build` verde. Sin migración SQL.

**Nota producción (pagos reales):** `mapFlowStatus` normaliza el status de Flow (`number | string`) para que `"3"`/`"4"` (la API real puede devolverlo como string) nunca caigan en `pendiente` y reutilicen un token muerto con dinero real.

**Referencias:** `api/flow/create-order/route.ts:169-235`, `components/CheckoutModal.tsx:doCreateOrder`, `contexto/requisitos/fix-reuso-pago-rechazado.md`.

---

## B-020 — Rutas de debug/reintento manual reaparecieron sin protección (`force-confirm`, `debug`) + `generate-sessions` sin guard admin

| Campo | Valor |
|-------|-------|
| **Estado** | 🟢 RESUELTO (2026-08-15) |
| **Severidad** | 🔴 Crítico |
| **Módulo** | Pago Flow / Admin |
| **Fuente** | Auditoría 2026-08-15 |

**Descripción:** `PLAN-PRODUCCION.md` (Fix #1) documentaba la eliminación de `src/app/api/flow/debug/route.ts` y `src/app/api/flow/force-confirm/route.ts` por ser accesibles sin autenticación. En algún punto del desarrollo posterior de B-008/B-018/B-019 ambas rutas volvieron a existir en el repo (como herramienta de debug mientras se armaban los fixes de pagos Flow) y quedaron sin ningún guard de auth:
- `force-confirm` (POST) marcaba cualquier `paymentId` como `pagado` y creaba membresía/pack/orden de tienda vía cliente admin, sin autenticación ni verificación de rol. **Sin ningún caller en el código** (ni la UI del admin lo invoca) — dinero real en riesgo si alguien descubre el endpoint.
- `debug` (GET) exponía los últimos 20 pagos (incluido `flow_token`) sin autenticación.

Adicionalmente, `src/app/api/admin/generate-sessions/route.ts` (sí usada desde `/admin/asistencia`, botón "Generar sesiones") no tenía el guard `role_id === 1` que sí tienen sus pares (`create-user`, `create-dependent`, `update-dependent`).

**Solución aplicada:**
1. Eliminados `src/app/api/flow/debug/` y `src/app/api/flow/force-confirm/` completos (sin callers reales; las funciones compartidas que usaban — `confirmAndCreateMembership`, `notifyPaymentWithoutMembership`, `confirmPersonalizedPack`, `handleStorePaymentApproved` — siguen intactas en `flow-helpers.ts`/`store.ts`, usadas por `confirmation/route.ts` y `verify/route.ts`).
2. `generate-sessions/route.ts` — agregado el mismo guard de sesión + `role_id !== 1 → 403` que el resto de `/api/admin/*`.
3. `scripts/test-flows.mjs` — removidas las ~7 aserciones que leían `force-confirm/route.ts` (secciones B-008, O, P, AA); ya no aplican.

**Verificación:** suite **567 passed, 0 failed** (bajó de 570: las 3 aserciones eliminadas eran las que testeaban el archivo borrado), `npx tsc --noEmit` limpio (tras purgar `.next/types` stale). Sin migración SQL.

**Referencias:** `PLAN-PRODUCCION.md` (Fix #1 original), `src/app/api/admin/generate-sessions/route.ts`, `scripts/test-flows.mjs`.

---

| Fecha | Acción |
|-------|--------|
| 2026-08-01 | Creación del informe con hallazgos de la auditoría de flujos críticos + verificación de BD en vivo. |
| 2026-08-01 | **Fase 1 completa:** B-001, B-003 y B-009 resueltos (vencimiento dinámico + botón Renovar a la compra). Suite en verde (70 tests). |
| 2026-08-01 | **Fase 2 completa:** B-002 y B-015 resueltos (índice único parcial + retry 23505 idempotente). Suite en verde (81 tests). Migración `002_unique_active_membership.sql` pendiente de aplicar en Supabase. |
| 2026-08-01 | **Fase 3 completa:** B-005 resuelto (helper `chile_today()` + policies con fecha chilena). Suite en verde (84 tests). Migración `003_chile_today_rls.sql` aplicada por el usuario. |
| 2026-08-01 | **Fase 4 completa:** B-004 resuelto (dedup de inscripciones admin + fechas Chile via helper compartido `extendOrCreateEnrollment`). Suite en verde (96 tests). |
| 2026-08-01 | **Fase 5 completa:** B-007 resuelto (verificación de `commerceOrder` en `confirmation/route.ts` y `verify/route.ts` vía `isVerificationOrderMatch`; doc oficial de Flow aclara que el callback solo manda `token`, la firma se usa en las llamadas a la API). Suite en verde (102 tests). |
| 2026-08-01 | **Fase 6 completa:** B-008 resuelto (alerta admin vía `notifyPaymentWithoutMembership` en los 3 handlers post-pago). Suite en verde (110 tests). |
| 2026-08-02 | **Fase 7 completa:** B-006 resuelto (RPC transaccional `enroll_class` con lock y validación de capacidad en la migración `004`; `EnrollModal` la usa). Suite en verde (119 tests). Migración `004_enroll_class_rpc.sql` aplicada por el usuario. |
| 2026-08-02 | **Fase 8 completa:** B-010 y B-011 resueltos (conteo de tokens atado a la membresía por ventana temporal en la migración `005`; RPCs duplicadas consolidadas en el esquema). Suite en verde (127 tests). Migración `005_tokens_membership_window.sql` aplicada por el usuario. |
| 2026-08-02 | **Fase 9 completa:** B-012 resuelto (tabla `user_notifications` documentada en el esquema, DDL verificado contra la BD real). Suite en verde (131 tests). |
| 2026-08-02 | **Fase 10 completa:** B-013 y B-014 resueltos (RLS restringidas a admin/staff + deuda materializada en `debts` + drop del constraint legacy en la migración `006`). Suite en verde (156 tests). Migración `006_debts_and_rls.sql` aplicada por el usuario. |
| 2026-08-02 | **B-016 resuelto:** columna `location_url` agregada a `events` (migración `007`). Suite en verde (161 tests). Migración `007_add_events_location_url.sql` pendiente de aplicar en Supabase. |
| 2026-08-02 | **B-017 resuelto:** navbar público oculto en `/admin` (antes tapaba el ☰ del admin y se abría el menú del sitio). Suite en verde (178 tests). Sin migración. |
| 2026-08-02 | **B-018 resuelto:** pagos Flow rechazados/anulados se marcan en BD y el usuario recibe feedback diferenciado (rechazado/cancelado/pendiente) en `/dashboard/pagos` + filtro "Rechazado" en `/admin/ventas`. Suite en verde (195 tests). Sin migración. |
| 2026-08-02 | **B-018 ampliado:** overlays centrados con botón OK — `PaymentErrorModal` rojo para rechazado/anulado/error y `PaymentSuccessModal` verde con OK primario para pago exitoso. Suite en verde (198 tests). |
| 2026-08-02 | **B-019 resuelto:** la recompra post-rechazo ya no reutiliza el token muerto (`create-order` usa `mapFlowStatus`: `3`/`4` → marca y crea orden nueva, `2` → `already_paid`) y `CheckoutModal` nunca queda bloqueado (timeout `AbortController` 20 s). Suite en verde (206 tests). Sin migración. |
| 2026-08-15 | **B-020 resuelto:** eliminadas `flow/debug` y `flow/force-confirm` (habían reaparecido sin auth pese a estar "eliminadas" en `PLAN-PRODUCCION.md`); `generate-sessions` ahora exige `role_id === 1`. Suite en verde (567 tests). Sin migración. |
