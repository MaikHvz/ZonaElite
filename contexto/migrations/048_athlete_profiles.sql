-- ============================================================
-- 048_athlete_profiles.sql
-- Perfil de Atleta tipo Instagram (v1.17.0, fase 1 – MVP).
-- Requisito + impacto: contexto/requisitos/perfil-atleta-rankings.md
--
-- - athlete_profiles: alias (URL), apodo, biografía, disciplina
--   principal, portada, visibilidad (comunidad|privado) y
--   ocultamiento por el admin. Una fila por cuenta (perfil).
-- - athlete_trophies: trofeos/reconocimientos que otorga el admin.
-- - belt_promotions: historial de cinturones (trigger sobre
--   sport_profiles) para las "publicaciones" de logros.
-- - Sin imágenes: el perfil y las publicaciones son solo texto.
-- - Solo comunidad: todo se lee con sesión iniciada vía RPC
--   SECURITY DEFINER que exponen campos permitidos (nunca RUT,
--   correo, teléfono, fecha de nacimiento ni datos médicos).
-- - Escritura del alumno solo por RPC; el admin escribe directo.
-- - Supabase da EXECUTE directo a anon/authenticated: se revoca
--   explícitamente (lección de la migración 039).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Helpers
-- ------------------------------------------------------------

-- Minúsculas sin tildes (búsqueda y alias). Sin extensión unaccent.
CREATE OR REPLACE FUNCTION public.athlete_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(translate(
    coalesce(p_text, ''),
    'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
    'AAAAEEEEIIIIOOOOUUUUNaaaaeeeeiiiioooouuuun'
  ));
$$;

