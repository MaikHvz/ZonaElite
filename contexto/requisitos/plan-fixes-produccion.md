# Plan de Implementación — Corrección de Bugs Críticos de Producción

> **Documento de planificación** (SOP `guia-de-trabajo.md`, fase 1 y 2).
> **Objetivo:** Corregir minuciosamente los bugs del informe `contexto/informe-bugs.md`, priorizando los flujos críticos: **inscripción a clases → horarios → creación de clases → membresía post-pago → vencimiento/renovación**.
> **Estado:** EN PLANIFICACIÓN — actualizado según avance.

---

## 0. Principios de ejecución (por qué este plan es "minucioso, no rápido")

1. **Una fase a la vez, con verificación antes de pasar a la siguiente.** No se mezclan fases en el mismo commit.
2. **Cada fix nuevo se protege con un test** en `scripts/test-flows.mjs` (la suite ya existente; se agregan casos por bug).
3. **Después de cada fase: `npm run build` + `scripts/test-flows.mjs` en verde.** No se avanza si algo queda rojo.
4. **Cambios de BD van SIEMPRE a `contexto/migrations/NNN_*.sql` y se registran en `squema-sql-actualizado.sql`** (regla 4 del SOP) para mantener doc↔BD en espejo.
5. **No cambiar el comportamiento del pago Flow sin validar firma/callback primero** — es el flujo que genera dinero.
6. **Verificación en BD real** (cuando aplique) con la service role key en modo solo-lectura antes y después.
7. **Cada fase termina actualizando** `contexto/informe-bugs.md` (estado del bug) y `contexto/requisitos/plan-fixes-produccion.md` (checklist).

---

## Fase 1 — Vencimiento dinámico de membresías (B-001, B-009)

> **Prioridad:** Máxima. Es la regla de negocio "cuando termine el tiempo debe vencer y avisar al usuario".

### 1.1 Análisis de impacto
- **Componentes que miran solo `status`:** `MembershipCard.tsx:37`, `AlertBanner.tsx:15`, `dashboard/membresias/page.tsx:154`, `dashboard.ts:273-275`.
- **Quienes comparan por fecha (correctos):** checkin route `:115,212-219`, EnrollModal `:131`, admin membresias/inscripciones filtros.
- **Riesgo:** cambiar la definición de "vencida" a nivel UI podría marcar como vencidas membresías que el admin canceló (no). `status='cancelada'` se respeta como cancelada.
- **Zona horaria:** comparaciones contra `getChileToday()` (no `Date.now()` del navegador) para consistencia server/client.

### 1.2 Pasos de implementación
1. **Crear helper derivado** `isMembershipExpired(membership, today)` o función `effectiveStatus(membership)` en `src/lib/dashboard.ts` (o `dates.ts`): 
   - `vencida` si `status !== 'cancelada' && end_date < today`.
   - `activa` si `status === 'activa' && end_date >= today`.
   - respeta `cancelada` literal.
2. **`AlertBanner.tsx`:** usar `effectiveStatus` para calcular `expired` y `expiring` (expiring = activa efectiva con <=7 días).
3. **`MembershipCard.tsx`:** `isExpired`/`isWarning` desde `effectiveStatus`.
4. **`dashboard/membresias/page.tsx`:** la pestaña "Vencidas" filtra con `effectiveStatus === 'vencida'`; "Activas" con efectiva activa.
5. **`dashboard.ts:273-275`:** `activeMemberships = filter(m => m.status === 'activa' && m.end_date >= getChileToday())`.
6. **Decidir trigger SQL:** ¿actualizar `status='vencida'` en BD vía job/edge function? Por defecto NO (el cálculo dinámico basta y evita jobs); registrar la decisión en el informe.
7. **Botón Renovar (B-003):** reemplazar `wa.me/56900000000` por un enlace directo a la **sección de compra de membresías** (`/#membresias`, donde está el `CheckoutModal` con "Comprar ahora"). Descartado el WhatsApp: la renovación es un flujo de compra.

