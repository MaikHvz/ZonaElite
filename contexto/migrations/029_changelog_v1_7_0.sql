-- ============================================================
-- 029_changelog_v1_7_0.sql
-- Entrada de changelog v1.7.0: Histórico de asistencias en el panel admin.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.7.0 — Histórico de asistencias
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.7.0',
  'Histórico de asistencias',
  E'• El panel de Asistencia del administrador ahora tiene una pestaña "Histórico" que muestra las clases ya pasadas a la fecha de hoy.\n• Permite acotar la búsqueda por rango de fechas (desde/hasta) y consultar el detalle de cada sesión pasada.\n• La asistencia de sesiones pasadas se puede corregir directamente (presente/ausente/justificado), reutilizando el flujo de guardado existente.'
)
ON CONFLICT (version) DO NOTHING;