-- Categoría por edad (misma regla que categoryFromBirth en la app):
-- nino < 10, juvenil 10–15, adulto >= 16. Sin fecha → adulto.
CREATE OR REPLACE FUNCTION public.athlete_category(p_birth_date date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_birth_date IS NULL THEN 'adulto'
    WHEN date_part('year', age(public.chile_today(), p_birth_date)) < 10 THEN 'nino'
    WHEN date_part('year', age(public.chile_today(), p_birth_date)) < 16 THEN 'juvenil'
    ELSE 'adulto'
  END;
$$;

-- Alias base a partir del nombre: "Matías Pérez" → "matias.perez".
CREATE OR REPLACE FUNCTION public.athlete_alias_base(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN length(v) >= 3 THEN v ELSE 'atleta' END
  FROM (
    SELECT trim(BOTH '.' FROM left(
      trim(BOTH '.' FROM regexp_replace(public.athlete_normalize(p_name), '[^a-z0-9]+', '.', 'g')),
      24
    )) AS v
  ) s;
$$;

-- ------------------------------------------------------------
-- 2) Tablas
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  profile_id uuid NOT NULL,
  alias text NOT NULL,
  nickname text,
  bio text,
  primary_discipline_id uuid,
  cover_theme text DEFAULT 'fuego' NOT NULL,
  visibility text DEFAULT 'comunidad' NOT NULL,
  hidden_by_admin boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT athlete_profiles_profile_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT athlete_profiles_discipline_fkey
    FOREIGN KEY (primary_discipline_id) REFERENCES public.disciplines(id) ON DELETE SET NULL,
  CONSTRAINT athlete_profiles_alias_format
    CHECK (alias ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'),
  CONSTRAINT athlete_profiles_nickname_length
    CHECK (nickname IS NULL OR char_length(nickname) <= 40),
  CONSTRAINT athlete_profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 150),
  CONSTRAINT athlete_profiles_cover_check
    CHECK (cover_theme IN ('fuego', 'oro', 'brasa', 'acero', 'noche')),
  CONSTRAINT athlete_profiles_visibility_check
    CHECK (visibility IN ('comunidad', 'privado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS athlete_profiles_alias_key
  ON public.athlete_profiles (alias);

CREATE TABLE IF NOT EXISTS public.athlete_trophies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  awarded_on date NOT NULL,
  discipline_id uuid,
  awarded_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_trophies_pkey PRIMARY KEY (id),
  CONSTRAINT athlete_trophies_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT athlete_trophies_discipline_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE SET NULL,
  CONSTRAINT athlete_trophies_awarded_by_fkey
    FOREIGN KEY (awarded_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT athlete_trophies_title_length
    CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  CONSTRAINT athlete_trophies_description_length
    CHECK (description IS NULL OR char_length(description) <= 300)
);

CREATE INDEX IF NOT EXISTS idx_athlete_trophies_beneficiary
  ON public.athlete_trophies (beneficiary_id, awarded_on DESC);

CREATE TABLE IF NOT EXISTS public.belt_promotions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL,
  discipline_id uuid NOT NULL,
  grade_id uuid NOT NULL,
  promoted_on date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT belt_promotions_pkey PRIMARY KEY (id),
  CONSTRAINT belt_promotions_beneficiary_grade_key UNIQUE (beneficiary_id, grade_id),
  CONSTRAINT belt_promotions_beneficiary_fkey
    FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  CONSTRAINT belt_promotions_discipline_fkey
    FOREIGN KEY (discipline_id) REFERENCES public.disciplines(id) ON DELETE CASCADE,
  CONSTRAINT belt_promotions_grade_fkey
    FOREIGN KEY (grade_id) REFERENCES public.belt_grades(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 3) RLS: lectura dueño o admin; escritura solo admin.
--    El resto de la comunidad lee vía RPC (sección 6).
-- ------------------------------------------------------------
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_profiles_select_own_or_admin" ON public.athlete_profiles;
CREATE POLICY "athlete_profiles_select_own_or_admin" ON public.athlete_profiles
  FOR SELECT USING (profile_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "athlete_profiles_admin_write" ON public.athlete_profiles;
CREATE POLICY "athlete_profiles_admin_write" ON public.athlete_profiles
  FOR ALL USING (public.is_admin());

ALTER TABLE public.athlete_trophies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_trophies_select_own_or_admin" ON public.athlete_trophies;
CREATE POLICY "athlete_trophies_select_own_or_admin" ON public.athlete_trophies
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "athlete_trophies_admin_write" ON public.athlete_trophies;
CREATE POLICY "athlete_trophies_admin_write" ON public.athlete_trophies
  FOR ALL USING (public.is_admin());

ALTER TABLE public.belt_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "belt_promotions_select_own_or_admin" ON public.belt_promotions;
CREATE POLICY "belt_promotions_select_own_or_admin" ON public.belt_promotions
  FOR SELECT USING (public.owns_beneficiary(beneficiary_id) OR public.is_admin());
DROP POLICY IF EXISTS "belt_promotions_admin_write" ON public.belt_promotions;
CREATE POLICY "belt_promotions_admin_write" ON public.belt_promotions
  FOR ALL USING (public.is_admin());

DROP TRIGGER IF EXISTS set_athlete_profiles_updated_at ON public.athlete_profiles;
CREATE TRIGGER set_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 4) Alta automática del perfil de atleta (alias único)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_athlete_profile(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias text;
  v_base text;
  v_candidate text;
  v_n integer := 1;
BEGIN
  SELECT alias INTO v_alias FROM public.athlete_profiles WHERE profile_id = p_profile_id;
  IF FOUND THEN
    RETURN v_alias;
  END IF;

  SELECT public.athlete_alias_base(full_name) INTO v_base
  FROM public.profiles WHERE id = p_profile_id;
  IF v_base IS NULL THEN
    RETURN NULL;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.athlete_profiles WHERE alias = v_candidate) LOOP
    v_n := v_n + 1;
    v_candidate := v_base || v_n::text;
  END LOOP;

  INSERT INTO public.athlete_profiles (profile_id, alias)
  VALUES (p_profile_id, v_candidate)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT alias INTO v_alias FROM public.athlete_profiles WHERE profile_id = p_profile_id;
  RETURN v_alias;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_athlete_profile_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nunca bloquear el registro: si falla, el perfil se crea al abrirlo.
  BEGIN
    PERFORM public.ensure_athlete_profile(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_create_athlete_profile ON public.profiles;
CREATE TRIGGER trg_profiles_create_athlete_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_athlete_profile_on_profile();

-- Backfill: un perfil de atleta por cada cuenta existente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.athlete_profiles ap WHERE ap.profile_id = p.id)
    ORDER BY p.created_at
  LOOP
    PERFORM public.ensure_athlete_profile(r.id);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 5) Historial de cinturones
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_belt_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.grade_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.grade_id IS NOT DISTINCT FROM OLD.grade_id THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.belt_promotions (beneficiary_id, discipline_id, grade_id, promoted_on)
  VALUES (NEW.beneficiary_id, NEW.discipline_id, NEW.grade_id, public.chile_today())
  ON CONFLICT (beneficiary_id, grade_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sport_profiles_belt_promotion ON public.sport_profiles;
CREATE TRIGGER trg_sport_profiles_belt_promotion
  AFTER INSERT OR UPDATE OF grade_id ON public.sport_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_belt_promotion();

-- Backfill: el grado actual de cada alumno, fechado en su última edición.
INSERT INTO public.belt_promotions (beneficiary_id, discipline_id, grade_id, promoted_on)
SELECT sp.beneficiary_id, sp.discipline_id, sp.grade_id,
       (timezone('America/Santiago', sp.updated_at))::date
FROM public.sport_profiles sp
WHERE sp.grade_id IS NOT NULL
ON CONFLICT (beneficiary_id, grade_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6) RPC de la comunidad (requieren sesión)
-- ------------------------------------------------------------

-- Buscador: nombre, apodo o alias (sin tildes) + filtros.
CREATE OR REPLACE FUNCTION public.search_athletes(
  p_query text DEFAULT NULL,
  p_discipline_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  profile_id uuid,
  alias text,
  full_name text,
  nickname text,
  category text,
  discipline_name text,
  grade_name text,
  grade_color text,
  medals integer,
  trophies integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_q text := nullif(public.athlete_normalize(trim(coalesce(p_query, ''))), '');
  v_category text := CASE WHEN p_category IN ('nino', 'juvenil', 'adulto') THEN p_category END;
  v_admin boolean := public.is_admin();
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, ap.alias AS a_alias, p.full_name AS a_name, ap.nickname AS a_nick,
           public.athlete_category(p.birth_date) AS a_cat, b.id AS bid,
           ap.primary_discipline_id AS a_primary
    FROM public.profiles p
    JOIN public.athlete_profiles ap ON ap.profile_id = p.id
    JOIN public.beneficiaries b ON b.profile_id = p.id
    WHERE p.active
      AND p.role_id <> 1
      AND (v_admin OR p.id = v_uid OR (ap.visibility = 'comunidad' AND NOT ap.hidden_by_admin))
      AND (v_q IS NULL
           OR public.athlete_normalize(p.full_name) LIKE '%' || v_q || '%'
           OR public.athlete_normalize(ap.nickname) LIKE '%' || v_q || '%'
           OR ap.alias LIKE '%' || v_q || '%')
      AND (v_category IS NULL OR public.athlete_category(p.birth_date) = v_category)
      AND (p_discipline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sport_profiles s
        WHERE s.beneficiary_id = b.id AND s.discipline_id = p_discipline_id
      ))
  ),
  scored AS (
    SELECT base.*,
      (SELECT count(*)::integer FROM public.sports_podiums sp
        WHERE sp.beneficiary_id = base.bid AND sp.position IN ('1', '2', '3')) AS a_medals,
      (SELECT count(*)::integer FROM public.athlete_trophies t
        WHERE t.beneficiary_id = base.bid) AS a_trophies
    FROM base
  )
  SELECT s.pid, s.a_alias, s.a_name, s.a_nick, s.a_cat,
         belt.d_name, belt.g_name, belt.g_color, s.a_medals, s.a_trophies
  FROM scored s
  LEFT JOIN LATERAL (
    SELECT d.name AS d_name, g.name AS g_name, g.color AS g_color
    FROM public.sport_profiles sp
    JOIN public.disciplines d ON d.id = sp.discipline_id
    LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = s.bid
    ORDER BY (sp.discipline_id = p_discipline_id) DESC NULLS LAST,
             (sp.discipline_id = s.a_primary) DESC NULLS LAST,
             g.position DESC NULLS LAST
    LIMIT 1
  ) belt ON true
  ORDER BY CASE WHEN v_q IS NULL THEN s.a_medals + s.a_trophies ELSE 0 END DESC,
           s.a_name
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

-- Perfil completo por alias, id de cuenta o 'yo' (la cuenta propia).
CREATE OR REPLACE FUNCTION public.get_athlete_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_handle text := lower(trim(coalesce(p_handle, '')));
  v_pid uuid;
  v_p public.profiles%ROWTYPE;
  v_ap public.athlete_profiles%ROWTYPE;
  v_bid uuid;
  v_owner boolean;
  v_member_since date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  IF v_handle IN ('', 'yo') THEN
    v_pid := v_uid;
  ELSIF v_handle ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_pid := v_handle::uuid;
  ELSE
    SELECT ap.profile_id INTO v_pid FROM public.athlete_profiles ap WHERE ap.alias = v_handle;
  END IF;
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_pid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_owner := v_pid = v_uid;

  -- Las cuentas de administración no tienen perfil de atleta visible.
  IF v_p.role_id = 1 AND NOT v_owner AND NOT v_admin THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_athlete_profile(v_pid);
  SELECT * INTO v_ap FROM public.athlete_profiles WHERE profile_id = v_pid;
  SELECT id INTO v_bid FROM public.beneficiaries WHERE profile_id = v_pid;

  IF NOT (v_owner OR v_admin) AND (v_ap.hidden_by_admin OR v_ap.visibility = 'privado') THEN
    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme
      )
    );
  END IF;

  SELECT coalesce(
    (SELECT min(ae.start_date) FROM public.academy_enrollments ae WHERE ae.beneficiary_id = v_bid),
    (timezone('America/Santiago', v_p.created_at))::date
  ) INTO v_member_since;

  RETURN jsonb_build_object(
    'restricted', false,
    'profile', jsonb_build_object(
      'id', v_p.id,
      'alias', v_ap.alias,
      'full_name', v_p.full_name,
      'nickname', v_ap.nickname,
      'bio', v_ap.bio,
      'cover_theme', v_ap.cover_theme,
      'visibility', v_ap.visibility,
      'hidden_by_admin', v_ap.hidden_by_admin,
      'primary_discipline_id', v_ap.primary_discipline_id,
      'category', public.athlete_category(v_p.birth_date),
      'member_since', v_member_since,
      'active', v_p.active,
      'is_owner', v_owner
    ),
    'disciplines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'discipline_id', d.id,
        'name', d.name,
        'color_hex', d.color_hex,
        'grade_name', g.name,
        'grade_color', g.color,
        'grade_position', g.position
      ) ORDER BY d.name)
      FROM public.sport_profiles sp
      JOIN public.disciplines d ON d.id = sp.discipline_id
      LEFT JOIN public.belt_grades g ON g.id = sp.grade_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'podiums', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'tournament', sp.tournament,
        'event_date', sp.event_date,
        'discipline', d.name,
        'category', sp.category,
        'position', sp.position,
        'description', sp.description
      ) ORDER BY sp.event_date DESC)
      FROM public.sports_podiums sp
      LEFT JOIN public.disciplines d ON d.id = sp.discipline_id
      WHERE sp.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'trophies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'awarded_on', t.awarded_on,
        'discipline', d.name
      ) ORDER BY t.awarded_on DESC)
      FROM public.athlete_trophies t
      LEFT JOIN public.disciplines d ON d.id = t.discipline_id
      WHERE t.beneficiary_id = v_bid
    ), '[]'::jsonb),
    'promotions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id,
        'discipline', d.name,
        'grade_name', g.name,
        'grade_color', g.color,
        'promoted_on', bp.promoted_on
      ) ORDER BY bp.promoted_on DESC, g.position DESC)
      FROM public.belt_promotions bp
      JOIN public.disciplines d ON d.id = bp.discipline_id
      JOIN public.belt_grades g ON g.id = bp.grade_id
      WHERE bp.beneficiary_id = v_bid
    ), '[]'::jsonb)
  );