### 1.3 Tests nuevos (en `scripts/test-flows.mjs`, sección nueva "Vencimiento")
- `effectiveStatus(activa, end_date en pasado) === 'vencida'`
- `effectiveStatus(activa, end_date hoy) === 'activa'`
- `effectiveStatus(cancelada, end_date pasado) === 'cancelada'`
- `effectiveStatus(activa, end_date dentro de 3 días) === 'activa'` (y expiring)
- Scan estático: verificar que `MembershipCard`/`AlertBanner` ya no usan `status === "vencida"` como única fuente.

### 1.4 Verificación manual
- Editar `end_date` de una membresía de prueba a ayer (SQL/panel admin), recargar dashboard → banner rojo + pestaña "Vencidas" con la membresía + botón Renovar que lleva a `/#membresias` (compra).

---

## Fase 2 — COMPLETADA (2026-08-01) — Atomicidad de membresías (B-002, B-015)

> **Prioridad:** Alta. Evita "dos membresías activas" que además corrompe el conteo de tokens (B-010).

### Implementado
1. **Migración SQL** `contexto/migrations/002_unique_active_membership.sql`:
   - Paso 1 — Backfill: `UPDATE memberships SET status='vencida' WHERE status='activa' AND end_date < current_date` (normaliza activas vencidas; requisito del índice único parcial, coherente con B-001).
   - Paso 2 — Limpieza de duplicados **vigentes**: `DELETE ... WHERE rn > 1` con `row_number() OVER (PARTITION BY beneficiary_id ORDER BY created_at DESC, id DESC)` → conserva la más reciente.
   - Paso 3 — `CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active ON memberships(beneficiary_id) WHERE status='activa'`.
   - ⚠️ ~~Aplica manualmente en Supabase (SQL Editor).~~ **Aplicada por el usuario (2026-08-01).** `memberships.id` es UUID aleatorio, por eso se ordena por `created_at DESC, id DESC` (no por `id`).
2. **`confirmAndCreateMembership`** (`flow-helpers.ts`): captura `insertError.code === "23505"` → retry idempotente (re-consulta activa existente y linkea el pago a esa). Se eliminó el código muerto `cancelQuery.neq` (B-015).
3. **`AssignMembershipModal.tsx`**: verifica el resultado del insert; ante `23505` recarga el listado (`onSaved()`) en lugar de cerrar en silencio.
4. **Imports con extensión `.ts`** en `flow-helpers.ts` + `allowImportingTsExtensions: true` en `tsconfig.json` (necesario para que Node importe el módulo en los tests).

### Decisión de negocio (2026-08-01)
- Ante duplicados activos vigentes se conserva la **más reciente** (mayor `created_at`).
- La limpieza de duplicados solo toca **vigentes** (`end_date >= hoy`); las vencidas se normalizan a `status='vencida'` (no se eliminan).

### Verificación
- Sección G de `scripts/test-flows.mjs`: **81 passed, 0 failed** (11 tests nuevos).
  - Mock de Supabase con índice único: 2 confirmaciones en paralelo → 1 sola membresía activa, ambos pagos linkeados a la misma (`mem-1`).
  - Scans: B-015 eliminado, `23505` manejado en `flow-helpers` y `AssignMembershipModal`, migración 002 con el patrón correcto.
- `npm run build`: **verde**.

### 2.4 Verificación manual (tras aplicar la migración)
- Con el índice aplicado, disparar double-confirm (abrir verify + confirmation para el mismo token) → verificar 1 sola fila activa en BD.
- Comprobar que `idx_memberships_one_active` figura en la lista de índices.

---

## Fase 3 — COMPLETADA (2026-08-01) — Fecha chilena en RLS (B-005)

