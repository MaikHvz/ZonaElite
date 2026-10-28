-- ============================================================
-- 047_changelog_v1_16_0.sql
-- Entrada de changelog v1.16.0: el QR de asistencia identifica la
-- clase (disciplina, horario y categorías) y avisa si la clase ya
-- terminó. Sin cambios de esquema.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.16.0 — El QR de asistencia muestra la clase
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.16.0',
  'El QR de asistencia muestra la clase',
  E'• Sobre el QR de asistencia se muestra en grande el nombre de la clase, el horario, el profesor y si es para niños, juveniles, adultos o varias categorías.\n• Si la clase ya terminó y el QR sigue activo, aparece un aviso para finalizar la asistencia antes de abrir el QR de la clase siguiente.\n• Al escanear, el alumno ve qué clase está marcando antes de confirmar. Si la clase ya terminó o no corresponde a su categoría, se le avisa para que lo confirme con el profesor.'
)
ON CONFLICT (version) DO NOTHING;
