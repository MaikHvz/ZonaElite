-- ============================================================
-- Migración 024 — Perfil deportivo de alumnos
--
-- Problema: cada alumno practica una disciplina (catálogo
-- `disciplines` ya existente) y avanza por grados/cinturones, pero
-- no existe dónde guardar esa información ni los podios/logros.
--
-- Solución (3 tablas):
--   1. belt_grades     progresión Disciplina → Grados (nombre, color,
--                      orden). Seed estándar por disciplina activa.
--   2. sport_profiles  1:1 con `beneficiaries` (unifica titular y
--                      cargas): disciplina + grado/cinturón actual.
--   3. sports_podiums  historial de torneos/competencias: fecha,
--                      disciplina, categoría, lugar, imagen.
--
-- RLS: lectura dueño/admin (owns_beneficiary / is_admin), escritura
-- SOLO admin — los alumnos NO pueden autoconcederse grados ni
-- podios mediante llamadas directas al backend.
--
-- Idempotente: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Función trigger común: auto-update updated_at.
--    Se define aquí para que esta migración sea autocontenida
--    (no asume que la BD ya tenga public.update_updated_at()).
--    CREATE OR REPLACE = idempotente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 1. Catálogo de grados/cinturones por disciplina
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.belt_grades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  discipline_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT belt_grades_pkey PRIMARY KEY (id),
  CONSTRAINT belt_grades_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE,
  CONSTRAINT belt_grades_discipline_position_key UNIQUE (discipline_id, position),
  CONSTRAINT belt_grades_position_check CHECK (position > 0)
);

-- Seed: progresión estándar (blanco → negro) para toda disciplina
-- activa. El color es el del cinturón; la UI lo lee de la BD.
INSERT INTO public.belt_grades (discipline_id, name, color, position)
SELECT d.id, g.name, g.color, g.position
FROM public.disciplines d
CROSS JOIN (
  VALUES
    ('Blanco',   '#F5F5F5', 1),
    ('Amarillo', '#FBC02D', 2),
    ('Naranja',  '#F57C00', 3),
    ('Verde',    '#388E3C', 4),
    ('Azul',     '#1976D2', 5),
    ('Morado',   '#7B1FA2', 6),
    ('Marrón',   '#5D4037', 7),
    ('Negro',    '#212121', 8)
) AS g(name, color, position)
WHERE d.active = true
ON CONFLICT (discipline_id, position) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Perfil deportivo 1:1 con el beneficiario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sport_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  discipline_id uuid,
  grade_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT sport_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT sport_profiles_beneficiary_id_key UNIQUE (beneficiary_id),
  CONSTRAINT sport_profiles_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT sport_profiles_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE SET NULL,
  CONSTRAINT sport_profiles_grade_id_fkey
    FOREIGN KEY (grade_id) REFERENCES public.belt_grades(id) ON DELETE SET NULL
);

-- Integridad posicional: el grado debe pertenecer a la disciplina
-- elegida (un cinturón de Karate no puede asignarse a un alumno de
-- Kempo) y no puede existir grado sin disciplina.
CREATE OR REPLACE FUNCTION public.sport_profile_validate_grade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discipline_id IS NULL THEN
    NEW.grade_id := NULL;
  ELSIF NEW.grade_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.belt_grades bg
    WHERE bg.id = NEW.grade_id
      AND bg.discipline_id = NEW.discipline_id
  ) THEN
    RAISE EXCEPTION 'El grado no pertenece a la disciplina seleccionada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sport_profile_validate_grade ON public.sport_profiles;
CREATE TRIGGER trg_sport_profile_validate_grade
  BEFORE INSERT OR UPDATE ON public.sport_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sport_profile_validate_grade();

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_sport_profiles_updated_at ON public.sport_profiles;
CREATE TRIGGER set_sport_profiles_updated_at
  BEFORE UPDATE ON public.sport_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 3. Podios (historial de torneos / competencias)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sports_podiums (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  tournament text NOT NULL,
  event_date date NOT NULL,
  discipline_id uuid NOT NULL,
  category text,
  position text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT sports_podiums_pkey PRIMARY KEY (id),
  CONSTRAINT sports_podiums_beneficiary_id_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT sports_podiums_discipline_id_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  CONSTRAINT sports_podiums_position_check
    CHECK (position IN ('1', '2', '3', 'participacion'))
);

-- Listados recientes primero + stats por alumno.
CREATE INDEX IF NOT EXISTS idx_sports_podiums_beneficiary_date
  ON public.sports_podiums (beneficiary_id, event_date DESC);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_sports_podiums_updated_at ON public.sports_podiums;
CREATE TRIGGER set_sports_podiums_updated_at
  BEFORE UPDATE ON public.sports_podiums
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE public.belt_grades ENABLE ROW LEVEL SECURITY;
-- Lectura: cualquier usuario autenticado (catálogo público de grados).
CREATE POLICY "belt_grades_select_auth" ON public.belt_grades
  FOR SELECT USING (auth.role() = 'authenticated');
-- Escritura: solo admin.
CREATE POLICY "belt_grades_admin_write" ON public.belt_grades
  FOR ALL USING (public.is_admin());

ALTER TABLE public.sport_profiles ENABLE ROW LEVEL SECURITY;
-- Lectura: el dueño del beneficiario (titular o tutor de carga) o admin.
CREATE POLICY "sport_profiles_select_own_or_admin" ON public.sport_profiles
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
-- Escritura: solo admin (el alumno NO puede autoconcederse grados).
CREATE POLICY "sport_profiles_admin_write" ON public.sport_profiles
  FOR ALL USING (public.is_admin());

ALTER TABLE public.sports_podiums ENABLE ROW LEVEL SECURITY;
-- Lectura: el dueño del beneficiario (titular o tutor de carga) o admin.
CREATE POLICY "sports_podiums_select_own_or_admin" ON public.sports_podiums
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
-- Escritura: solo admin (el alumno NO puede crearse podios a sí mismo).
CREATE POLICY "sports_podiums_admin_write" ON public.sports_podiums
  FOR ALL USING (public.is_admin());