### Implementado
1. **Migración SQL** `contexto/migrations/003_chile_today_rls.sql`:
   - `CREATE OR REPLACE FUNCTION public.chile_today()` → `(timezone('America/Santiago', now()))::date` (STABLE, DST-safe).
   - Regenera la policy `class_enrollments_insert_admin_or_self` reemplazando `end_date >= current_date` (UTC) por `end_date >= public.chile_today()` en la validación de `academy_enrollments` y `memberships`.
   - ⚠️ **Aplica manualmente en Supabase** (SQL Editor). La migración 002 ya fue aplicada por el usuario.
2. **Esquema sincronizado** `squema-sql-actualizado.sql`: función `chile_today()` documentada y policies actualizadas (espejo 1:1 con la migración).

### Fuera de alcance (documentado)
- `body_metrics.recorded_at date DEFAULT CURRENT_DATE` conserva el problema UTC, pero la columna no se usa en el código de la app. Si se usa a futuro debe migrarse a `chile_today()`.

### Verificación
- Sección D de `scripts/test-flows.mjs`: scan nuevo que la policy use `chile_today()` y que no quede `end_date >= current_date` en el esquema. Suite completa: **84 passed, 0 failed**.
- `npm run build`: **verde** (TypeScript OK, 39 páginas).

---

## Fase 4 — COMPLETADA (2026-08-01) — Inscripción de academia: dedup + fechas Chile (B-004)

### Implementado
1. **Nuevo helper compartido** `src/lib/enrollments.ts` → `extendOrCreateEnrollment(supabase, beneficiaryId, enrollmentPlanId, paymentId)`:
   - Dedup: busca inscripción ACTIVA vigente del beneficiario (`.eq('status','activa').gte('end_date', getChileToday())`). Si existe, la **extiende** desde `max(end_date, hoy)` con `addDaysChile`; si no, crea con `start_date = getChileToday()` y `end_date = addDaysChile(hoy, duration)`.
   - Al extender sin pago nuevo conserva el `payment_id` previo (no lo pisa con null).
   - Client-safe: solo importa `dates.ts` (no arrastra `crypto` de `flow.ts`), por eso el page admin puede importarlo.
2. **`admin/inscripciones/page.tsx` `handleAssign`**: reescrito para reusar el helper (adiós insert directo duplicador y adiós fechas con `new Date()`/`Date.now()+ms`). El pago se crea antes y se pasa su id al helper.
3. **`flow-helpers.ts` `extendEnrollment`**: ahora delega en `extendOrCreateEnrollment` (misma firma, sin lógica duplicada). Los routes Flow (`confirmation`, `verify`, `force-confirm`) quedan intactos.

### Verificación
- Sección E de `scripts/test-flows.mjs`: mock de Supabase (crear → extender → extender con pago) + scans estáticos (sin `Date.now()+duration*86400000`, sin insert directo duplicador, delega en helper). Suite completa: **96 passed, 0 failed** (12 tests nuevos).
- `npm run build`: **verde** (TypeScript OK, 39 páginas).

---

## Fase 5 — Firma HMAC del callback Flow (B-007)

> **Prioridad:** Media (seguridad). No cambia UX pero es requisito de integridad.

> **Estado:** COMPLETADA (2026-08-01). Suite 102 tests verdes, build OK.

### 5.1 Pasos
1. **`confirmation/route.ts`:** extraer y verificar `s` del body/query con `verifyFlowCallbackSignature` (ya testeada en la suite) antes de `processInBackground`. Flujo: Flow envía `token`, `s` (firma) y `d` (orden, `commerce_order`). Verificar que `d` coincide con el `commerce_order` del pago.
2. Mantener respuesta `200 OK` siempre (Flow exige ACK aunque falle la firma; loguear y descartar).
3. Tests: el callback con firma inválida no procesa; con firma válida procesa.

### 5.2 Corrección por auditoría de documentación (2026-08-01)

La doc oficial de Flow **no** envía `s` ni `d` en el callback de confirmación: solo manda el `token` (POST form-urlencoded o JSON). La firma `s` se usa en las llamadas a la API de Flow (create/getStatus), no en el webhook. Por eso `verifyFlowCallbackSignature` **no es aplicable al callback** y el paso 1 se reemplazó por la verificación real que sí corresponde:

