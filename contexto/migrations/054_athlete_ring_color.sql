-- ============================================================
-- 054_athlete_ring_color.sql
-- Perfil de Atleta: el borde del avatar es SIEMPRE el color del
-- cinturón (blanco si no tiene). En un perfil privado u oculto la
-- respuesta restringida no traía el cinturón; ahora incluye solo
-- 'ring_color' (color del grado de la disciplina principal o del
-- mayor grado). Requiere la 052. Idempotente.
-- ============================================================

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
  v_ring_color text;
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
    -- Solo el color del cinturón (disciplina principal o mayor grado)
    -- para el borde del avatar; ningún otro dato deportivo.
    SELECT g.color INTO v_ring_color
    FROM public.sport_profiles sp
    JOIN public.belt_grades g ON g.id = sp.grade_id
    WHERE sp.beneficiary_id = v_bid
    ORDER BY (sp.discipline_id = v_ap.primary_discipline_id) DESC NULLS LAST, g.position DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'restricted', true,
      'profile', jsonb_build_object(
        'alias', v_ap.alias,
        'full_name', v_p.full_name,
        'nickname', v_ap.nickname,
        'cover_theme', v_ap.cover_theme,
        'avatar_key', v_ap.avatar_key,
        'cover_image', v_ap.cover_image,
        'ring_color', v_ring_color
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

REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_athlete_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile(text) TO authenticated;
