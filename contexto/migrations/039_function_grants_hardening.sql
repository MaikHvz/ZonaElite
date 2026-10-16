-- ============================================================
-- 039_function_grants_hardening.sql
-- Cierra funciones SECURITY DEFINER expuestas por los permisos por
-- defecto de Supabase (verificado en la BD real, 2026-10-16).
--
-- Supabase otorga EXECUTE a anon y authenticated de forma DIRECTA
-- (ALTER DEFAULT PRIVILEGES), no vía PUBLIC. Por eso los
-- "REVOKE ALL ... FROM PUBLIC" de migraciones anteriores no bastaban:
-- - find_account_conflicts (037): devolvía nombre + correo de la
--   cuenta coincidente a cualquier visitante.
-- - decrement/increment_product_stock (020): sin chequeo interno;
--   cualquiera podía vaciar o inflar el stock de la tienda. Solo las
--   usa el servidor con service role (src/lib/store.ts).
-- - notify_token_return: sin chequeo interno; cualquiera podía crear
--   una notificación "Token devuelto" para cualquier usuario. Se
--   llama desde /admin/asistencia (markAttendance) con sesión de
--   staff, así que se agrega el guard is_staff().
--
-- Idempotente.
-- ============================================================

-- find_account_conflicts: solo service role (/api/admin/create-user).
REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_account_conflicts(text, text, text, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_account_conflicts(text, text, text, date) TO service_role;

-- Stock de la tienda: solo service role (checkout, callback Flow, admin orders).
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) TO service_role;

-- notify_token_return: misma notificación que antes, ahora solo staff.
CREATE OR REPLACE FUNCTION public.notify_token_return(
  p_user_id uuid,
  p_beneficiary_name text,
  p_session_date date,
  p_discipline_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sin permisos para notificar devoluciones de token' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_notifications (user_id, title, content)
  VALUES (
    p_user_id,
    'Token devuelto',
    FORMAT('Se devolvió 1 token por clase justificada el %s — %s para %s',
           TO_CHAR(p_session_date, 'DD/MM/YYYY'),
           p_discipline_name,
           p_beneficiary_name)
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_token_return(uuid, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_token_return(uuid, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_token_return(uuid, text, date, text) TO authenticated;