- `verifyFlowPayment(token)` (server-side, con secret key) confirma el estado real del pago en Flow — ya existía.
- **Nuevo helper `isVerificationOrderMatch`** en `flow-helpers.ts`: compara el `commerceOrder` devuelto por Flow contra el `commerce_order` guardado en `payments`; si no coincide, el callback se descarta (log + return sin procesar). Aplicado en `confirmation/route.ts` y `verify/route.ts` tras confirmar `status === 2`.
- El `200 OK` inmediato antes del procesamiento en background se mantiene (el callback ya responde OK y procesa con `after()`).

### 5.3 Verificación
- Sección C ampliada: unit de `isVerificationOrderMatch` (coincide / distinta / nulos) + scans de que ambos routes comparan el `commerceOrder`.
- Suite: 96 → 102 tests, 0 fallos. Build de producción OK.

### 5.4 Checklist
- [x] Helper `isVerificationOrderMatch` en `flow-helpers.ts`
- [x] `confirmation/route.ts` descarta callback si `commerceOrder` no coincide
- [x] `verify/route.ts` descarta el procesamiento si `commerceOrder` no coincide
- [x] `200 OK` inmediato preservado (ACK de Flow)
- [x] Tests unit + scan en sección C
- [x] Suite verde (102) y build OK
- [x] Informe de bugs y este plan actualizados

---

## Fase 6 — Falla silenciosa post-pago + alerta admin (B-008)

> **Prioridad:** Media.

> **Estado:** COMPLETADA (2026-08-01). Suite 110 tests verdes, build OK.

### 6.1 Pasos
1. En `confirmation/route.ts` / `verify/route.ts` / `force-confirm/route.ts`: si `confirmAndCreateMembership` falla, además de loguear:
   - Insertar/actualizar `notifications` (target admin/staff) con `type='pago_sin_membresia'`, subject "Pago pagado sin membresía", content con `payment_id` y `error`.
   - (Opcional) edge function / cron para reintentar pagos en estado `pagado` sin `membership_id`.
2. Tests: verificar que al fallar la creación se genera la notificación (mock).

### 6.2 Implementación
- **`notifyPaymentWithoutMembership`** (`src/lib/flow-helpers.ts`): best-effort, nunca lanza. Resuelve el primer admin (`profiles.role_id=1`) para `notifications.sent_by NOT NULL` e inserta `{ type:'sistema', subject:'Pago pagado sin membresía', content: JSON{payment_id, user_id, concept, error}, target:'staff' }`. RLS `notifications_select_all_or_admin` hace que solo admin/staff la vean (usuarios solo ven `target='todos'`).
- **`confirmation/route.ts`**, **`verify/route.ts`**, **`force-confirm/route.ts`**: llaman al helper cuando `confirmAndCreateMembership` falla (y en el catch de confirmation). `force-confirm` ahora además revisa el `result.success` (antes lo ignoraba).
- **Decisiones:** se descartó (a) job/cron automático (opcional en el plan) y (b) estado "procesando"; el reintento manual ya existe (`force-confirm`) y la alerta cubre la detección. Sin cambios de BD → sin migración ni cambios al esquema.

### 6.3 Verificación
- Sección G ampliada: mock con admin → insert en `notifications` (`target='staff'`, `type='sistema'`, content con `payment_id`/`user_id`/`error`, `sent_by` = admin); sin admin → no inserta y no lanza; scans de los 3 handlers.
- Suite: 102 → 110 tests, 0 fallos. Build de producción OK.

### 6.4 Checklist
- [x] Helper `notifyPaymentWithoutMembership` (best-effort, resuelve admin)
- [x] `confirmation/route.ts` notifica si falla la membresía (result + catch)
- [x] `verify/route.ts` notifica si falla la membresía
- [x] `force-confirm/route.ts` revisa el resultado y notifica si falla
- [x] Tests mock + scans en sección G
- [x] Suite verde (110) y build OK
- [x] Informe de bugs y este plan actualizados

