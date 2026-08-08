# Pago Manual por Transferencia — Modo Manual (alternativa a Flow)

## Estado
- **Fecha:** 2026-08-08
- **Tipo:** Feature (modo de pago alternativo al online)
- **Estado:** ✅ **IMPLEMENTADO — fases 0-8 completadas.** Suite secciones A-T en verde (408 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Migración `013_manual_payment_mode.sql` creada y espejada 1:1 en `documentacion/squema-sql-actualizado.sql`; **pendiente aplicar en Supabase (SQL Editor)**. Incluye feedback admin (badge en Ventas + banner con CTA) vía `PendingTransferProvider`/`PendingTransferBanner`.

## Requisito
Flow.cl **no es legal para la venta de boletas** en el contexto del negocio. Se agrega un **modo de pago manual por transferencia** como alternativa: el admin activa este modo **por tipo de producto** (Membresías, Clases Personalizadas, Inscripciones). Cuando un tipo está en modo manual, el checkout de ese producto **no inicia Flow**: muestra los datos bancarios de la academia y un formulario para que el usuario **envíe el comprobante (voucher)** de su transferencia. El admin recibe un **correo + notificación in-app**, revisa el comprobante en `/admin/ventas` (tab "Solicitudes") y **aprueba o rechaza** la solicitud. Al aprobar, se asigna el beneficio con las mismas reglas que Flow (sustitución de membresía activa, apilamiento de packs, extensión de inscripción). Al rechazar, el pago queda `rechazado` con una nota visible para el usuario.

### Decisiones arquitectónicas (cerradas con el usuario)
- **Toggle por tipo de producto**, no global: `academy_settings.payment_settings` es un jsonb con `memberships`, `personalized` y `enrollment`, cada uno en `"online" | "manual"`, más un objeto `bank` con los datos de la cuenta.
- **`payments` se reutiliza**: la lista de solicitudes es `payments` con `method='transferencia' AND status='pendiente'`. No se crea tabla nueva.
- **Vigencia de membresía aprobada desde la fecha de aprobación**: `start_date = getChileToday()` en el momento en que el admin confirma (no cuando el usuario transfirió).
- **Referencia de pago: ambas** — código `REF-ZE-xxxxxx` (principal) + RUT del usuario (opcional; se agrega `profiles.rut` nullable).
- **Voucher**: imagen (JPG/PNG/WebP/GIF) o PDF, máx 5MB, subido a storage bucket `public` (mismo `uploadImage`/bucket que el resto). El correo al admin **enlaza el voucher**, no lo adjunta.
- **Correo al admin**: a **todos los `profiles` con `role_id=1`**; si no hay emails, fallback a `process.env.SMTP_USER`. Envío best-effort (try/catch), patrón `sendWelcomeEmail`.
- **No romper Flow**: los routes `create-order`, `confirmation`, `verify`, `force-confirm` y las helpers de asignación quedan intactos. El modo manual solo agrega una guarda en `create-order` y **reutiliza** las mismas helpers de Flow para la aprobación.
- **Fechas SIEMPRE** con `getChileToday()` / `addDaysChile()` de `src/lib/dates.ts` (regla #16 del BRAIN). Nunca `toISOString().split("T")[0]`.

### Roles que interactúan
| Rol | Interacción |
|-----|-------------|
| Admin (role_id=1) | Activa/desactiva modo manual por tipo en Configuración; configura datos bancarios; revisa solicitudes en `/admin/ventas` (tab "Solicitudes"); aprueba o rechaza con nota; ve el voucher. |
| Alumno (role_id=4) | En el checkout de un producto en modo manual, ve los datos bancarios, ingresa su RUT (opcional) y sube el voucher. Ve el estado "En revisión" en su dashboard/pagos. |
| Tutor | Idem (compra para su carga). |
| Instructor/Recepción | Ninguno (aprobación es solo admin). |
| Visitante anónimo | Nada nuevo; los precios/planes se ven igual. Si está en modo manual, el botón del checkout lo lleva a `/auth`. |

---

## Contexto técnico (puntos de anclaje verificados)
- `create-order/route.ts` (`src/app/api/flow/create-order/route.ts`): recibe `{planId, beneficiaryId, includeEnrollment, enrollmentPlanId}` (y `personalizedPlanId` para packs), arma `totalAmount`/`conceptParts`, hace dedup de pendientes (5 min) y genera `commerceOrder = crypto.randomUUID()`. El insert a `payments` se hace con **admin client** (service role → bypass RLS). **Guardas por modo manual se agregan aquí** antes de crear la orden.
- `confirmAndCreateMembership` (`src/lib/flow-helpers.ts`): dedup 10 min, cancela membresías activas, crea con `addDaysChile`. **Se refactoriza** a `createMembershipForPayment` con override de planId (para distinguir plan miembro vs plan de inscripción), conservando el comportamiento para Flow.
- `confirmPersonalizedPack` (`src/lib/flow-helpers.ts`): crea el pack con `addDaysChile`, **apila** (no cancela nada).
- `extendEnrollment` / `notifyUserPaymentStatus` (`src/lib/flow-helpers.ts`): se reutilizan en la aprobación (mismo resultado visible para el usuario que con Flow).
- `src/lib/email.ts`: **nodemailer** (SMTP_GMAIL, env `SMTP_HOST/PORT/USER/PASS/FROM`). Único uso actual: `sendWelcomeEmail` en `create-user/route.ts` (patrón best-effort). Se agrega `sendTransferRequestEmail`.
- `src/lib/supabase/admin.ts`: `getAdminClient()` (service role) para el query de emails de admins y la asignación en la aprobación.
- `src/lib/supabase/dashboard.ts`: `PaymentData` (línea 70) con `receipt_url`, `method`, `status`; `getUserPayments`/`getProfileForEdit`/`updateProfile` (patrón del perfil). Se extiende el tipo si se agregan campos nuevos.
- `src/lib/supabase/storage.ts`: `uploadImage(file, folder)` valida JPG/PNG/WebP/GIF ≤5MB y sube al bucket `public`. Se extiende para aceptar **PDF** (`application/pdf`) en la ruta del voucher (la validación de imagen actual la rechazaría).
- RLS: el admin client bypassa; el browser client respeta. `is_admin()` y `owns_beneficiary(id)` ya existen en el squema.
- `academy_settings` (squema línea 137) es tabla **singleton** con RLS `select_all` / `admin_write` — ideal para el toggle.
- `payments` (squema línea 299) ya tiene `method`, `status`, `receipt_url`, `beneficiary_id`, `include_enrollment`, `enrollment_plan_id`, `commerce_order`. RLS: select propio/admin, insert/update solo admin (el submit va por API server con admin client).
- `profiles` (squema línea 123) **NO** tiene `rut` (solo `dependents.rut` existe); se agrega nullable al titular.

---

## Flujo de implementación

### Fase 0 — Documento de requisito (este archivo)

### Fase 1 — Base de datos: `contexto/migrations/013_manual_payment_mode.sql`
Idempotente (patrón 009/010). Aplicada por el usuario en SQL Editor (sin service key local). Espejo en `documentacion/squema-sql-actualizado.sql`.

```sql
-- 1. Toggle y datos bancarios en academy_settings (tabla singleton)
ALTER TABLE public.academy_settings
  ADD COLUMN IF NOT EXISTS payment_settings jsonb;

-- Default para la fila singleton existente: todo online, sin datos bancarios.
UPDATE public.academy_settings
SET payment_settings = '{
  "memberships": "online",
  "personalized": "online",
  "enrollment": "online",
  "bank": null
}'::jsonb
WHERE payment_settings IS NULL;

-- 2. payments: campos de solicitud de transferencia
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS membership_plan_id uuid REFERENCES public.membership_plans(id),
  ADD COLUMN IF NOT EXISTS personalized_plan_id uuid REFERENCES public.personalized_plans(id),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note text;

-- 3. profiles.rut (nullable, informativo)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rut text;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_payments_manual_pending
  ON public.payments (method)
  WHERE method = 'transferencia' AND status = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by ON public.payments (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_payments_membership_plan ON public.payments (membership_plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_personalized_plan ON public.payments (personalized_plan_id);
```

Notas:
- `membership_plan_id` apunta a `membership_plans(id)` (plan miembro); `personalized_plan_id` a `personalized_plans(id)` (pack); la inscripción reutiliza `enrollment_plan_id` ya existente en `payments`.
- El app resuelve qué rama asignar según `membership_plan_id` / `personalized_plan_id` / `include_enrollment`.
- RLS no cambia: las políticas de `payments` ya cubren lectura del propio usuario/admin y escritura solo admin.

### Fase 2 — Configuración y perfil
- `src/lib/payment-settings.ts`:
  - `getPaymentSettings()` (server): lee `academy_settings.payment_settings` y mergea defaults (`{ memberships:'online', personalized:'online', enrollment:'online', bank:null }`).
  - `getPublicPaymentSettings()`: expone lo necesario al checkout del usuario (modo por tipo + datos bancarios).
  - `updatePaymentSettings()`: escribe solo admin (PUT /api/admin/settings).
- `/admin/configuracion`: tarjeta "Modo de Pago" con 3 switches (Membresías / Clases Personalizadas / Inscripciones) + formulario de datos bancarios (`bank_name`, `account_type`, `account_number`, `account_holder`, `rut`, `email`).
- `/perfil`: campo RUT (opcional) vía `getProfileForEdit`/`updateProfile`.

### Fase 3 — APIs
- `POST /api/payments/transfer` (`route.ts` nuevo):
  1. Lee `{ productType, planId, beneficiaryId, includeEnrollment, enrollmentPlanId, rut?, fileName, fileBase64 }` (voucher puede ir en el body o subirse por storage primero).
  2. Valida: producto en modo manual (re-lee settings con admin client), plan activo, beneficiario propio, archivo ≤5MB y tipo permitido (imagen o PDF).
  3. Sube el voucher a storage `public/vouchers/<paymentId|uuid>.<ext>` (reutiliza patrón `uploadImage`, extendido a PDF).
  4. Inserta `payments` con admin client: `method='transferencia'`, `status='pendiente'`, `commerce_order='REF-ZE-'+6-char random upper`, `membership_plan_id` o `personalized_plan_id`, `include_enrollment`, `enrollment_plan_id`, `receipt_url`, `beneficiary_id`, `user_id`.
  5. Notifica in-app a staff (tabla `notifications`, patrón existente) y envía `sendTransferRequestEmail` a todos los admins (fallback SMTP_USER).
  6. Devuelve `{ ok:true, paymentId }`.
- `POST /api/payments/review` (`route.ts` nuevo):
  - Body: `{ paymentId, action: 'aprobar'|'rechazar', adminNote? }`.
  - Verifica admin (`is_admin()`), pago en `pendiente` y `method='transferencia'`.
  - **Aprobar**: transacción → marca `status='pagado'`, `paid_at=now()`, `reviewed_by=auth.uid()`, `reviewed_at=now()`; asigna con las helpers refactorizadas:
    - Membresía: `createMembershipForPayment` con `start_date = getChileToday()` (vigencia desde aprobación).
    - Pack: `confirmPersonalizedPack` (apila).
    - Inscripción: `extendEnrollment`.
    - `notifyUserPaymentStatus(admin, payment, 'pagado')` (mismo resultado que Flow).
  - **Rechazar**: marca `status='rechazado'`, `reviewed_by`, `reviewed_at`, `admin_note`; `notifyUserPaymentStatus(..., 'rechazado')` con la nota.
- Guarda en `create-order/route.ts`: si el tipo del producto está en `manual` → `400 { error: 'El pago online está desactivado para este producto. Usa transferencia.' }`.

### Fase 4 — UI usuario
- `TransferPaymentStep`: muestra datos bancarios (con `copy`), campo RUT opcional, input de archivo (imagen o PDF), vista previa, botón "Enviar solicitud". Validación client (≤5MB, tipo).
- `CheckoutModal` y `PersonalizedCheckoutModal`: si el tipo está en modo manual, **omiten Flow** y muestran `TransferPaymentStep` directamente (el botón "Pagar con Flow" pasa a "Pagar por transferencia"). `EnrollModal` idem cuando `enrollment='manual'`.
- `PaymentRow` (dashboard/pagos usuario): para `method='transferencia'` y `status='pendiente'` muestra estado **"En revisión"** con el voucher visible; `rechazado` muestra la nota del admin y permite reintentar.

### Fase 5 — Admin (tab "Solicitudes" en `/admin/ventas`)
- Filtro/tab `Solicitudes` = `payments` `method='transferencia'` `status='pendiente'` (y opcional histórico por estado).
- Cada fila: usuario, concepto, monto, fecha, referencia REF-ZE, RUT, voucher (imagen o PDF en modal), botones **Aprobar** / **Rechazar** (con nota opcional).
- Acciones llaman `POST /api/payments/review`; refrescan la lista.
- **Feedback en todo el panel admin** (feedback 100%):
  - `PendingTransferProvider` (`src/components/admin/PendingTransferProvider.tsx`): cuenta las transferencias `pendiente` vía browser client con poll cada 30s + refresco al ganar foco, expone `usePendingTransferCount()`.
  - `AdminSidebar`: badge rojo con el contador en el link **Ventas** (solo si > 0).
  - `PendingTransferBanner` (`src/components/admin/PendingTransferBanner.tsx`): banner grande en `admin/layout` (bajo el header) con CTA "Revisar ahora" → `/admin/ventas?tab=solicitudes`.
  - `ventas/page.tsx`: el tab inicial se lee de `?tab=solicitudes` (URLSearchParams) para abrir directo en la lista.

### Fase 6 — Notificaciones usuario / dashboard
- `notifyUserPaymentStatus` ya cubre el aviso al aprobar/rechazar (se reutiliza).
- Dashboard usuario: mostrar solicitudes pendientes y su estado ("En revisión" / "Aprobada" / "Rechazada").

### Fase 7 — Tests y build
- Sección **R** en `scripts/test-flows.mjs`:
  - Toggle por tipo: `payment_settings` leído por server y expuesto en público.
  - Guarda: `create-order` rechaza cuando el tipo está en `manual`.
  - Transferencia: inserta pago `pendiente` `method='transferencia'` con `commerce_order` `REF-ZE-*`.
  - Aprobar: asigna membresía con `start_date=getChileToday()`, sustitución correcta, pack apila, inscripción extiende.
  - Rechazar: estado `rechazado` + `admin_note` visible.
  - Regresiones Flow: suite existente (A–Q) sigue verde.
- `npx tsc --noEmit` limpio; `npm run build` OK.

### Fase 8 — Documentación
- `documentacion/flujo-modulos.md`: nueva sección "Pago manual por transferencia".
- `documentacion/requisitos-implementados.md`: mover este requisito a implementado (con fecha).
- `contexto/BRAIN.md`: actualizar estructura de datos, flujos y reglas si aplica.
- `contexto/plan.md` (o su equivalente): marcar fases completadas.

---

## Análisis de impacto

### Qué NO se toca
- `confirmation`, `verify`, `force-confirm` (routes Flow) — intactos.
- `enroll_class`, `checkin`, `get_remaining_tokens`, `idx_memberships_one_active` — intactos.
- `src/lib/dates.ts`, `membership-status.ts`, asistencia/QR — intactos.
- RLS de `payments` — intacto (ya cubre select propio/admin + write admin).

### Qué cambia
| Área | Cambio |
|------|--------|
| `academy_settings` | + columna `payment_settings jsonb` |
| `payments` | + `membership_plan_id`, `personalized_plan_id`, `reviewed_by`, `reviewed_at`, `admin_note` |
| `profiles` | + `rut text` (nullable) |
| `flow-helpers.ts` | refactor `confirmAndCreateMembership` → `createMembershipForPayment` (override planId) |
| `create-order/route.ts` | guarda por modo manual |
| `storage.ts` | aceptar PDF para vouchers |
| `email.ts` | + `sendTransferRequestEmail` |
| Checkout modals | paso manual `TransferPaymentStep` |
| `/admin/ventas` | tab "Solicitudes" |
| `/admin/configuracion` | tarjeta modo de pago + datos bancarios |
| `/perfil` | campo RUT |
| Dashboard/pagos usuario | estado "En revisión" + nota de rechazo |

### Riesgos
- **Concurrencia de aprobación**: dos admins aprueban el mismo pago → la transacción con `SELECT ... FOR UPDATE` sobre `payments` evita doble asignación (mismo patrón B-006).
- **PDF en storage**: `storage.ts` hoy solo permite imágenes; la extensión debe ser acotada (`application/pdf`, `image/*` de la lista actual).
- **RUT duplicado/opcional**: se guarda como texto informativo; no se valida contra el RUT de `dependents`.
- **Vigencia de inscripción**: si `extendEnrollment` usa `getChileToday()`, la aprobación tardía no pierde días (coherente con la decisión de membresía).
