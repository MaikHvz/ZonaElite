-- ============================================================
-- 021_product_orders_status.sql
-- Agrega 'pendiente' a los estados permitidos de product_orders.
--
-- El checkout de tienda inserta la orden con status 'pendiente'
-- (pago Flow en curso), pero el CHECK product_orders_status_check
-- existente (creado junto con la tabla) solo permitía
-- 'borrador' | 'pagado' | 'enviado' | 'entregado' | 'cancelado',
-- rompiendo POST /api/store/checkout con 23514.
--
-- Idempotente: si el constraint existe se elimina y se vuelve a
-- crear incluyendo 'pendiente'; si no existe se crea directo.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_orders_status_check') THEN
    ALTER TABLE public.product_orders DROP CONSTRAINT product_orders_status_check;
  END IF;
END $$;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_status_check
  CHECK (status IN ('borrador', 'pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'));