---

## Fase 7 — Capacidad de clase server-side (B-006)

> **Prioridad:** Media.

### 7.1 Pasos
1. **RPC `enroll_class`** (migración `004`): transacción que (a) verifica sesión existente y no pasada (`session_date >= chile_today()`), (b) cuenta inscripciones y valida `capacity`, (c) verifica membresía/inscripción del beneficiario, (d) inserta `class_enrollments` con lock (`SELECT ... FOR UPDATE` sobre la sesión).
2. **`EnrollModal.tsx`:** reemplazar el insert directo por la RPC; mostrar el `error_message` de la BD (p. ej. "clase llena").
3. Mantener el check cliente como UX rápida, pero la fuente de verdad es la RPC.
4. Tests: mock de la RPC rechazando por capacidad.

### 7.2 Estado: ✅ COMPLETADA (2026-08-02)
- ✅ Paso 1: migración `contexto/migrations/004_enroll_class_rpc.sql` creada (SECURITY DEFINER, STABLE, `SELECT ... FOR UPDATE`; valida acceso, membresía, inscripción, cupo e idempotencia; códigos `UNAUTHORIZED`, `NO_MEMBERSHIP`, `NO_ENROLLMENT`, `CLASS_FULL`; `REVOKE FROM PUBLIC` + `GRANT TO authenticated`).
- ✅ Paso 2: `EnrollModal.tsx` usa `supabase.rpc("enroll_class", …)` y muestra el error de la BD; estado `submitError` reseteado al recargar.
- ✅ Paso 3: el check cliente se mantiene como UX.
- ✅ Paso 4: tests B-006 en `scripts/test-flows.mjs` (sección D): RPC en migración 004, `FOR UPDATE`, validación de capacidad con `chile_today()`, códigos de error, sesión pasada sin exigir `status='activa'`, grant a authenticated, EnrollModal usa RPC, y espejo 1:1 migración↔esquema.
- ✅ Verificación: suite **119 passed, 0 failed**, `npm run build` verde.
- ✅ **Migración `004_enroll_class_rpc.sql` aplicada en Supabase SQL Editor (2026-08-02).**

---

## Fase 8 — Tokens: filtrar conteo por membership_id (B-010)

> **Prioridad:** Media. Depende de que B-002 esté resuelto (si solo hay 1 activa, el bug no se manifiesta).

### 8.1 Pasos
1. **Migración SQL:** modificar `get_remaining_tokens` para filtrar `v_consumed`/`v_justified` por `m.id = p_membership_id` (unir el conteo a la membresía específica).
2. **Consolidar RPCs duplicadas (B-011):** dejar una sola definición de `get_remaining_tokens` y `get_enrollment_debt` en `squema-sql-actualizado.sql`.
3. Tests: SQL lint + test de la lógica (replicar la consulta en TS sobre un fixture si es viable, o al menos validar el SQL en el doc).

### 8.2 Estado: ✅ COMPLETADA (2026-08-02)
- ✅ Paso 1: migración `contexto/migrations/005_tokens_membership_window.sql` — el conteo sigue siendo **dinámico** (se calcula en cada llamada, no se materializa) y queda atado a la membresía que el usuario tiene: `ce.enrolled_at >= v_created_at` (ya existía) **y** `ce.enrolled_at < (v_end_date + INTERVAL '1 day')` (nuevo), en `v_consumed` y `v_justified`. Con B-002 (1 sola activa) la ventana identifica la membresía sin ambigüedad. `CREATE OR REPLACE` idempotente.
- ✅ Paso 2 (B-011): eliminada la copia duplicada del bloque "MIGRACIÓN: Sistema de Tokens" del esquema. Queda 1 sola definición de `get_remaining_tokens`, 1 de `get_enrollment_debt` y 1 `ALTER TABLE tokens`.
- ✅ Paso 3: tests B-010/B-011 en `scripts/test-flows.mjs` (sección D): límite superior en ambos conteos, espejo 1:1 migración↔esquema, unicidad de funciones/ALTER, función STABLE (dinámica).
- ✅ Verificación: suite **127 passed, 0 failed**, `npm run build` verde.
- ✅ **Migración `005_tokens_membership_window.sql` aplicada en Supabase SQL Editor (2026-08-02).**

