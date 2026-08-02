# Requisitos implementados

> **Propósito:** Registro acumulado de requisitos implementados en el proyecto.
> Cada feature/fix agrega su sección; el estado vigente siempre se refleja en código + esquema (`documentacion/squema-sql-actualizado.sql`).

---

## Correcciones de estabilidad 2026-08 (cierre del plan)

> Corresponde a las Fases 1–10 de `plan-fixes-produccion.md`. Ver `informe-bugs.md` (B-001 … B-015) para el detalle de cada bug y `migrations/` para el SQL aplicado.

| Fase | Alcance | Bugs | Migración | Estado |
|------|---------|------|-----------|--------|
| 1 | Vencimiento dinámico de membresías (estado efectivo por fecha, DST-safe con `getChileToday()`) | B-001, B-003, B-009 | — | ✅ Aplicado |
| 2 | Atomicidad BD + retry idempotente (SQLSTATE 23505); 1 sola membresía activa | B-002, B-015 | `002_unique_active_membership.sql` | ✅ Aplicada |
| 3 | `chile_today()` en BD + RLS regenerada | B-005 | `003_chile_today_rls.sql` | ✅ Aplicada |
| 4 | Inscripción admin deduplicada `extendOrCreateEnrollment` + RPC `enroll_class` (capacidad server-side) | B-004, B-006 | `004_enroll_class_rpc.sql` | ✅ Aplicada |
| 5 | Verificación de `commerceOrder` en callbacks Flow (firma HMAC intacta) | B-007 | — | ✅ Aplicado |
| 6 | Alerta admin cuando pago no genera membresía (`notifyPaymentWithoutMembership`) | B-008 | — | ✅ Aplicado |
| 7 | Capacidad de clase server-side (RPC `enroll_class`, `SELECT … FOR UPDATE`, códigos de error) | B-006 | `004_enroll_class_rpc.sql` | ✅ Aplicada |
| 8 | Conteo de tokens atado a la membresía específica (ventana por `created_at`/`end_date`, dinámico) | B-010, B-011 | `005_tokens_membership_window.sql` | ✅ Aplicada |
| 9 | Esquema documentado en espejo 1:1 (incluye `user_notifications`) + RPCs consolidadas | B-011, B-012 | — | ✅ Aplicado |
| 10 | **Deudas por check-in QR sin tokens** + RLS restringidas a admin/staff + drop del constraint legacy | B-013, B-014 | `006_debts_and_rls.sql` | ✅ Aplicada |

### Cambios de comportamiento relevantes (Fase 10)

- **Check-in por QR** (`/api/checkin`): ya **no** se rechaza a un alumno sin tokens — queda `presente` y se **materializa una deuda de 1 clase** (tabla `debts`, `status='pendiente'`, 1 fila por beneficiario/sesión, sin duplicar).
- **Gate de matrícula:** sin `academy_enrollments` activa (`end_date >= chile_today()`) el check-in se **bloquea** (`sin_matricula`) y redirige a comprar membresía. Sin membresía activa: `sin_membresia`.
- **Admin deudas** (`/admin/deudas`): listado agrupado por beneficiario, filtros Pendientes/Resueltas/Todas, acciones **marcar pagada / condonar** (individuales y por grupo) que setean `resolved_at` + `resolved_by`.
- **MembershipCard**: el indicador "N clases en deuda" usa deuda **materializada** (`getPendingDebts`), no el saldo negativo derivado de tokens.
- **RLS**: auto-inscripción, walk-in QR y auto-asistencia por REST directo quedaron restringidas a `is_admin() OR is_staff()`. El flujo legítimo sigue por `/api/checkin` (admin client) y la RPC `enroll_class` (SECURITY DEFINER).

### Verificación

- Suite: **156 passed, 0 failed** (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs`).
- `npm run build`: verde sin warnings.

---

## B-016 — Columna `location_url` en `events` (2026-08-02)

- Migración `contexto/migrations/007_add_events_location_url.sql`: `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;` (idempotente).
- Espejo 1:1 actualizado en `documentacion/squema-sql-actualizado.sql` (`location_url text,` en el DDL de `events`).
- La UI (admin/eventos), `EventCard` y `/eventos/[id]` ya usaban la columna; ahora existe en BD.
- Verificación: suite **161 passed, 0 failed**, build verde.
