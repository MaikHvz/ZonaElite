-- =====================================================================
-- MIGRACIÓN: Sistema de Tokens por Membresía
-- Fecha: 2026-07-27
-- Descripción: Agrega campo tokens a membership_plans, índices y funciones
-- =====================================================================

-- 1. Agregar columna tokens a membership_plans
-- NULL = ilimitado (sin restricción de clases)
-- Número entero = cantidad de clases incluidas en el periodo de vigencia
ALTER TABLE membership_plans 
ADD COLUMN IF NOT EXISTS tokens INTEGER NULL;

COMMENT ON COLUMN membership_plans.tokens IS 
'Número de clases incluidas en el plan. NULL = ilimitado (sin restricción).';

-- 2. Índices para rendimiento del cálculo de tokens
CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary 
ON class_enrollments(beneficiary_id);

CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_status 
ON attendance(beneficiary_id, status);

CREATE INDEX IF NOT EXISTS idx_class_enrollments_beneficiary_session 
ON class_enrollments(beneficiary_id, session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary_session_status 
ON attendance(beneficiary_id, session_id, status);

-- 3. Función para calcular tokens restantes
CREATE OR REPLACE FUNCTION public.get_remaining_tokens(
  p_beneficiary_id UUID,
  p_membership_id UUID
)
RETURNS TABLE (
  remaining INTEGER,
  total INTEGER,
  consumed INTEGER,
  justified INTEGER,
  is_unlimited BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_plan_tokens INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_consumed BIGINT;
  v_justified BIGINT;
BEGIN
  -- Obtener información de la membresía y el plan
  SELECT 
    mp.tokens,
    m.start_date,
    m.end_date
  INTO 
    v_plan_tokens,
    v_start_date,
    v_end_date
  FROM memberships m
  JOIN membership_plans mp ON m.plan_id = mp.id
  WHERE m.id = p_membership_id
    AND m.beneficiary_id = p_beneficiary_id
    AND m.status = 'activa';
  
  -- Si no se encuentra la membresía, retornar NULL
  IF v_plan_tokens IS NULL THEN
    remaining := NULL;
    total := NULL;
    consumed := 0;
    justified := 0;
    is_unlimited := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Contar inscripciones en el periodo (consumen token)
  SELECT COUNT(*)
  INTO v_consumed
  FROM class_enrollments ce
  JOIN class_sessions cs ON ce.session_id = cs.id
  WHERE ce.beneficiary_id = p_beneficiary_id
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date;
  
  -- Contar justificaciones en el periodo (devuelven token)
  SELECT COUNT(*)
  INTO v_justified
  FROM attendance a
  JOIN class_sessions cs ON a.session_id = cs.id
  WHERE a.beneficiary_id = p_beneficiary_id
    AND a.status = 'justificado'
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date;
  
  -- Calcular tokens restantes
  -- remaining = total - (inscripciones - justificaciones)
  remaining := v_plan_tokens - (v_consumed - v_justified);
  
  -- Si remaining es negativo, es deuda (se retorna tal cual)
  total := v_plan_tokens;
  consumed := v_consumed;
  justified := v_justified;
  is_unlimited := FALSE;
  
  RETURN NEXT;
END;
$$;

-- 4. Función para obtener detalle de deuda
CREATE OR REPLACE FUNCTION public.get_enrollment_debt(
  p_beneficiary_id UUID,
  p_membership_id UUID
)
RETURNS TABLE (
  enrollment_id UUID,
  session_date DATE,
  discipline_name TEXT,
  start_time TIME,
  end_time TIME,
  professor_name TEXT,
  source TEXT,
  enrolled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_token_info RECORD;
  v_excess_count BIGINT;
BEGIN
  -- Obtener información de tokens
  SELECT * INTO v_token_info
  FROM public.get_remaining_tokens(p_beneficiary_id, p_membership_id);
  
  -- Si es ilimitado o tiene tokens, no hay deuda
  IF v_token_info.is_unlimited OR v_token_info.remaining >= 0 THEN
    RETURN;
  END IF;
  
  -- Calcular cuántas inscripciones exceden los tokens
  v_excess_count := ABS(v_token_info.remaining);
  
  -- Retornar las últimas N inscripciones que generan la deuda
  RETURN QUERY
  SELECT 
    ce.id as enrollment_id,
    cs.session_date,
    d.name as discipline_name,
    s.start_time,
    s.end_time,
    p.full_name as professor_name,
    ce.source,
    ce.enrolled_at
  FROM class_enrollments ce
  JOIN class_sessions cs ON ce.session_id = cs.id
  JOIN schedules s ON cs.schedule_id = s.id
  JOIN disciplines d ON s.discipline_id = d.id
  JOIN profiles p ON s.professor_id = p.id
  WHERE ce.beneficiary_id = p_beneficiary_id
    AND cs.session_date >= (
      SELECT m.start_date 
      FROM memberships m 
      WHERE m.id = p_membership_id
    )
    AND cs.session_date <= (
      SELECT m.end_date 
      FROM memberships m 
      WHERE m.id = p_membership_id
    )
  ORDER BY cs.session_date DESC, ce.enrolled_at DESC
  LIMIT v_excess_count;
END;
$$;

-- 5. Comentarios
COMMENT ON FUNCTION public.get_remaining_tokens(UUID, UUID) IS 
'Retorna los tokens restantes para un beneficiario en una membresía específica.
Si el plan es ilimitado (tokens = NULL), retorna remaining = NULL y is_unlimited = TRUE.
Si remaining < 0, indica deuda (inscripciones exceden los tokens disponibles).';

COMMENT ON FUNCTION public.get_enrollment_debt(UUID, UUID) IS 
'Retorna el detalle de las inscripciones que generan deuda cuando los tokens se agotan.
Solo retorna datos cuando remaining < 0.';