---

## Fase 9 — Documentación SQL y esquema en espejo (B-011, B-012)

> **Prioridad:** Baja (higiene), pero requisito SOP.

### 9.1 Pasos
1. Agregar el DDL de `user_notifications` al esquema documentado (extraer de BD vía verificación solo-lectura o del código que la usa).
2. Consolidar RPCs duplicadas (B-011): **ya hecho en Fase 8** (queda una sola definición de `get_remaining_tokens` y `get_enrollment_debt`).
3. Actualizar `requisitos-implementados.md` con una sección "Correcciones de estabilidad 2026-08" y `flujo-modulos.md` si el comportamiento cambió.

### 9.2 Estado: ✅ COMPLETADA (2026-08-02)
- ✅ Paso 1 (B-012): DDL de `user_notifications` agregado al esquema, verificado contra la BD real vía OpenAPI/PostgREST (service role key). Columnas: `id uuid PK`, `user_id uuid NOT NULL`, `title text NOT NULL`, `content text NOT NULL`, `read boolean DEFAULT false NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL`. Tests B-012 (presencia, columnas, PK, no duplicación).
- ✅ Paso 2 (B-011): ya hecho en Fase 8.
- ✅ Paso 3: `requisitos-implementados.md` (creado, sección "Correcciones de estabilidad 2026-08") y `flujo-modulos.md` (creado, comportamiento vigente tras las correcciones) actualizados al cierre del plan.
- ✅ Verificación: suite **131 passed, 0 failed**, `npm run build` verde.

---

## Fase 10 — COMPLETADA (2026-08-02) — Deudas QR + RLS restringidas + constraint legacy (B-013, B-014)

> **Prioridad:** Requería decisión de negocio. Decisión registrada 2026-08-02:
> 1. **Deuda sin tokens** → se materializa en tabla `debts` (1 fila por beneficiario/sesión, sin duplicar); el check-in sin tokens queda `presente` + deuda pendiente.
> 2. **B-013** → las 3 policies permisivas se restringen a `is_admin() OR is_staff()`.
> 3. **B-014** → backfill de filas legacy (`schedule_id` → sesión futura más próxima) + drop del UNIQUE `(beneficiary_id, schedule_id)`.

### Implementado
1. **Migración `contexto/migrations/006_debts_and_rls.sql`** (idempotente, espejo 1:1 en `squema-sql-actualizado.sql`):
   - Tabla `debts` (`beneficiary_id`, `membership_id`, `session_id`, `class_enrollment_id`, `amount`, `status` `pendiente|pagada|condonada`, `note`, `created_at`, `resolved_at`, `resolved_by`) + índices `idx_debts_beneficiary_status`, `idx_debts_session` + RLS (`debts_admin_all`, `debts_staff_read`, `debts_user_read_own`).
   - **B-013:** `DROP POLICY` de `user_insert_enrollment_flow`, `class_enrollments_insert_qr_walkin`, `attendance_insert_own_beneficiary`; nuevas `academy_enrollments_insert_admin_staff`, `class_enrollments_insert_qr_admin_staff`, `attendance_insert_admin_staff` (todas `is_admin() OR is_staff()`).
   - **B-014:** backfill legacy con guard `NOT EXISTS (beneficiary_id, session_id)` + `DROP CONSTRAINT IF EXISTS class_enrollments_beneficiary_schedule_key` (+ índice implícito).
