-- FASE 0: Agregar columnas de Flow a payments
-- Ejecutar en Supabase Dashboard > SQL Editor

-- Agregar columnas (sin UNIQUE en commerce_order)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commerce_order text,
  ADD COLUMN IF NOT EXISTS flow_token text,
  ADD COLUMN IF NOT EXISTS flow_order bigint;

-- Si commerce_order ya tiene UNIQUE constraint, eliminarlo:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%commerce_order%'
    AND contype = 'u'
  ) THEN
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS payments_commerce_order_key;
  END IF;
END $$;

-- INDEX (no UNIQUE) en commerce_order para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payments_commerce_order
  ON public.payments(commerce_order);

-- Policy: usuario autenticado puede insertar sus propios pagos (método flow)
CREATE POLICY "payments_user_insert_own"
  ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND method = 'flow'
  );

-- Policy: usuario autenticado puede ver sus propios pagos
-- (verificar que exista; si ya existe, ignorar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payments_owner_select'
    AND tablename = 'payments'
  ) THEN
    CREATE POLICY "payments_owner_select"
      ON public.payments
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR is_staff()
      );
  END IF;
END $$;

-- Policy: staff puede actualizar cualquier pago (confirmación Flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payments_staff_update'
    AND tablename = 'payments'
  ) THEN
    CREATE POLICY "payments_staff_update"
      ON public.payments
      FOR UPDATE
      USING (is_staff())
      WITH CHECK (is_staff());
  END IF;
END $$;

-- Policy: usuario puede actualizar sus propios pagos flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'payments_owner_update_flow'
    AND tablename = 'payments'
  ) THEN
    CREATE POLICY "payments_owner_update_flow"
      ON public.payments
      FOR UPDATE
      USING (auth.uid() = user_id AND method = 'flow')
      WITH CHECK (auth.uid() = user_id AND method = 'flow');
  END IF;
END $$;
