-- =====================================================================
-- MIGRACIÓN: Agregar schedule_id a class_enrollments
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================

-- Hacer session_id nullable (futuro uso para sesiones específicas)
ALTER TABLE public.class_enrollments
  ALTER COLUMN session_id DROP NOT NULL;

-- Agregar schedule_id como FK a schedules
ALTER TABLE public.class_enrollments
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.schedules(id) ON DELETE CASCADE;

-- Constraint: al menos uno de los dos debe estar presente
ALTER TABLE public.class_enrollments
  ADD CONSTRAINT chk_enrollment_target
  CHECK (session_id IS NOT NULL OR schedule_id IS NOT NULL);

-- Index para búsquedas por schedule
CREATE INDEX IF NOT EXISTS idx_class_enrollments_schedule ON public.class_enrollments(schedule_id);