2. **`src/app/api/checkin/route.ts`:** gate de matrícula (`academy_enrollments` activa con `end_date >= today` → `sin_matricula` bloquea); sin tokens ya no rechaza → inscribe + crea deuda `pendiente` (guard anti-duplicado por sesión); resultado incluye `debt`.
3. **`src/app/checkin/[sessionId]/page.tsx`:** avisos `sin_matricula` / `debt` ("Quedó 1 clase en deuda") + chip "En deuda".
4. **Admin deudas:** `src/app/admin/deudas/page.tsx` (listado agrupado, filtros Pendientes/Resueltas/Todas, acciones pagar/condonar individuales y por grupo) + link en `AdminSidebar.tsx`.
5. **`src/components/dashboard/MembershipCard.tsx`:** deuda materializada vía `getPendingDebts` (indicador rojo + bloque de deudas) en vez de derivada del saldo negativo.
6. **`src/lib/supabase/dashboard.ts`:** tipo `PendingDebt` + `getPendingDebts(beneficiaryId)`.

### Verificación
- `scripts/test-flows.mjs`: **156 passed, 0 failed** (sección H, ~25 tests nuevos).
- `npm run build`: **verde** (sin warnings).

### Pendiente
- ✅ **Migración 006 aplicada por el usuario en Supabase (2026-08-02).**

---

## Orden de ejecución y dependencias

```
Fase 1 (vencimiento UI) ─────────────────────────────────────┐
Fase 2 (atomicidad BD + retry idempotente) ──┐               │
Fase 3 (chile_today RLS) ────┐                │              │
Fase 4 (inscripción admin) ──┤                ├─▶ Fase 5 (firma) ─▶ Fase 6 (alertas) ─▶ Fase 7 (capacidad)
Fase 8 (tokens) ─────────────┤                │              │
Fase 9 (docs/ esquema) ◀─────┴────────────────┘              │
Fase 10 (deudas QR + RLS restringidas + legacy) ◀───────────┘  (decisión de negocio registrada 2026-08-02)
```

> **Nota:** Las fases 1-4 pueden ejecutarse de forma incremental. La fase 8 depende lógicamente de la 2 (aunque el fix de tokens es independiente del fix de atomicidad). La fase 10 se completó el 2026-08-02 con la decisión de negocio: deuda materializada en `debts`, RLS restringidas a admin/staff y drop del constraint legacy.

---

## Verificación continua

