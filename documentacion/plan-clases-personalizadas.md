# Plan de implementación — Clases Personalizadas (Módulo Independiente)

> **Estado:** ✅ IMPLEMENTADO Y VERIFICADO EN PRODUCCIÓN. Migración 009 aplicada y 1:1 confirmada en Supabase; suite 244 tests A–P en verde; `npm run build` OK; **pago Flow sandbox probado end-to-end (2026-08-04)**: pago `pagado` → pack `activa` con fechas Chile correctas → notificación `approved` → clase visible en la tarjeta de membresía del alumno.

## Objetivo
Habilitar planes y packs de **clases personalizadas** como entidad 100% desacoplada de membresías, tokens, inscripciones y check-in, con compra vía Flow y consumo manual en admin. El flujo de membresías y la pasarela quedan intactos (análisis de impacto aprobado, ver requisito).

## Reglas de no regresión (por fase)
- Suite completa en verde: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` (hoy 244 tests A-P).
- `npm run build` sin errores.
- Fechas con `getChileToday()`/`addDaysChile()` (`src/lib/dates.ts`), nunca `toISOString().split("T")[0]`.
- No tocar `CheckoutModal.tsx`, `EnrollModal.tsx`, `AssignMembershipModal.tsx`, `flow.ts`, `dates.ts`.

---

## Fases

### Fase 0 — Base de datos (SQL + RLS)
- [x] Crear migración idempotente (`contexto/migrations/009_personalized_plans_packs.sql`) con:
  - `personalized_plans (id, name, price, total_classes, validity_days, features jsonb, active, created_at)`.
  - `personalized_packs (id, beneficiary_id FK, plan_id FK, purchased_by, payment_id FK, start_date, end_date, total_classes, used_classes DEFAULT 0, status CHECK ('activa','agotada','vencida','cancelada'), created_at)`.
  - Índices: `idx_personalized_packs_beneficiary`, `idx_personalized_plans_active`. **Sin índice único de packs activos**.
  - RLS: planes `select_all` + `admin_write`; packs `select_own_or_admin` (usando `owns_beneficiary`) + `admin_write`.
- [x] Aplicar en Supabase (SQL Editor). **✅ Verificado 1:1 contra la BD real (2026-08-04):** tablas, columnas/tipos/defaults (OpenAPI), FKs (`23503`), CHECK `personalized_packs_status_check` (`23514`), RLS (4 policies en `pg_policies`), índices (`idx_personalized_packs_beneficiary`, `idx_personalized_plans_active` en `pg_indexes`), `owns_beneficiary` (RPC OK). Sin residuos de prueba.
- [x] Reflejar el DDL 1:1 en `documentacion/squema-sql-actualizado.sql`.
- [x] Suite: sección P con contrato de esquema/RLS + índice.

### Fase 1 — Backend de pago (Flow)
- [x] `create-order/route.ts`: aceptar `personalizedPlanId` (excluyente de `planId`); concepto `Clase Personalizada <name>`; `totalAmount = price`; mantener dedup 5 min, `commerceOrder` único y verificación B-007; incluir `beneficiary_id` en el pago.
- [x] `src/lib/flow-helpers.ts`: helper `confirmPersonalizedPack(admin, paymentId, userId)` — idempotente, extrae plan del concepto (ilike), resuelve beneficiario, inserta pack con `start_date = getChileToday()` y `end_date = addDaysChile(...)`, linkea `payment_id`.
- [x] Rama nueva en los 3 routes (tras `markPaymentAsPaid`): `confirmation/route.ts`, `verify/route.ts`, `force-confirm/route.ts` — regex `^Clase Personalizad[ao]/i`, `assignedSomething`, error → `notifyPaymentWithoutMembership`.
- [x] Notificación `approved` reutilizando `notifyUserPaymentStatus`.
- [x] Suite: sección P — no-matcheo (pago `Clase Personalizada X` NO crea membresía ni cancela activas), idempotencia, 2 packs en paralelo sin cancelarse.

### Fase 2 — Panel Admin (`admin/membresias`)
- [x] Sub-tabs "Planes | Membresías | Personalizadas".
- [x] Tab Planes: botón adicional "Crear Plan Personalizado" (campos: nombre, precio, clases, días de duración, features agregables); `handleSave` con modo `tipo`.
- [x] Tab Personalizadas: listado con filtros, acciones **Consumir clase** (`used_classes+1` → `agotada`) y **Cancelar**.
- [x] Suite: contratos de las acciones admin (consumo/cancelación idempotentes).

### Fase 3 — Dashboard del usuario
- [x] `MembershipCard.tsx`: chip "X clases personalizadas disponibles".
- [x] `dashboard/membresias/page.tsx`: sección "Mis Clases Personalizadas" (cards por beneficiario Yo + cargas, con estado/vigencia/usadas-total y botón Comprar).
- [x] `PersonalizedCheckoutModal.tsx` (nuevo): selector de carga + plan + monto; `doCreateOrder` con `{ personalizedPlanId, beneficiaryId }`; manejo 401/timeout/`already_paid`.
- [x] Suite: sección P — fetch de planes/packs del dashboard.

### Fase 3b — Landing pública: sección "¿Necesitas Clases Personalizadas?"
- [x] `src/components/PersonalizedPlans.tsx` (nuevo, desacoplado de `Memberships.tsx`): sección **debajo de las membresías normales** en `src/app/page.tsx` (tras `<Memberships />`).
- [x] Título "¿Necesitas Clases Personalizadas?" siguiendo la línea de diseño (pill label, headline uppercase, subtítulo) y wrapper `py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto`.
- [x] Fetch de `personalized_plans` (`active = true`, `order("price")`); si no hay planes → `return null`.
- [x] Cards estilo membresía regular (bg-surface-container-low, border, `check_circle text-primary/60`) mostrando nombre, precio, total de clases, días de vigencia y `features`; CTA "Comprar ahora" (logueado → `PersonalizedCheckoutModal`) / "Seleccionar" (anónimo → `/auth`).
- [x] Cero cruce con `membership_plans`; `Memberships.tsx` sin cambios.
- [x] Verificación: build + revisión visual.

### Fase 4 — End-to-end y build
- [x] Prueba manual sandbox Flow: compra pack → callback → pack activo con fechas Chile correctas. **✅ Probado 2026-08-04** (pack `e46216eb` → `start 2026-08-04` / `end 2026-09-03`, `status activa`, `used 0`).
- [x] 2 packs en paralelo no se cancelan (sin índice único; cubierto por suite G/P); consumo manual → `agotada`; notificación `approved` **✅ verificada en `user_notifications`**.
- [x] Suite completa en verde (244 tests A–P) + `npm run build` OK.

### Fase 5 — Documentación post-implementación (SOP Fase 4)
- [x] `documentacion/flujo-modulos.md`: sección del módulo.
- [x] `contexto/requisitos/requisitos-implementados.md`: entrada nueva con migración, verificación y estado.
- [ ] `contexto/informe-bugs.md` si aplica; `contexto/BRAIN.md` (regla/arquitectura). **⚠️ No aplica aún** (sin bugs nuevos).
- [x] Confirmar `documentacion/squema-sql-actualizado.sql` = BD en producción. **✅ Verificación en vivo 2026-08-04: coincide con Supabase.**

---

## Seguimiento de progreso

| Fase | Descripción | Estado | Fecha | Pruebas |
|------|-------------|--------|-------|---------|
| 0 | BD: `personalized_plans` + `personalized_packs` + RLS + índices | ✅ Hecha y verificada 1:1 en Supabase | 2026-08-04 | Sección P + verificación en vivo |
| 1 | Backend pago: create-order + `confirmPersonalizedPack` + 3 routes | ✅ Hecha | 2026-08-04 | Sección P (no-matcheo, idempotencia) |
| 2 | Admin: sub-tabs + CRUD planes personalizados + consumo/cancelar packs | ✅ Hecha | 2026-08-04 | Sección P (admin) |
| 3 | Dashboard: chip MembershipCard + "Mis Clases Personalizadas" + modal | ✅ Hecha | 2026-08-04 | Sección P (dashboard) |
| 3b | Landing: sección "¿Necesitas Clases Personalizadas?" debajo de las membresías | ✅ Hecha | 2026-08-04 | Build + visual |
| 4 | E2E sandbox + suite completa + build | ✅ Hecha (pago real probado, notificación `approved` verificada) | 2026-08-04 | 244 A–P + pago real |
| 5 | Docs post-implementación (flujo-modulos, requisitos-implementados, BRAIN) | ✅ Hecha | 2026-08-04 | Revisión manual |

**Checklist de finalización de cada fase:** suite en verde + `npm run build` OK + esquema documentado 1:1 (si toca BD) + nota en esta tabla actualizada.
