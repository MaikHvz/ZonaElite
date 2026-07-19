-- =====================================================================
-- MIGRACIÓN: Sistema completo de Horarios y Clases
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================

-- 1. Extender tabla disciplines (tipos de clase)
ALTER TABLE public.disciplines
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'sports_martial_arts';

-- 2. Extender tabla schedules (clases)
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'ambos'
  CHECK (category IN ('ninos', 'adultos', 'ambos')),
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS description text;

-- 3. Tabla de relación clases ↔ planes permitidos
CREATE TABLE IF NOT EXISTS public.class_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  UNIQUE (schedule_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_class_plans_schedule ON public.class_plans(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_plans_plan ON public.class_plans(plan_id);

-- 4. Tabla de inscripciones a clases
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_session ON public.class_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary ON public.class_enrollments(beneficiary_id);

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.class_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- class_plans: lectura pública, escritura admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_plans_public_read' AND tablename = 'class_plans') THEN
    CREATE POLICY "class_plans_public_read" ON public.class_plans FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_plans_admin_write' AND tablename = 'class_plans') THEN
    CREATE POLICY "class_plans_admin_write" ON public.class_plans FOR ALL USING (public.is_admin());
  END IF;
END $$;

-- class_enrollments: usuario propio o staff puede leer, usuario propio puede inscribirse
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_own_read' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "enrollments_own_read" ON public.class_enrollments
      FOR SELECT USING (
        public.is_admin() OR
        beneficiary_id IN (
          SELECT b.id FROM public.beneficiaries b
          LEFT JOIN public.dependents d ON d.id = b.dependent_id
          LEFT JOIN public.profiles p ON p.id = b.profile_id
          WHERE d.tutor_id = auth.uid() OR p.id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_own_insert' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "enrollments_own_insert" ON public.class_enrollments
      FOR INSERT WITH CHECK (
        beneficiary_id IN (
          SELECT b.id FROM public.beneficiaries b
          LEFT JOIN public.dependents d ON d.id = b.dependent_id
          LEFT JOIN public.profiles p ON p.id = b.profile_id
          WHERE d.tutor_id = auth.uid() OR p.id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_own_delete' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "enrollments_own_delete" ON public.class_enrollments
      FOR DELETE USING (
        public.is_admin() OR
        beneficiary_id IN (
          SELECT b.id FROM public.beneficiaries b
          LEFT JOIN public.dependents d ON d.id = b.dependent_id
          LEFT JOIN public.profiles p ON p.id = b.profile_id
          WHERE d.tutor_id = auth.uid() OR p.id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'enrollments_admin_all' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "enrollments_admin_all" ON public.class_enrollments
      FOR ALL USING (public.is_admin());
  END IF;
END $$;

-- =====================================================================
-- SEMBRAR DISCIPLINAS BASE (si están vacías)
-- =====================================================================
INSERT INTO public.disciplines (name, color_hex, icon, description, active)
VALUES
  ('Kenpo', '#E53935', 'sports_martial_arts', 'Defensa personal y desarrollo técnico de precisión.', true),
  ('Kickboxing', '#1E88E5', 'sports_kabaddi', 'Velocidad, potencia y resistencia cardiovascular extrema.', true),
  ('Funcional', '#43A047', 'fitness_center', 'Mejora tu condición física, fuerza y agilidad global.', true),
  ('MMA', '#8E24AA', 'hardware', 'Entrenamiento integral combinando múltiples disciplinas de combate.', true)
ON CONFLICT (name) DO NOTHING;
