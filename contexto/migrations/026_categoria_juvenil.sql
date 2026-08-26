-- =====================================================================
-- Migración 026: Categoría "Juvenil" + Multi-selección en horarios
-- Versión: v1.6.0
-- =====================================================================
-- Reglas de edad:
--   nino:    < 10 años
--   juvenil: 10–15 años (cumple 16 = adulto)
--   adulto:  >= 16 años
-- =====================================================================

-- =====================================================
-- 1. Función helper: calcular categoría desde birth_date
-- =====================================================
CREATE OR REPLACE FUNCTION public.compute_category_from_birth(p_birth_date date)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_birth_date IS NULL THEN 'adulto'
    WHEN (CURRENT_DATE - p_birth_date) < (10 * 365.25) THEN 'nino'
    WHEN (CURRENT_DATE - p_birth_date) < (16 * 365.25) THEN 'juvenil'
    ELSE 'adulto'
  END;
$$;

-- =====================================================
-- 2. Drop OLD CHECK constraints BEFORE updating data
--    (old constraint only allows 'nino'/'adulto')
-- =====================================================

-- 2a. dependents.category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dependents_category_check'
      AND conrelid = 'public.dependents'::regclass
  ) THEN
    ALTER TABLE public.dependents DROP CONSTRAINT dependents_category_check;
  END IF;
END $$;

-- 2b. membership_plans.category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_plans_category_check'
      AND conrelid = 'public.membership_plans'::regclass
  ) THEN
    ALTER TABLE public.membership_plans DROP CONSTRAINT membership_plans_category_check;
  END IF;
END $$;

-- =====================================================
-- 3. Migrar dependents.category existentes
--    Recalcular según birth_date para incluir 'juvenil'
-- =====================================================
UPDATE public.dependents
   SET category = public.compute_category_from_birth(birth_date)
 WHERE category NOT IN ('nino', 'juvenil', 'adulto')
    OR (
      category = 'nino'
      AND (CURRENT_DATE - birth_date) >= (10 * 365.25)
    )
    OR (
      category = 'adulto'
      AND (CURRENT_DATE - birth_date) < (16 * 365.25)
      AND (CURRENT_DATE - birth_date) >= (10 * 365.25)
    );

-- =====================================================
-- 4. Re-create CHECK constraints with 'juvenil' included
-- =====================================================
ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_category_check
  CHECK (category IN ('nino', 'juvenil', 'adulto'));

ALTER TABLE public.membership_plans
  ADD CONSTRAINT membership_plans_category_check
  CHECK (category IN ('nino', 'juvenil', 'adulto'));

-- =====================================================
-- 5. schedules.category: text → text[] (multi-selección)
-- =====================================================
-- Eliminar el CHECK constraint existente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedules_category_check'
      AND conrelid = 'public.schedules'::regclass
  ) THEN
    ALTER TABLE public.schedules DROP CONSTRAINT schedules_category_check;
  END IF;
END $$;

-- Eliminar el DEFAULT actual (es text, no se puede castear a text[])
ALTER TABLE public.schedules
  ALTER COLUMN category DROP DEFAULT;

-- Convertir datos existentes de text a text[]
-- 'ambos' → '{ninos,juveniles,adultos}'
-- 'ninos' → '{ninos}'
-- 'adultos' → '{adultos}'
UPDATE public.schedules
   SET category = CASE
     WHEN category = 'ambos' THEN '{ninos,juveniles,adultos}'
     WHEN category = 'ninos' THEN '{ninos}'
     WHEN category = 'adultos' THEN '{adultos}'
     ELSE '{ninos,juveniles,adultos}'
   END;

-- Cambiar tipo de columna
ALTER TABLE public.schedules
  ALTER COLUMN category TYPE text[]
  USING category::text[];

-- Nuevo DEFAULT como array
ALTER TABLE public.schedules
  ALTER COLUMN category SET DEFAULT '{ninos,juveniles,adultos}'::text[];

-- =====================================================
-- 6. Changelog entry
-- =====================================================
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.6.0',
  'Categoría Juvenil + Horarios Multi-selección',
  'Nueva categoría "juvenil" (10-15 años) para dependientes y planes de membresía. Los horarios ahora permiten seleccionar múltiples categorías (niños, juveniles, adultos) en vez de un solo valor. Recálculo automático de categoría según edad al cargar datos.'
)
ON CONFLICT (version) DO NOTHING;
