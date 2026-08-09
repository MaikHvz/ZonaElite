# Tienda de productos: carrito, checkout Flow, stock con reserva y ventas en dashboards

## Estado
- **Fecha:** 2026-08-09
- **Tipo:** Feature nueva (v1.4.0)
- **Plan aprobado por el usuario** (2026-08-09): "agrega lo que estimes pertinente para que el sistema sea profesional en el tema de compras de productos y procede."
- **IMPLEMENTADO (2026-08-09)**: fases 0–6 completadas. Migración `020_store_checkout.sql` + changelog `020_changelog_v1_4_0.sql` creados (pendientes de aplicar en SQL Editor). Espejo 1:1 actualizado. Suite secciones A–AA en verde (539 tests), `npx tsc --noEmit` limpio, `npm run build` OK. Documentación post-implementación actualizada (flujo-modulos.md, requisitos-implementados.md).
- **FIX (2026-08-09)**: el checkout fallaba en producción con `23514 violates check constraint "product_orders_status_check"` (el constraint creado con la tabla no incluía `'pendiente'`). Se creó la migración `021_product_orders_status.sql` (idempotente, agrega `'pendiente'` a los estados permitidos) y se actualizó el espejo. El catch del checkout ahora devuelve el error real como `detail` en la respuesta 500.

## Requisito / Problema
La base de datos ya tiene las tablas `products`, `product_images`, `product_orders` y `order_items` (creadas en el espejo `documentacion/squema-sql-actualizado.sql`, líneas ~280–317, con RLS propias), y `payments.order_id` (FK → `product_orders`) existe sin uso. **Ningún código** del sistema las utiliza hoy: no hay carrito, no hay checkout, no hay página de confirmación ni ventas visibles en los dashboards.

Se necesita un módulo de **compra de productos físicos** totalmente desacoplado de membresías, inscripciones y clases personalizadas, con:
- Carrito en el navegador (localStorage) y detalle de producto con botones Agregar / Comprar ahora.
- Checkout con **pago Flow online** (solo Flow; no aplica el toggle manual de `payment_settings`).
- **Stock con reserva** al momento del checkout: se baja el stock de forma atómica y se restaura automáticamente si Flow rechaza/cancela, o manualmente cuando el admin cancela la orden.
- Compra como **usuario logueado o invitado**: para invitados son obligatorios email y teléfono (el nombre es opcional) y el recibo llega a ese correo.
- **Ventas visibles** en dashboards: el usuario ve "Mis Compras de Tienda", y el admin ve las ventas en `/admin/ventas` con filtro por tipo y un tab "Órdenes de Tienda" con acciones (marcar enviado / entregado / cancelar-restaura stock).

## Roles que interactúan
- **Visitante (invitado):** agrega al carrito, paga con Flow ingresando email + teléfono, recibe el recibo por correo.
- **Usuario autenticado:** agrega al carrito, paga con Flow (datos precargados de su perfil), ve "Mis Compras de Tienda" y la venta en su historial de pagos.
- **Admin:** administra productos (ya existente), revisa las ventas de tienda en Ventas, y ejecuta enviado/entregado/cancelación.
- **Staff:** lectura de ventas (is_staff), sin acciones de cancelación.

## Desacoplamiento (reglas inviolables)
1. **No se toca** `confirmAndCreateMembership`, ni `CheckoutModal` (membresías), ni el flujo de transferencia manual.
2. Ruta API nueva bajo `/api/store/*`.
3. En el callback/verify/force-confirm de Flow, el branch de tienda se gatilla **solo** cuando `payments.order_id IS NOT NULL`, verificando que el concepto matchee `Tienda:` (doble gate defensivo). Todo lo demás sigue el comportamiento actual.
4. `payments.user_id` y `product_orders.user_id` pasan a **nullable** (compra de invitado). Se mantienen los FKs (NULL = visita sin cuenta).
5. La referencia de la orden de tienda es `REF-ZE-prod-<timestamp>` (legible en Flow y en los dashboards).

## Flujo de implementación propuesto (paso a paso)

### Fase 0 — Requisito (este archivo)
Documentar plan, impacto y verificación. Aprobado por el usuario.

### Fase 1 — Base de datos
- Migración `020_store_checkout.sql` (idempotente, patrón 018/019):
  - `product_orders.user_id` → nullable; nuevas columnas `guest_email`, `guest_phone`, `guest_name`, `reference text` (única parcial sobre referencia no nula).
  - `payments.user_id` → nullable.
  - `order_items.quantity` CHECK (`quantity > 0`).
  - Mantener RLS: `product_orders_insert_own` hoy exige `user_id = auth.uid()`; para invitados la inserción la hace el service role/server (igual que hoy hace el server con payments), por lo que la policy de INSERT no bloquea al server. Actualizar el espejo 1:1 en `documentacion/squema-sql-actualizado.sql` (payments ~linea 319, product_orders ~301, order_items ~310, FKs ~503/506, seeds changelog al final).
  - Seed `020_changelog_v1_4_0.sql`: entrada de changelog v1.4.0 (patrón 019_changelog).
- Nota: la lógica de reserva de stock se hace con `UPDATE products SET stock = stock - qty WHERE id = ... AND stock >= qty` (atómico, sin función RPC nueva).

### Fase 2 — Librería de negocio
- `src/lib/flow.ts`: `CreateOrderParams` gana `returnUrl?: string` opcional; `createFlowOrder` la usa si viene (default `/dashboard/pagos`, backward compatible).
- `src/lib/store.ts` (nuevo): tipos (`StoreOrder`, `StoreOrderItem`, `StoreCheckoutInput`), `reserveStock(items)`, `restoreStock(items)`, `buildStoreOrder`, `confirmProductOrder(payment)` (marca `product_orders.status = 'pagado'` + notificación in-app si hay user_id), `cancelStoreOrder` (status `cancelado` + restaura stock). Helpers de email: `findEmailForOrder` (user_id → profile.email, si no guest_email).
- `src/lib/email.ts`: `sendProductReceiptEmail({ to, reference, items, total })` con el mismo transporter/estilos de `email.ts`.

