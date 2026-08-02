-- =============================================================
-- Migración 005 — get_remaining_tokens atado a la membresía (B-010)
--
-- Problema: el conteo de clases consumidas (v_consumed) y de
-- justificaciones (v_justified) NO está atado a la membresía
-- consultada (p_membership_id). Solo filtra por el rango de fechas
-- de la membresía y por ce.enrolled_at >= v_created_at, pero SIN
-- límite superior. Con membresías cuyo periodo de vigencia se
-- solapa (renovación antes de vencer, o el escenario de 2 activas
-- que era B-002), las reservas de una membresía podían contarse
-- contra otra.
--
-- Solución: el conteo es dinámico (se calcula en cada llamada,
-- no se almacena) y queda atado a la membresía que el usuario
-- tiene: una reserva "pertenece" a la membresía cuya ventana de
-- vigencia contiene el momento en que se hizo (ce.enrolled_at).
-- Se agrega el límite superior faltante:
--     ce.enrolled_at < (v_end_date + interval '1 day')
-- junto al ya existente ce.enrolled_at >= v_created_at.
-- Como B-002 garantiza una sola membresía activa por beneficiario,
-- esta ventana identifica de forma inequívoca la membresía.
--
-- Es idempotente (CREATE OR REPLACE). No cambia firmas ni grants.
-- =============================================================

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
  v_created_at TIMESTAMPTZ;
  v_consumed BIGINT;
  v_justified BIGINT;
BEGIN
  -- Obtener información de la membresía y el plan
  SELECT 
    mp.tokens,
    m.start_date,
    m.end_date,
    m.created_at
  INTO 
    v_plan_tokens,
    v_start_date,
    v_end_date,
    v_created_at
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
  -- B-010: la reserva pertenece a esta membresía si se hizo dentro
  -- de su ventana de vigencia [created_at, end_date]. El límite
  -- superior evita que reservas hechas con otra membresía
  -- (o vencida la actual) cuenten contra esta.
  SELECT COUNT(*)
  INTO v_consumed
  FROM class_enrollments ce
  JOIN class_sessions cs ON ce.session_id = cs.id
  WHERE ce.beneficiary_id = p_beneficiary_id
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date
    AND ce.enrolled_at >= v_created_at
    AND ce.enrolled_at < (v_end_date + INTERVAL '1 day');
  
  -- Contar justificaciones en el periodo (devuelven token)
  -- Unimos con class_enrollments para verificar que la justificación
  -- pertenece a una inscripción de esta misma membresía.
  SELECT COUNT(*)
  INTO v_justified
  FROM attendance a
  JOIN class_sessions cs ON a.session_id = cs.id
  JOIN class_enrollments ce ON ce.session_id = cs.id AND ce.beneficiary_id = a.beneficiary_id
  WHERE a.beneficiary_id = p_beneficiary_id
    AND a.status = 'justificado'
    AND cs.session_date >= v_start_date
    AND cs.session_date <= v_end_date
    AND ce.enrolled_at >= v_created_at
    AND ce.enrolled_at < (v_end_date + INTERVAL '1 day');
  
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

-- B-011: consolidación — esta es la definición canónica de
-- get_remaining_tokens. El esquema documentado deja una sola copia.
