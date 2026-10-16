-- ============================================================
-- 037_unique_accounts.sql
-- Una cuenta por persona (fase 1 del plan
-- contexto/requisitos/cuenta-unica-por-alumno.md): impedir perfiles
-- duplicados por RUT o por correo equivalente.
--
-- Contexto (BD real, 2026-10-16): Supabase Auth ya exige correo
-- EXACTO único, pero una misma persona pudo registrarse dos veces con
-- correos que difieren en un punto (Gmail ignora los puntos y lo que
-- va después de "+") y con el mismo RUT. Nadie validaba el RUT.
--
-- - normalize_rut(): solo dígitos y K, en mayúscula.
-- - canonical_email(): minúsculas; en gmail/googlemail sin puntos ni
--   "+etiqueta" en la parte local.
-- - Índices únicos sobre ambos. Se crean SOLO si no hay duplicados
--   existentes; si los hay se emite un WARNING y basta con volver a
--   ejecutar este archivo tras resolverlos (idempotente).
-- - handle_new_user() guarda rut y birth_date del registro: un RUT o
--   correo repetido hace fallar el alta (respaldo de la validación
--   previa en la app).
-- - check_registration_conflict(): pre-chequeo del formulario público
--   (devuelve solo un código, nunca datos de la otra cuenta).
-- - find_account_conflicts(): detalle para /api/admin/create-user
--   (solo service role).
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_rut(p_rut text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.canonical_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(lower(trim(coalesce(p_email, ''))), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN regexp_replace(
             split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1),
             '\.', '', 'g'
           ) || '@gmail.com'
    ELSE lower(trim(coalesce(p_email, '')))
  END;
$$;

-- ------------------------------------------------------------
-- Índices únicos (condicionales a que no existan duplicados).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.normalize_rut(rut) <> ''
    GROUP BY public.normalize_rut(rut)
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'profiles_rut_unique_idx NO creado: hay perfiles con el mismo RUT. Resuélvelos en /admin/usuarios y vuelve a ejecutar 037.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_idx
      ON public.profiles (public.normalize_rut(rut))
      WHERE public.normalize_rut(rut) <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    GROUP BY public.canonical_email(email)
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'profiles_email_canonical_unique_idx NO creado: hay perfiles con correos equivalentes. Resuélvelos y vuelve a ejecutar 037.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_canonical_unique_idx
      ON public.profiles (public.canonical_email(email));
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- handle_new_user(): ahora también guarda rut y birth_date que el
-- formulario de registro envía en raw_user_meta_data. Una fecha
-- inválida se ignora (no bloquea el alta). role_id queda en el
-- default (4).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rut text;
  v_birth date;
BEGIN
  v_rut := nullif(trim(coalesce(NEW.raw_user_meta_data->>'rut', '')), '');

  BEGIN
    v_birth := nullif(NEW.raw_user_meta_data->>'birth_date', '')::date;
  EXCEPTION WHEN others THEN
    v_birth := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, email, rut, birth_date)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_rut,
    v_birth
  );
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Pre-chequeo del registro público. Devuelve 'RUT_TAKEN',
-- 'EMAIL_TAKEN' o NULL. No expone datos de la cuenta existente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_registration_conflict(
  p_rut text,
  p_email text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.normalize_rut(p_rut) <> '' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.normalize_rut(rut) = public.normalize_rut(p_rut)
    ) THEN 'RUT_TAKEN'
    WHEN coalesce(trim(p_email), '') <> '' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.canonical_email(email) = public.canonical_email(p_email)
    ) THEN 'EMAIL_TAKEN'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.check_registration_conflict(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_registration_conflict(text, text) TO anon, authenticated;

-- ------------------------------------------------------------
-- Detalle de coincidencias para el admin (service role).
-- match: 'rut' | 'email' bloquean; 'name_birth' es advertencia.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_account_conflicts(
  p_rut text,
  p_email text,
  p_full_name text,
  p_birth_date date
)
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  email text,
  match text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, 'rut'::text
    FROM public.profiles p
   WHERE public.normalize_rut(p_rut) <> ''
     AND public.normalize_rut(p.rut) = public.normalize_rut(p_rut)
  UNION
  SELECT p.id, p.full_name, p.email, 'email'::text
    FROM public.profiles p
   WHERE coalesce(trim(p_email), '') <> ''
     AND public.canonical_email(p.email) = public.canonical_email(p_email)
  UNION
  SELECT p.id, p.full_name, p.email, 'name_birth'::text
    FROM public.profiles p
   WHERE p_birth_date IS NOT NULL
     AND p.birth_date = p_birth_date
     AND lower(trim(p.full_name)) = lower(trim(coalesce(p_full_name, '')));
$$;

-- Supabase otorga EXECUTE por defecto a anon/authenticated de forma
-- directa (default privileges), no vía PUBLIC: hay que revocarlo
-- explícitamente o la función queda expuesta con datos de terceros.
REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_account_conflicts(text, text, text, date) TO service_role;
