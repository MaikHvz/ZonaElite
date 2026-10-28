-- ============================================================
-- 050_athlete_posts.sql
-- Perfil de Atleta: el alumno publica por su cuenta (v1.18.0).
-- Requisito: contexto/requisitos/perfil-atleta-rankings.md (§0)
--
-- - athlete_posts: logros declarados por el alumno (torneo con
--   resultado, cinturón, trofeo, hito) y publicaciones libres de
--   texto. Se publican al instante, sin pasar por el admin. En el
--   perfil se distinguen de los registros de la academia, que
--   llevan la insignia "Verificado por ZonaElite".
-- - athlete_profiles.pinned_posts: hasta 3 publicaciones fijadas
--   (claves "podio-<uuid>", "cinturon-<uuid>", "trofeo-<uuid>",
--   "propio-<uuid>").
-- - get_athlete_profile y search_athletes se reemplazan para
--   incluir las publicaciones propias (también suman en los
--   contadores de medallas y trofeos).
-- - Sin imágenes. El admin puede borrar cualquier publicación.
-- Requiere la 048. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Publicaciones del alumno
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athlete_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid NOT NULL,
  kind text NOT NULL,
  title text,
  body text,
  event_date date NOT NULL,
  position text,
  discipline text,
  color text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT athlete_posts_pkey PRIMARY KEY (id),
  CONSTRAINT athlete_posts_profile_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT athlete_posts_kind_check
    CHECK (kind IN ('torneo', 'cinturon', 'trofeo', 'hito', 'publicacion')),
  CONSTRAINT athlete_posts_title_check
    CHECK (
      (kind = 'publicacion' AND (title IS NULL OR char_length(title) <= 80))
      OR (kind <> 'publicacion' AND title IS NOT NULL AND char_length(trim(title)) BETWEEN 1 AND 80)
    ),
  CONSTRAINT athlete_posts_body_check
    CHECK (
      (body IS NULL OR char_length(body) <= 1000)
      AND (kind <> 'publicacion' OR (body IS NOT NULL AND char_length(trim(body)) >= 1))
    ),
  CONSTRAINT athlete_posts_discipline_length
    CHECK (discipline IS NULL OR char_length(discipline) <= 60),
  CONSTRAINT athlete_posts_color_check
    CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$')
);

-- Torneo exige resultado; los demás tipos no lo llevan. "IS NOT NULL"
-- explícito: un CHECK que evalúa a NULL deja pasar la fila.
ALTER TABLE public.athlete_posts DROP CONSTRAINT IF EXISTS athlete_posts_position_check;
ALTER TABLE public.athlete_posts
  ADD CONSTRAINT athlete_posts_position_check CHECK (
    (kind = 'torneo' AND position IS NOT NULL AND position IN ('1', '2', '3', 'participacion'))
    OR (kind <> 'torneo' AND position IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_athlete_posts_profile
  ON public.athlete_posts (profile_id, event_date DESC);

-- Lectura dueño o admin (la comunidad lee por get_athlete_profile).
-- El alumno escribe solo lo suyo; el admin puede moderar todo.
ALTER TABLE public.athlete_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_posts_select_own_or_admin" ON public.athlete_posts;
CREATE POLICY "athlete_posts_select_own_or_admin" ON public.athlete_posts
  FOR SELECT USING (profile_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "athlete_posts_owner_insert" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_insert" ON public.athlete_posts
  FOR INSERT WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_owner_update" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_update" ON public.athlete_posts
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_owner_delete" ON public.athlete_posts;
CREATE POLICY "athlete_posts_owner_delete" ON public.athlete_posts
  FOR DELETE USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "athlete_posts_admin_write" ON public.athlete_posts;
CREATE POLICY "athlete_posts_admin_write" ON public.athlete_posts
  FOR ALL USING (public.is_admin());

DROP TRIGGER IF EXISTS set_athlete_posts_updated_at ON public.athlete_posts;
CREATE TRIGGER set_athlete_posts_updated_at
  BEFORE UPDATE ON public.athlete_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- 2) Publicaciones fijadas
-- ------------------------------------------------------------
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS pinned_posts text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_pinned_max;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_pinned_max CHECK (cardinality(pinned_posts) <= 3);

CREATE OR REPLACE FUNCTION public.set_my_pinned_posts(p_keys text[])
RETURNS text[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_keys text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(DISTINCT k), '{}'::text[]) INTO v_keys
  FROM unnest(coalesce(p_keys, '{}'::text[])) AS k;

  IF cardinality(v_keys) > 3 THEN
    RAISE EXCEPTION 'PIN_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) AS k
    WHERE k !~ '^(podio|cinturon|trofeo|propio)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'PIN_INVALID' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_athlete_profile(v_uid);
  UPDATE public.athlete_profiles SET pinned_posts = v_keys WHERE profile_id = v_uid;
  RETURN v_keys;
END;
$$;

-- ------------------------------------------------------------
-- 3) Buscador: las publicaciones propias suman medallas y trofeos
-- ------------------------------------------------------------
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
        WHERE sp.beneficiary_id = base.bid AND sp.position IN ('1', '2', '3'))
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'torneo' AND po.position IN ('1', '2', '3')) AS a_medals,
      (SELECT count(*)::integer FROM public.athlete_trophies t
        WHERE t.beneficiary_id = base.bid)
      + (SELECT count(*)::integer FROM public.athlete_posts po
        WHERE po.profile_id = base.pid AND po.kind = 'trofeo') AS a_trophies
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

-- ------------------------------------------------------------
-- 4) Perfil: publicaciones propias, fijadas y modo admin
-- ------------------------------------------------------------
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
    'viewer_is_admin', v_admin,
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
      'pinned_posts', to_jsonb(v_ap.pinned_posts),
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
    ), '[]'::jsonb),
    'posts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', po.id,
        'kind', po.kind,
        'title', po.title,
        'body', po.body,
        'event_date', po.event_date,
        'position', po.position,
        'discipline', po.discipline,
        'color', po.color,
        'created_at', po.created_at
      ) ORDER BY po.event_date DESC, po.created_at DESC)
      FROM public.athlete_posts po
      WHERE po.profile_id = v_pid
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 5) Permisos de funciones
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_my_pinned_posts(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_pinned_posts(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_pinned_posts(text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;