### Fase 3 — API
- `POST /api/store/checkout`: valida carrito (items, stock), autenticado → datos del perfil; invitado → email + teléfono obligatorios, nombre opcional. Reserva stock (UPDATE atómico por item, 409 si no hay stock), crea `product_orders` (`pendiente`, reference `REF-ZE-prod-<ts>`) + `order_items` (snapshot unit_price) + `payments` (Flow, `pendiente`, `user_id` opcional). Llama `createFlowOrder` con `returnUrl = /tienda/confirmacion?token=...` y `subject = Tienda: <reference>`. Devuelve `{ url, token }`. Ante fallo: restaura stock reservado y devuelve 500.
- `GET /api/store/order-status?token=...`: público; devuelve estado de la orden (pending/paid/failed) para la página de confirmación.
- Branch tienda en Flow:
  - `src/app/api/flow/confirmation/route.ts` (`processInBackground`): si `payment.order_id` existe y concepto es `Tienda:` → `confirmProductOrder(payment)` + `sendProductReceiptEmail` + `notifyUserPaymentStatus`. Sin crash.
  - `src/app/api/flow/verify/route.ts`: al confirmar pago de tienda, misma lógica de confirmación.
  - `src/app/api/flow/force-confirm/route.ts`: al marcar pagado una orden con `order_id` de tienda → confirma la orden de tienda.
  - Rechazo/cancelación: en verify/confirmation, si status es `rechazado`/`cancelado` y hay `order_id` → `cancelStoreOrder` (status `cancelado` + restaura stock).
- `src/app/api/store/admin/orders/route.ts` (o acciones dentro de una ruta admin): listar órdenes de tienda, y `PATCH` para `enviado`/`entregado`/`cancelado` (restaura stock) — solo admin.

### Fase 4 — Frontend
- `src/context/CartContext.tsx` (nuevo) + `CartProvider` en `src/app/layout.tsx`: carrito en localStorage (`ze_cart`), items `{ productId, name, price, qty, image }`, funciones add/remove/setQty/clear/total.
- `src/components/Navbar.tsx`: badge con contador de items + link "Carrito".
- `src/app/carrito/page.tsx` (nuevo): lista items, cantidades, subtotal/total, formulario de checkout (invitado: email + teléfono obligatorios, nombre opcional; autenticado: datos del perfil), botón "Pagar con Flow".
- Botones en `src/app/productos/page.tsx` y `src/app/productos/[id]/page.tsx`: "Agregar al carrito" y "Comprar ahora" (hoy el detalle manda a `/auth`). Comprar ahora agrega 1 item y navega a `/carrito`.
- `src/app/tienda/confirmacion/page.tsx` (nuevo): página pública que lee `?token=`, consulta `order-status`, muestra éxito (recibo resumido) o fallo (stock restaurado), botón a `/productos`.

### Fase 5 — Dashboards
- `src/app/dashboard/tienda/page.tsx` (nuevo): "Mis Compras de Tienda" — lista de `product_orders` del usuario con estado (pendiente/pagado/enviado/entregado/cancelado), items y total. Enlace en el menú del dashboard.
- `src/app/admin/ventas/page.tsx`: filtro por **tipo** (Tienda / Membresías / Inscripciones / Personalizadas) + tab "Órdenes de Tienda" con acciones enviado/entregado/cancelar-restaura.
- `src/components/dashboard/PaymentRow.tsx` + `src/app/dashboard/pagos/page.tsx`: las ventas de tienda aparecen en el historial de pagos con concepto `Tienda: ...` y `payments.user_id` nullable correctamente manejado.

### Fase 6 — Verificación y documentación
- `scripts/test-flows.mjs`: nueva sección AA (schema store, checkout, branch callback, reserva/restauración, invitado, recibo email, filtros admin).
- `npx tsc --noEmit`, `npm run build`.
- Documentación post-implementación (obligatoria): `documentacion/flujo-modulos.md`, `documentacion/requisitos-implementados.md`, espejo SQL ya actualizado en Fase 1, este requisito marcado como implementado.

## Impacto
- **BD:** `payments.user_id` y `product_orders.user_id` nullable; columnas nuevas en `product_orders` (guest_email, guest_phone, guest_name, reference); CHECK en `order_items.quantity`. No se crean tablas nuevas.
- **Flow:** `createFlowOrder` gana parámetro opcional `returnUrl` (backward compatible). Callback/verify/force-confirm agregan branch gateado por `order_id` + concepto `Tienda:`; no se altera el flujo de membresías.
- **RLS:** sin cambios en policies; las inserciones de invitado van por el server (service role), como hoy las de payments.
- **Fechas:** se usan `src/lib/dates.ts` (`getChileToday`) donde haya lógica de fechas (no hay fechas en este flujo salvo created_at/paid_at ya manejadas).
- **Riesgos:** bajo — tablas ya existentes sin uso; `payments.order_id` ya existe; flujo de membresías intacto.

## Verificación
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` → suite completa verde (**539 passed** con sección AA de tienda).
- `npx tsc --noEmit` sin errores.
- `npm run build` sin errores.
- Revisión manual de flujos: compra autenticado, compra invitado, rechazo de pago (stock restaurado), cancelación admin (stock restaurado), filtros en `/admin/ventas`.
