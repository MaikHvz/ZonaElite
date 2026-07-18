-- FASE 0: Agregar columnas de Flow a payments
-- Ejecutar en Supabase Dashboard > SQL Editor

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commerce_order text UNIQUE,
  ADD COLUMN IF NOT EXISTS flow_token text,
  ADD COLUMN IF NOT EXISTS flow_order bigint;

CREATE INDEX IF NOT EXISTS idx_payments_commerce_order
  ON public.payments(commerce_order);

-- Permitir a usuarios autenticados insertar sus propios pagos (para Flow Webpay)
-- La policy existente "payments_staff_write" solo permite staff. Necesitamos que
-- el alumno también pueda crear pagos propios (método flow, status pendiente).
CREATE POLICY "payments_user_insert_own"
  ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND method = 'flow'
  );
