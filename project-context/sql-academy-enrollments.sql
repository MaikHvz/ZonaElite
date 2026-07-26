-- =====================================================================
-- MIGRACIÓN: Sistema de Inscripciones (Matrícula) - ZonaElite
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- =====================================================
-- TABLA: enrollment_plans (planes de inscripción)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.enrollment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLA: academy_enrollments (inscripciones de beneficiarios)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrollment_plan_id UUID NOT NULL REFERENCES public.enrollment_plans(id),
  payment_id UUID REFERENCES public.payments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','vencida','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_beneficiary ON public.academy_enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_status ON public.academy_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_end_date ON public.academy_enrollments(end_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_plans_active ON public.enrollment_plans(active);

-- =====================================================
-- RLS: enrollment_plans
-- =====================================================
ALTER TABLE public.enrollment_plans ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_enrollment_plans" ON public.enrollment_plans
  FOR ALL USING (public.is_admin());

-- Staff: lectura
CREATE POLICY "staff_read_enrollment_plans" ON public.enrollment_plans
  FOR SELECT USING (public.is_staff());

-- Usuarios autenticados: lectura de planes activos (para checkout)
CREATE POLICY "auth_read_active_enrollment_plans" ON public.enrollment_plans
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);

-- =====================================================
-- RLS: academy_enrollments
-- =====================================================
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_academy_enrollments" ON public.academy_enrollments
  FOR ALL USING (public.is_admin());

-- Staff: lectura
CREATE POLICY "staff_read_academy_enrollments" ON public.academy_enrollments
  FOR SELECT USING (public.is_staff());

-- Usuarios: ven sus propias inscripciones (y de sus cargas)
CREATE POLICY "user_read_own_enrollments" ON public.academy_enrollments
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id));

-- Usuarios: pueden insertar (para pagos Flow directos)
CREATE POLICY "user_insert_enrollment_flow" ON public.academy_enrollments
  FOR INSERT WITH CHECK (public.owns_beneficiary(beneficiary_id));

-- =====================================================
-- SEED DATA: 2 planes por defecto
-- =====================================================
INSERT INTO public.enrollment_plans (name, price, duration_days, active, sort_order)
VALUES
  ('6 Meses', 15000, 180, true, 1),
  ('1 Año', 25000, 365, true, 2)
ON CONFLICT DO NOTHING;
