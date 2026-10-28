-- ============================================================
-- 052_athlete_avatar_cover.sql
-- Perfil de Atleta: avatares y portadas ilustradas (v1.19.0).
-- Requisito: contexto/requisitos/perfil-atleta-rankings.md (§0)
--
-- - athlete_profiles.avatar_key: avatar ilustrado elegido por el
--   alumno (catálogo ATHLETE_AVATARS de la app; NULL = iniciales).
-- - athlete_profiles.cover_image: portada ilustrada (SVG en
--   public/athletes/banners; NULL = degradado de cover_theme).
-- - Sin subida de imágenes: solo claves de catálogos fijos. La BD
--   valida el formato; la app ignora claves que no conoce.
-- - update_my_athlete_profile suma p_avatar_key y p_cover_image;
--   get_athlete_profile y search_athletes devuelven las claves
--   (search_athletes cambia su tipo de retorno: DROP + CREATE).
-- Requiere la 048 y la 050. Idempotente.
-- ============================================================

ALTER TABLE public.athlete_profiles ADD COLUMN IF NOT EXISTS avatar_key text;
ALTER TABLE public.athlete_profiles ADD COLUMN IF NOT EXISTS cover_image text;

ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_avatar_key_format;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_avatar_key_format
  CHECK (avatar_key IS NULL OR avatar_key ~ '^[a-z0-9-]{1,30}$');
ALTER TABLE public.athlete_profiles DROP CONSTRAINT IF EXISTS athlete_profiles_cover_image_format;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_cover_image_format
  CHECK (cover_image IS NULL OR cover_image ~ '^[a-z0-9-]{1,30}$');

-- La firma cambia (2 parámetros nuevos): se elimina la versión de 6.
DROP FUNCTION IF EXISTS public.update_my_athlete_profile(text, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.update_my_athlete_profile(
  p_alias text,
  p_nickname text,
  p_bio text,
  p_primary_discipline_id uuid,
  p_cover_theme text,
  p_visibility text,
  p_avatar_key text DEFAULT NULL,
  p_cover_image text DEFAULT NULL
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
  v_avatar text := nullif(trim(coalesce(p_avatar_key, '')), '');
  v_cover_image text := nullif(trim(coalesce(p_cover_image, '')), '');
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
  IF v_avatar IS NOT NULL AND v_avatar !~ '^[a-z0-9-]{1,30}$' THEN
    RAISE EXCEPTION 'AVATAR_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_cover_image IS NOT NULL AND v_cover_image !~ '^[a-z0-9-]{1,30}$' THEN
    RAISE EXCEPTION 'COVER_INVALID' USING ERRCODE = 'P0001';
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
        visibility = p_visibility,
        avatar_key = v_avatar,
        cover_image = v_cover_image
    WHERE profile_id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALIAS_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN v_alias;
END;
$$;

-- El tipo de retorno cambia (+ avatar_key): DROP + CREATE.
DROP FUNCTION IF EXISTS public.search_athletes(text, uuid, text, integer);

CREATE FUNCTION public.search_athletes(
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
  avatar_key text,
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
           ap.primary_discipline_id AS a_primary, ap.avatar_key AS a_avatar
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
         belt.d_name, belt.g_name, belt.g_color, s.a_avatar, s.a_medals, s.a_trophies
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
        'cover_theme', v_ap.cover_theme,
        'avatar_key', v_ap.avatar_key,
        'cover_image', v_ap.cover_image
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
      'avatar_key', v_ap.avatar_key,
      'cover_image', v_ap.cover_image,
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

REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_athlete_profile(text, text, text, uuid, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_athletes(text, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_athletes(text, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;
