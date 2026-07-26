-- Add enrollment columns to payments table
-- This allows the confirmation callback to know if a payment includes enrollment,
-- without depending on Flow's 'optional' field (which isn't returned on getStatus).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS include_enrollment boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS enrollment_plan_id uuid REFERENCES public.enrollment_plans(id);

-- Backfill from concept field for any existing payments that included enrollment
UPDATE public.payments
SET include_enrollment = true
WHERE concept ILIKE 'Inscripción%'
  AND include_enrollment = false;

-- Now backfill enrollment_plan_id for those payments by matching plan name from concept
UPDATE public.payments p
SET enrollment_plan_id = ep.id
FROM public.enrollment_plans ep
WHERE p.include_enrollment = true
  AND p.enrollment_plan_id IS NULL
  AND p.concept ILIKE '%' || ep.name || '%';