END;
$$;

-- El alumno personaliza su propio perfil (nunca grados ni logros).
CREATE OR REPLACE FUNCTION public.update_my_athlete_profile(
  p_alias text,
  p_nickname text,
  p_bio text,
  p_primary_discipline_id uuid,
  p_cover_theme text,
  p_visibility text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alias text := lower(trim(coalesce(p_alias, '')));
  v_nickname text := nullif(trim(coalesce(p_nickname, '')), '');
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;
  IF v_alias !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' THEN
    RAISE EXCEPTION 'ALIAS_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.athlete_profiles WHERE alias = v_alias AND profile_id <> v_uid) THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_nickname IS NOT NULL AND char_length(v_nickname) > 40 THEN
    RAISE EXCEPTION 'NICKNAME_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF v_bio IS NOT NULL AND char_length(v_bio) > 150 THEN
    RAISE EXCEPTION 'BIO_TOO_LONG' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_cover_theme, '') NOT IN ('fuego', 'oro', 'brasa', 'acero', 'noche') THEN
    RAISE EXCEPTION 'COVER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_visibility, '') NOT IN ('comunidad', 'privado') THEN
    RAISE EXCEPTION 'VISIBILITY_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF p_primary_discipline_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sport_profiles sp
    JOIN public.beneficiaries b ON b.id = sp.beneficiary_id
    WHERE b.profile_id = v_uid AND sp.discipline_id = p_primary_discipline_id
  ) THEN
    RAISE EXCEPTION 'DISCIPLINE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_athlete_profile(v_uid);

  BEGIN
    UPDATE public.athlete_profiles
    SET alias = v_alias,
        nickname = v_nickname,
        bio = v_bio,
        primary_discipline_id = p_primary_discipline_id,
        cover_theme = p_cover_theme,
        visibility = p_visibility
    WHERE profile_id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN v_alias;
END;
$$;

-- ------------------------------------------------------------
-- 7) Permisos de funciones
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_athlete_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_athlete_profile(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_athlete_profile_on_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_athlete_profile_on_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.record_belt_promotion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_belt_promotion() FROM anon, authenticated;
