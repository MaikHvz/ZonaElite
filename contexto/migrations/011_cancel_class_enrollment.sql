-- ============================================================
-- 011_cancel_class_enrollment.sql
-- Desinscripción de un beneficiario de una sesión desde el
-- panel admin/asistencia, con devolución real del token/clase
-- consumido y limpieza de deuda y asistencia.
--
-- - Normal: borra class_enrollments (por sesión o por horario
--   recurrente) -> get_remaining_tokens recalcula y el token
--   vuelve solo; elimina la deuda pendiente de la sesión que
--   materializó el check-in QR sin tokens; limpia attendance.
-- - Personalizada: borra personalized_enrollments y restaura 1
--   clase al pack (used_classes-1, status 'activa').
-- - Notifica al titular del beneficiario (user_notifications).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_class_enrollment(
  p_session_id uuid,
  p_beneficiary_id uuid
)
RETURNS TABLE (
  removed boolean,
  token_returned boolean,
  attendance_deleted boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_is_admin boolean;
  v_session_date date;
  v_schedule_id uuid;
  v_schedule_mode text;
  v_discipline_name text;
  v_owner_id uuid;
  v_beneficiary_name text;
  v_enrollment_id uuid;
  v_pack_id uuid;
  v_class_deleted integer;
  v_attendance_deleted integer;
BEGIN
  -- Solo admin puede desinscribir desde el panel.
  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = 'P0001';
  END IF;

  SELECT cs.session_date, cs.schedule_id, s.mode, d.name
    INTO v_session_date, v_schedule_id, v_schedule_mode, v_discipline_name
    FROM public.class_sessions cs
    JOIN public.schedules s ON s.id = cs.schedule_id
    LEFT JOIN public.disciplines d ON d.id = s.discipline_id
    WHERE cs.id = p_session_id;

  IF v_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no encontrada' USING ERRCODE = 'P0001';
  END IF;

  -- Titular del beneficiario (adulto = profile_id, niño = tutor_id).
  SELECT COALESCE(dep.tutor_id, b.profile_id),
         COALESCE(dep.full_name, p.full_name, 'Alumno')
    INTO v_owner_id, v_beneficiary_name
    FROM public.beneficiaries b
    LEFT JOIN public.profiles p ON p.id = b.profile_id
    LEFT JOIN public.dependents dep ON dep.id = b.dependent_id
    WHERE b.id = p_beneficiary_id;

  IF v_schedule_mode = 'personalizado' THEN
    -- Inscripción de modalidad personalizada: restaura la clase al pack.
    SELECT pe.id, pe.pack_id
      INTO v_enrollment_id, v_pack_id
      FROM public.personalized_enrollments pe
      WHERE pe.session_id = p_session_id AND pe.beneficiary_id = p_beneficiary_id;

    IF v_enrollment_id IS NULL THEN
      RETURN QUERY SELECT false, false, false,
        'El beneficiario no está inscrito en esta sesión';
      RETURN;
    END IF;

    -- Devuelve 1 clase al pack y lo reactiva si había quedado 'agotada'.
    UPDATE public.personalized_packs
      SET used_classes = GREATEST(used_classes - 1, 0),
          status = 'activa'
      WHERE id = v_pack_id;

    DELETE FROM public.attendance
      WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id;
    GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

    DELETE FROM public.personalized_enrollments WHERE id = v_enrollment_id;

    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, title, content)
      VALUES (
        v_owner_id,
        'Clase devuelta',
        FORMAT('Se devolvió 1 clase de tu pack por desinscripción de la clase del %s — %s para %s.',
               TO_CHAR(v_session_date, 'DD/MM/YYYY'),
               COALESCE(v_discipline_name, 'Clase'),
               v_beneficiary_name)
      );
    END IF;

    RETURN QUERY SELECT true, true, v_attendance_deleted > 0,
      'Inscripción eliminada y clase del pack devuelta';
    RETURN;
  END IF;

  -- Modalidad normal: cubre inscripción a la sesión puntual y a la
  -- inscripción recurrente por horario (session_id IS NULL).
  DELETE FROM public.class_enrollments
    WHERE beneficiary_id = p_beneficiary_id
      AND (session_id = p_session_id
           OR (schedule_id = v_schedule_id AND session_id IS NULL));
  GET DIAGNOSTICS v_class_deleted = ROW_COUNT;

  -- Deuda pendiente que materializó el check-in QR sin tokens (fase 10).
  DELETE FROM public.debts
    WHERE beneficiary_id = p_beneficiary_id
      AND session_id = p_session_id
      AND status = 'pendiente';

  DELETE FROM public.attendance
    WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id;
  GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

  IF v_class_deleted = 0 THEN
    RETURN QUERY SELECT false, false, v_attendance_deleted > 0,
      'El beneficiario no está inscrito en esta sesión';
    RETURN;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, title, content)
    VALUES (
      v_owner_id,
      'Token devuelto',
      FORMAT('Se devolvió 1 token por desinscripción de la clase del %s — %s para %s.',
             TO_CHAR(v_session_date, 'DD/MM/YYYY'),
             COALESCE(v_discipline_name, 'Clase'),
             v_beneficiary_name)
    );
  END IF;

  RETURN QUERY SELECT true, true, v_attendance_deleted > 0,
    'Inscripción eliminada y token devuelto';
END;
$$;

-- Exponer solo a usuarios autenticados (la función valida admin por dentro).
REVOKE ALL ON FUNCTION public.cancel_class_enrollment(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_class_enrollment(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_class_enrollment(UUID, UUID) IS
'Desinscribe a un beneficiario de una sesión (solo admin). En modalidad normal borra class_enrollments (por sesión u horario recurrente) y la deuda pendiente de la sesión, devolviendo el token automáticamente vía get_remaining_tokens; en modalidad personalizada restaura 1 clase al pack. Limpia attendance y notifica al titular.';
