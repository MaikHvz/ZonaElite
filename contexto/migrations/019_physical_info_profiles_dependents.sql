-- ============================================================
-- 019_physical_info_profiles_dependents.sql
-- Datos físicos (antropométricos) para perfiles y cargas:
--   profiles.weight         numeric (kg, 0 < w <= 300)
--   profiles.height         numeric (cm, 0 < h <= 250)
--   profiles.dominant_hand  text (diestro | zurdo)
--   dependents.weight       numeric
--   dependents.height       numeric
--   dependents.dominant_hand text
-- Todas nullable (CHECK con NULL = UNKNOWN pasa). Idempotente:
-- ADD COLUMN IF NOT EXISTS + CHECK vía DO block (patrón 010).
-- Sin cambios de RLS: los policies own_or_admin existentes ya
-- cubren las columnas nuevas.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dominant_hand text;

ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS weight numeric;
ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS height numeric;
ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS dominant_hand text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_weight_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_weight_check CHECK (weight > 0 AND weight <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_height_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_height_check CHECK (height > 0 AND height <= 250);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_dominant_hand_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_dominant_hand_check CHECK (dominant_hand IN ('diestro', 'zurdo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependents_weight_check') THEN
    ALTER TABLE public.dependents ADD CONSTRAINT dependents_weight_check CHECK (weight > 0 AND weight <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependents_height_check') THEN
    ALTER TABLE public.dependents ADD CONSTRAINT dependents_height_check CHECK (height > 0 AND height <= 250);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dependents_dominant_hand_check') THEN
    ALTER TABLE public.dependents ADD CONSTRAINT dependents_dominant_hand_check CHECK (dominant_hand IN ('diestro', 'zurdo'));
  END IF;
END $$;
