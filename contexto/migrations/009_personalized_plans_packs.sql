-- ============================================================
-- 009_personalized_plans_packs.sql
-- Clases Personalizadas — Módulo independiente (Fase 0)
-- Tablas nuevas propias. No toca memberships/membership_plans/
-- class_enrollments/tokens/checkin. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.personalized_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  total_classes integer NOT NULL,
  validity_days integer NOT NULL,
  features jsonb,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personalized_packs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id),
  purchased_by uuid NOT NULL,
  payment_id uuid REFERENCES public.payments(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_classes integer NOT NULL,
  used_classes integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'activa' NOT NULL CHECK (status IN ('activa','agotada','vencida','cancelada')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_packs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_personalized_packs_beneficiary ON public.personalized_packs(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_personalized_plans_active ON public.personalized_plans(active);

ALTER TABLE public.personalized_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_plans_select_all" ON public.personalized_plans FOR SELECT USING (true);
CREATE POLICY "personalized_plans_admin_write" ON public.personalized_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_packs_select_own_or_admin" ON public.personalized_packs FOR SELECT USING (
  purchased_by = auth.uid() OR public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_packs_admin_write" ON public.personalized_packs FOR ALL USING (public.is_admin());
