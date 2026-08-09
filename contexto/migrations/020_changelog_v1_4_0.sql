-- ============================================================
-- 020_changelog_v1_4_0.sql
-- Entrada de changelog v1.4.0: Tienda con carrito, checkout Flow,
-- stock con reserva y ventas en dashboards (requisito
-- contexto/requisitos/tienda-carrito-ventas.md).
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.4.0 — Tienda de productos
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.4.0',
  'Tienda de Productos',
  E'• Nueva tienda de productos: cada producto tiene su detalle con botones "Agregar al carrito" y "Comprar ahora", y el carrito se guarda en el navegador.\n• Checkout con pago en línea Flow: al comprar se reserva el stock del producto automáticamente y se devuelve si el pago es rechazado o cancelado.\n• Se puede comprar con la cuenta del usuario o como invitado (solo email y teléfono obligatorios); el recibo de la compra llega al correo.\n• El usuario ve sus compras en la nueva sección "Mis Compras de Tienda" de su panel y en su historial de pagos.\n• El administrador revisa las ventas en la sección Ventas, con filtro por tipo, y puede marcar cada orden como enviada, entregada o cancelarla (la cancelación devuelve el stock).'
)
ON CONFLICT (version) DO NOTHING;
