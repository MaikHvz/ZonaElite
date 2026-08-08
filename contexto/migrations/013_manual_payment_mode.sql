-- ============================================================
-- 013_manual_payment_mode.sql
-- Modo de pago manual por transferencia (alternativa a Flow)
-- 1) academy_settings.payment_settings (jsonb): toggle por tipo
--    de producto ("online" | "manual") + datos bancarios.
-- 2) payments: columnas para solicitudes de transferencia y su
--    revisión por admin.
-- 3) profiles.rut (nullable): RUT informativo del titular.
-- Idempotente (patrón 009/010). No toca RLS de payments.
-- ============================================================

-- 1. Toggle y datos bancarios en academy_settings (tabla singleton)
ALTER TABLE public.academy_settings
  ADD COLUMN IF NOT EXISTS payment_settings jsonb;

-- Default para la fila singleton existente: todo online, sin datos
-- bancarios. No se pisa si el admin ya guardó configuración.
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

CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by
  ON public.payments (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_payments_membership_plan
  ON public.payments (membership_plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_personalized_plan
  ON public.payments (personalized_plan_id);
