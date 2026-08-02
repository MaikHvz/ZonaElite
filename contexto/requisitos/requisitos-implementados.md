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

---

## Reglamento Interno (2026-08-02)

- Migración `contexto/migrations/008_reglamento_interno.sql`: tabla `reglamento_interno` (contenido único: `content`, `updated_at`, `updated_by`) + RLS (`reglamento_interno_select_all` FOR SELECT true, `reglamento_interno_admin_all` FOR ALL `is_admin()`).
- Admin: `/admin/reglamento` edita el contenido (textarea; crea la fila si no existe o la actualiza, con `updated_by` = admin). Link en `AdminSidebar`.
- Usuarios: tab "Reglamento" en `DashboardNav` → `/dashboard/reglamento` renderiza el contenido en párrafos (mismo patrón que el blog); si no hay contenido, muestra "aún no publicado".
- Espejo 1:1 actualizado en `documentacion/squema-sql-actualizado.sql`.
- Verificación: suite **168 passed, 0 failed**, build verde. ⚠️ Migración `008` pendiente de aplicar en Supabase.

---

## Navbar admin en móvil (2026-08-02)

- El sidebar del panel admin era `hidden md:flex` y el layout no tenía navegación móvil (el menú no se veía en celulares).
- Fix: botón hamburguesa en el header (`md:hidden`) que abre el sidebar como **drawer deslizable** en móvil (overlay con backdrop, cierra al navegar o con el botón close); en desktop sigue estático y con colapso.
- Los labels del drawer se muestran siempre en móvil aunque el sidebar esté colapsado en desktop.
- Verificación: suite **173 passed, 0 failed** (sección K), build verde.

---

## B-017 — Navbar público no se muestra en el panel admin (2026-08-02)

- **Problema:** el navbar público del sitio se renderizaba en todas las rutas (layout raíz) y, por ser `fixed top-0 z-50`, quedaba encima del header del admin. El ☰ del admin (que abre el drawer de CRUD) quedaba invisible en móvil: el único ☰ visible abría el menú del sitio normal.
- **Fix:** `src/components/Navbar.tsx` usa `usePathname()` y retorna `null` en rutas `/admin`. El header del admin ahora es auto-contenido: perfil enlazado a `/perfil` y botón "Cerrar sesión" (`signOut()`), ya que el navbar público (que proveía logout/Perfil/Mi Panel) ya no está en `/admin`.
- `/dashboard` mantiene el navbar público con su offset `pt-24 md:pt-28` (sin cambios).
- Verificación: suite **178 passed, 0 failed** (sección L), build verde. Sin migración SQL.

---

## B-018 — Feedback de pagos Flow rechazados/anulados/pendientes (2026-08-02)

- **Problema:** Flow devuelve estados `1=pendiente`, `2=pagada`, `3=rechazada`, `4=anulada`. El código solo manejaba `2` y `4`: un pago rechazado (`3`) quedaba `pendiente` en BD y el usuario volvía de Flow sin feedback claro.
- **Fix:**
  - `src/lib/flow.ts`: helper `mapFlowStatus(status)` → `pendiente | pagado | rechazado | cancelado` (única fuente de verdad).
  - `src/app/api/flow/verify/route.ts`: para `status !== 2` actualiza el pago según `mapFlowStatus` y responde `{ status: mapped }` al cliente (`3`→`rechazado`, `4`→`cancelado`, `1`→`pendiente`).
  - `src/app/api/flow/confirmation/route.ts`: el callback server marca `rechazado`/`cancelado` en BD cuando el pago no fue aprobado (ya no lo deja pendiente); nunca crea membresía si no es `status 2`.
  - `src/components/PurchaseSuccessBanner.tsx`: `PurchaseFailedBanner` acepta `title`/`description`; nuevo `PurchasePendingBanner` (ámbar).
  - `src/app/dashboard/pagos/page.tsx`: banners diferenciados por resultado (`rechazado`, `cancelado`, `pendiente`) — aplica a membresías, inscripciones y cualquier pago (mismo flujo verify).
  - `src/app/admin/ventas/page.tsx`: filtro de estado "Rechazado" + tarjeta de conteo de rechazados.
- Sin migración SQL (`payments.status` es `text` sin CHECK; `StatusBadge` ya soportaba `rechazado`). Esquema actualizado solo en el comentario de documentación.
- Verificación: suite **195 passed, 0 failed** (sección M), build verde. Ver `contexto/requisitos/feedback-pagos-flow.md`.
