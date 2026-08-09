-- ============================================================
-- 020_store_checkout.sql
-- Checkout de tienda (carrito + Flow) — v1.4.0:
--   product_orders.user_id   nullable (compra de invitado)
--   product_orders.guest_email  text nullable
--   product_orders.guest_phone  text nullable
--   product_orders.guest_name   text nullable
--   product_orders.reference    text nullable (REF-ZE-prod-<ts>)
--   payments.user_id         nullable (compra de invitado)
--   order_items.quantity     CHECK (quantity > 0)
-- Idempotente: ADD COLUMN IF NOT EXISTS + DROP NOT NULL vía
-- DO block (patrón 019) + CHECK vía DO block (patrón 010/019).
-- RLS: sin cambios — las inserciones de invitado (user_id NULL)
-- van por el server (service role) como hoy las de payments; los
-- policies select own_or_admin existentes cubren la lectura.
-- ============================================================

-- 1) product_orders: user_id nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_orders'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.product_orders ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- 2) product_orders: columnas de invitado + referencia de orden
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS reference text;

-- Referencia única solo donde existe (los pendientes/borradores
-- pueden quedar sin referencia mientras se construye el checkout).
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_orders_reference_unique
  ON public.product_orders(reference) WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_orders_reference
  ON public.product_orders(reference);

-- 3) payments: user_id nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- 4) order_items: cantidad debe ser positiva
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_check') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0);
  END IF;
END $$;

-- ============================================================
-- 5) RPC de stock atómico (reserva al checkout + restauración)
-- La reserva baja stock con guarda `stock >= p_qty` (evita
-- sobreventa); si no hay stock suficiente no toca la fila y la
-- función devuelve false. La restauración sube stock (nunca
-- negativo). SECURITY DEFINER: corre con permisos del owner para
-- permitir el UPDATE atómico; el flujo solo se invoca server-side
-- (service role / RPC del checkout), nunca desde el cliente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF p_qty <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.products
  SET stock = stock - p_qty,
      updated_at = now()
  WHERE id = p_product_id
    AND active = true
    AND stock >= p_qty;

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF p_qty <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.products
  SET stock = stock + p_qty,
      updated_at = now()
  WHERE id = p_product_id;

  IF FOUND THEN
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.decrement_product_stock(uuid, integer) IS
'Reserva stock de un producto (UPDATE atómico con guarda stock >= qty). Devuelve false si no hay stock suficiente o el producto está inactivo.';
COMMENT ON FUNCTION public.increment_product_stock(uuid, integer) IS
'Restaura stock de un producto (UPDATE atómico de suma). Se usa al cancelar/rechazar pagos de tienda.';
