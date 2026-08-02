# Feedback de pagos Flow: rechazados, anulados y pendientes (B-018)

## Estado
- **Fecha:** 2026-08-02
- **Tipo:** Bug fix / UX (pagos Flow)
- **B-018**

## Requisito / Problema
En sandbox, al probar con una tarjeta que **rechaza el pago**, el usuario no recibe feedback claro de que el pago NO se realizó, y la membresía/pago queda con estado **pendiente** en vez de **rechazada**. Aplica para membresías, inscripciones y cualquier pago por Flow.

## Causa raíz
- Flow devuelve en `payment/getStatus` los estados: `1 = pendiente`, `2 = pagada`, `3 = rechazada`, `4 = anulada` (fuente: docs oficiales de Flow).
- `src/app/api/flow/verify/route.ts` solo maneja `status === 2` (pagado) y `status === 4` (cancelado). El `status === 3` (rechazado) cae al `else` y devuelve `fullPayment.status` (sigue siendo "pendiente"), **sin actualizar la BD**.
- `src/app/api/flow/confirmation/route.ts` (callback server) tampoco actualiza el pago cuando `status !== 2` (solo loguea y retorna).
- En el cliente, `/dashboard/pagos` mapea todo resultado distinto de "pagado" a un banner genérico de fallo, sin distinguir rechazado / anulado / pendiente.

## Flujo de implementación propuesto
1. **`src/lib/flow.ts`** — helper `mapFlowStatus(status)` para traducir el estado de Flow a nuestro estado de pago (`pendiente | pagado | rechazado | cancelado`). Evita duplicar el mapeo entre rutas y permite tests unitarios.
2. **`src/app/api/flow/verify/route.ts`** — manejar explícitamente:
   - `status === 3` → actualizar pago a `rechazado` y devolver `{ status: "rechazado" }`.
   - `status === 4` → actualizar pago a `cancelado` (ya existía).
   - `status === 1` (o desconocido) → devolver `{ status: "pendiente" }` (el pago puede completarse vía callback asíncrono).
3. **`src/app/api/flow/confirmation/route.ts`** — cuando `status !== 2`, actualizar el pago según `mapFlowStatus` (rechazado/cancelado) y retornar (no crear membresía).
4. **`src/components/PurchaseSuccessBanner.tsx`** — `PurchaseFailedBanner` acepta props opcionales `title`/`description` para mensajes específicos.
5. **`src/app/dashboard/pagos/page.tsx`** — feedback diferenciado por resultado de `/api/flow/verify`:
   - `pagado` → modal de éxito (existente).
   - `rechazado` → banner rojo "Pago rechazado: no se realizó ningún cargo, intenta nuevamente".
   - `cancelado` → banner rojo "Pago anulado/cancelado".
   - `pendiente` → banner ámbar "Tu pago está pendiente, se confirmará cuando Flow lo procese".
   - `not_found`/error → banner genérico (existente).
6. **`src/app/admin/ventas/page.tsx`** — agregar filtro de estado **Rechazado** para que el admin pueda ver los pagos rechazados.

## Impacto
- Sin cambios de BD: `payments.status` es `text` sin CHECK constraint; "rechazado" ya existe en `StatusBadge`. Solo se actualiza la documentación del esquema (comentario de status).
- No toca `CheckoutModal`, ni fechas (no usa helpers de fecha), ni el check-in, ni RLS.
- La creación de membresía/inscripción solo ocurre con `status === 2` (pagado), sin cambios: un pago rechazado nunca genera membresía.
- En flujos asíncronos (prepago/efectivo) la redirección puede llegar antes que el callback; el estado "pendiente" ahora informa correctamente.

## Verificación
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` (nueva sección M).
- `npm run build` sin errores.
