# Fase 10 — Deudas por check-in sin tokens + RLS restringidas + constraint legacy (B-013, B-014)

> **Documento de planificación** (SOP `guia-de-trabajo.md`, fases 1-2).
> **Objetivo:** cerrar la Fase 10 del `plan-fixes-produccion.md` con tres piezas:
> 1. **Deuda materializada** cuando un alumno hace check-in por QR sin tokens.
> 2. **RLS restringidas** (B-013): ya no se puede auto-inscribir/asistir por REST.
> 3. **Constraint legacy** (B-014): backfill de filas `schedule_id` sin `session_id` y drop del UNIQUE legacy.

---

## 1. Reglas de negocio (confirmadas con el cliente)

| Situación | Comportamiento |
|---|---|
| Alumno sin membresía activa o sin matrícula vigente escanea QR | **Bloqueado** → redirigir a comprar membresía (`/dashboard/membresias`). Aplica también al check-in (no solo a la inscripción por horarios). |
| Alumno con membresía + matrícula vigentes y **tokens disponibles** | Se inscribe a la clase (si no lo está), queda `presente`, consume 1 token (conteo dinámico). |
| Alumno con membresía + matrícula vigentes y **0 tokens** | Se inscribe igual, queda `presente` y se **materializa una deuda de 1 clase** (tabla `debts`). |
| Deuda | Figura en la tarjeta de membresía del alumno como "N clases en deuda". |
| Admin | Ve la lista de alumnos con deuda pendiente y puede marcarla como **pagada** o **condonada** (`/admin/deudas`). |
| Matrícula/membresía | Solo se crean por pago (Flow) o asignación manual del admin. Nunca por auto-insert del usuario. |

## 2. Cambios de base de datos (migración `006_debts_and_rls.sql`)

### 2.1 Tabla `debts`
```sql
CREATE TABLE IF NOT EXISTS public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id),
  session_id uuid REFERENCES public.class_sessions(id),
  class_enrollment_id uuid REFERENCES public.class_enrollments(id),
  amount integer NOT NULL DEFAULT 1 CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagada','condonada')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id)
);
```
Índices: `idx_debts_beneficiary_status` (beneficiary_id, status), `idx_debts_session` (session_id).

### 2.2 RLS `debts`
- `debts_admin_all` → FOR ALL `is_admin()`
- `debts_staff_read` → FOR SELECT `is_staff()`
- `debts_user_read_own` → FOR SELECT `owns_beneficiary(beneficiary_id)`
- No INSERT/UPDATE para usuarios (solo admin/staff y service role).

### 2.3 B-013 — Restringir 3 policies (INSERT solo admin/staff)
- `academy_enrollments.user_insert_enrollment_flow` → `academy_enrollments_insert_admin_staff` (`is_admin() OR is_staff()`).
- `class_enrollments_insert_qr_walkin` → `class_enrollments_insert_qr_admin_staff` (`is_admin() OR is_staff()`).
- `attendance_insert_own_beneficiary` → `attendance_insert_admin_staff` (`is_admin() OR is_staff()`).

> No se rompe ningún flujo legítimo: el check-in QR va por `/api/checkin` (admin client, bypass RLS) y el admin/asistencia opera con sesión admin (`is_admin()` true).

### 2.4 B-014 — Backfill + drop constraint legacy
- Mapear filas `class_enrollments` con `schedule_id NOT NULL AND session_id IS NULL` a la sesión futura más próxima de ese horario (guard `NOT EXISTS` para no chocar con el UNIQUE `(beneficiary_id, session_id)`).
- `DROP CONSTRAINT IF EXISTS class_enrollments_beneficiary_schedule_key`.

## 3. Cambios de código

| Archivo | Cambio |
|---|---|
| `src/app/api/checkin/route.ts` | Agregar gate de matrícula; permitir check-in sin tokens creando deuda (`debts`); resultado incluye `debt: boolean`. |
| `src/app/checkin/[sessionId]/page.tsx` | Aviso "quedó en deuda" por beneficiario en el resultado. |
| `src/components/dashboard/MembershipCard.tsx` | Mostrar deuda materializada pendiente ("N clases en deuda"). |
| `src/lib/supabase/dashboard.ts` | Nuevo helper `getPendingDebts(beneficiaryId)`. |
| `src/app/admin/deudas/page.tsx` | **NUEVO** listado de deudas pendientes + acciones marcar pagada/condonar. |
| `src/components/admin/AdminSidebar.tsx` | Link "Deudas". |
| `documentacion/squema-sql-actualizado.sql` | Espejo 1:1 de la migración 006. |

## 4. Análisis de impacto

- **No rompe** CheckoutModal / Flow: la matrícula se sigue creando server-side (`extendOrCreateEnrollment` con admin client) y por `force-confirm`/`verify` (service role). La policy restringida de `academy_enrollments` no afecta (nadie legítimo inserta por cliente).
- **No rompe** EnrollModal: usa la RPC `enroll_class` (SECURITY DEFINER). La policy restringida de `class_enrollments` no aplica.
- **No rompe** admin/asistencia: `class_enrollments` y `attendance` se insertan con sesión admin (`is_admin()` sigue permitido por `class_enrollments_insert_admin_or_self` y `attendance_insert_admin`).
- **Zona horaria:** todas las comparaciones de fecha usan `getChileToday()` (check-in) y `chile_today()` (SQL). El gate de matrícula usa `.gte('end_date', getChileToday())`.
- **Tokens:** el conteo dinámico (`get_remaining_tokens`) no se toca. La deuda materializada es complementaria.

## 5. Tests (sección H en `scripts/test-flows.mjs`)

- Migración 006: tabla `debts` con columnas, índices, RLS, `DROP CONSTRAINT IF EXISTS` legacy, backfill con guard.
- Las 3 policies restringidas (`is_admin() OR is_staff()`), con nombres nuevos.
- Esquema espejo 1:1 migración↔esquema (tabla debts + policies + sin UNIQUE legacy).
- Check-in route: gate de matrícula, crea deuda cuando `remaining <= 0`, no duplica deuda.
- MembershipCard: usa deuda materializada.

---

## 6. Estado (2026-08-02)

- [x] Migración `006_debts_and_rls.sql` creada (idempotente) + espejo 1:1 en `documentacion/squema-sql-actualizado.sql`.
- [x] `src/app/api/checkin/route.ts`: gate de matrícula + deuda materializada + `debt`/`sin_matricula` en resultado.
- [x] `src/app/checkin/[sessionId]/page.tsx`: avisos de deuda y sin matrícula.
- [x] `src/app/admin/deudas/page.tsx` (listado + acciones) + link en `AdminSidebar.tsx`.
- [x] `MembershipCard.tsx` + `dashboard.ts` (`getPendingDebts`): deuda materializada.
- [x] `scripts/test-flows.mjs` sección H (~25 tests): **156 passed, 0 failed**.
- [x] `npm run build` verde (sin warnings).
- [x] `informe-bugs.md` (B-013, B-014 → RESUELTO) y `plan-fixes-produccion.md` (Fase 10 completada) actualizados.
- [x] Aplicar migración `006_debts_and_rls.sql` en Supabase (usuario).