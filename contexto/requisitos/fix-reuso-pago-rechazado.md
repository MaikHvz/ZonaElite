# Fix: no reutilizar token Flow rechazado/anulado al comprar de nuevo (B-019)

## Estado
- **Fecha:** 2026-08-02
- **Tipo:** Bug fix / Pago Flow
- **B-019**

## Requisito / Problema
Tras pagar con una tarjeta que **rechaza el pago** (sandbox), al intentar comprar de nuevo dentro de los 5 min el botón "Pagar con Flow" quedaba en "Procesando..." o enviaba al usuario a Flow con un **token ya rechazado** (página de error de Flow).

## Causa raíz
`src/app/api/flow/create-order/route.ts` — bloque "Prevent duplicate pending payments (5 min window)" (líneas 169-202):
- Busca un pago del usuario con `status='pendiente'` creado hace < 5 min.
- Si existe, llama `verifyFlowPayment(token)` pero **solo maneja `status === 2`** (lo marca pagado).
- Para `status === 3` (rechazada) o `4` (anulada) cae al final del bloque y **reutiliza el token muerto**, redirigiendo al usuario a `https://sandbox.flow.cl/payment?token=<rechazado>` → Flow muestra error.
- Si `verifyFlowPayment` se cuelga (Flow lento), el route no responde y el botón queda en "Procesando..." indefinidamente (el cliente no tiene timeout).

## Nota sobre "sesión perdida" (análisis del log de Vercel)
- Los `304` a `/dashboard`, `/admin`, `/perfil`, `/dashboard/notificaciones` son **Not Modified** (cache del navegador), no errores de auth.
- El `303` a `/auth` es el redirect **normal** del middleware `src/lib/supabase/middleware.ts:53-57`: cuando un usuario YA autenticado visita `/auth`, se le redirige a `/dashboard`. No indica sesión perdida.
- Conclusión: la sesión **no se perdió**; el problema real es la reutilización del token rechazado en `create-order`.

## Flujo de implementación propuesto
1. **`src/app/api/flow/create-order/route.ts`** — en el bloque `existingPending` usar `mapFlowStatus`:
   - `status 2` (ya pagado, race del callback) → marcar `pagado` y responder `{ status: "already_paid", token }` para que el cliente muestre el éxito.
   - `status 3` / `4` → marcar el pago `rechazado`/`cancelado` en BD y **NO reutilizar** → continuar y crear una orden nueva (flujo normal de abajo).
   - `status 1` (sigue pendiente) → reutilizar el mismo token (comportamiento actual).
   - Error de `verifyFlowPayment` → mantener el comportamiento actual (reutilizar como pendiente).
2. **`src/components/CheckoutModal.tsx`** — resiliencia del botón:
   - Refactor de `handlePay`/`handleConfirmOverwrite` a un helper único `doCreateOrder` con `AbortController` timeout (~20 s) para que el botón **nunca** quede en "Procesando..." si el servidor no responde.
   - Manejar `data.status === "already_paid"` → redirigir a `/dashboard/pagos?token=...` (muestra el modal de éxito).
   - Mensaje específico para `401` ("Tu sesión expiró. Inicia sesión nuevamente") y para timeout.

## Impacto
- No toca BD (sin migración SQL), ni fechas, ni RLS, ni `confirmAndCreateMembership`.
- El flujo de recompra tras rechazo ahora siempre genera un **token nuevo** en Flow.
- `CheckoutModal` deja de quedar bloqueado ante respuestas lentas.

## Verificación
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` (sección M ampliada: scan de `create-order` + `CheckoutModal`).
- `npm run build` sin errores.

## Nota producción (pagos reales)
- `mapFlowStatus` normaliza el status de Flow (`number | string`): si la API real devuelve `"3"`/`"4"` como string, se mapean a `rechazado`/`cancelado` y **no** caen en `pendiente` (que reutilizaría el token muerto con dinero real).