| Check | Comando |
|-------|---------|
| Tests de la suite | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` |
| Build + typecheck | `npm run build` |
| Lint (si aplica) | ver `package.json` scripts |

---

## Checklist de cierre por fase

- [x] Fase 1: tests nuevos verdes + build verde + informe actualizado
- [x] Fase 2: migración `002` aplicada por el usuario + tests verdes (84) + informe actualizado
- [x] Fase 3: código + tests verdes (84) + informe actualizado; migración `003` **aplicada por el usuario** (2026-08-01)
- [x] Fase 4: tests verdes (96) + build verde + informe actualizado
- [x] Fase 5: tests verdes (102) + build verde + informe actualizado
- [x] Fase 6: tests verdes (110) + build verde + informe actualizado
- [x] Fase 7: migración `004` aplicada + tests verdes + informe actualizado (2026-08-02)
- [x] Fase 8: migración `005` aplicada + informe actualizado (2026-08-02)
- [x] Fase 9: esquema en espejo + informe actualizado
- [x] Fase 10: decisión registrada + informe actualizado (2026-08-02; migración `006` aplicada por el usuario).

## Registro de cambios del documento

| Fecha | Acción |
|-------|--------|
| 2026-08-01 | Creación del plan con 10 fases priorizadas por los flujos críticos. |
| 2026-08-01 | **Fase 1 completada** (B-001, B-003, B-009). Detalle abajo. |
| 2026-08-01 | **Fase 2 completada** (B-002, B-015). Migración `002` pendiente de aplicar en Supabase. Detalle abajo. |
| 2026-08-01 | **Fase 2 aplicada**: el usuario corrió `002_unique_active_membership.sql` en Supabase. |
| 2026-08-01 | **Fase 3 completada** (B-005). Migración `003` pendiente de aplicar en Supabase. Detalle abajo. |
| 2026-08-01 | **Fase 3 aplicada**: el usuario corrió `003_chile_today_rls.sql` en Supabase (`chile_today()` + policy regenerada). |
| 2026-08-01 | **Fase 4 completada** (B-004). Helper compartido `extendOrCreateEnrollment` (dedup + fechas Chile). Detalle abajo. |
| 2026-08-01 | **Fase 5 completada** (B-007). Verificación de `commerceOrder` en confirmation/verify; doc oficial de Flow aclara que el callback solo manda `token`. Detalle en la sección de la fase. |
| 2026-08-01 | **Fase 6 completada** (B-008). Alerta admin `notifyPaymentWithoutMembership` en los 3 handlers post-pago. Detalle en la sección de la fase. |
| 2026-08-02 | **Fase 10 completada** (B-013, B-014 + deuda materializada). Migración `006_debts_and_rls.sql` (tabla `debts`, 3 RLS restringidas a admin/staff, backfill legacy + drop constraint). Suite 156 verdes, build verde. Detalle en la sección de la fase. |
| 2026-08-02 | **Fase 10 aplicada**: el usuario corrió `006_debts_and_rls.sql` en Supabase. |
| 2026-08-02 | **Plan cerrado**: checklist de las 10 fases completo; creados `contexto/requisitos/requisitos-implementados.md` y `contexto/flujo-modulos.md` (cierre Fase 9, paso 3). |
| 2026-08-02 | **B-018 resuelto (post-plan):** feedback de pagos Flow rechazados/anulados/pendientes. `mapFlowStatus` en `flow.ts`; `verify/route.ts` y `confirmation/route.ts` marcan el pago en BD; `/dashboard/pagos` muestra banners diferenciados; `/admin/ventas` filtra por "Rechazado". Suite **195 passed, 0 failed**, build verde, sin migración. Ver `contexto/requisitos/feedback-pagos-flow.md`. |

---

## Fase 1 — COMPLETADA (2026-08-01) — Vencimiento dinámico de membresías (B-001, B-009, B-003)

### Implementado
1. `src/lib/membership-status.ts` (nuevo): `effectiveMembershipStatus`, `isMembershipExpired`, `daysRemaining` — módulo puro DST-safe, importable por la suite de tests.
2. `MembershipCard.tsx`: `isExpired`/`isWarning`/`daysRemaining`/`progress` derivados del estado efectivo y de `getChileToday()` (antes: `Date.now()` del navegador y status literal).
3. `AlertBanner.tsx`: `expired`/`expiring` derivados del estado efectivo + **botón Renovar enlaza a `/#membresias`** (sección de compra de membresías).
4. `dashboard/membresias/page.tsx`: filtros "Activas"/"Vencidas"/"Canceladas" por estado efectivo.
5. `dashboard.ts` `getDashboardSummary`: `activeMemberships` por estado efectivo.

### Verificación
- `scripts/test-flows.mjs`: **70 passed, 0 failed** (22 tests nuevos en sección F).
- `npm run build`: **verde** (TypeScript OK, 39 páginas estáticas).

### Decisiones
- No trigger/job SQL para `status='vencida'`; el estado efectivo por fecha es la fuente de verdad.
- Enlace de renovación: directo a la sección de compra `/#membresias` (el usuario compra/renueva ahí, no por WhatsApp).
- **Renovación de membresía (decisión de negocio 2026-08-01):** al pagar de nuevo, la membresía anterior se CANCELA y se crea una NUEVA que arranca desde HOY (no suma días a la vigente). Es un reemplazo desde el día del pago, no una extensión — a diferencia de las inscripciones de academia (`extendOrCreateEnrollment`), que sí extienden desde el fin actual. Implementado en `confirmAndCreateMembership` (`flow-helpers.ts`).
