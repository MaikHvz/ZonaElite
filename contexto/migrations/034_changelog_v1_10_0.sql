-- ============================================================
-- 034_changelog_v1_10_0.sql
-- Entrada de changelog v1.10.0: Lista de asistencia a eventos
-- (inscripción del usuario + panel admin).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.10.0 — Lista de asistencia a eventos
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.10.0',
  'Lista de asistencia a eventos',
  E'• Ahora puedes inscribirte a un evento desde su ficha (/eventos/[id]): el botón "Inscribirse" abre una confirmación con el nombre del evento y, al confirmar, se agrega tu nombre (y el de tus cargas) a la lista de asistencia del evento.\n• Al inscribirte verás un mensaje de "Confirmación exitosa" y el botón principal cambia a "Inscrito".\n• Si te registraste por error, pasa el mouse sobre "Inscrito" y haz clic: aparecerá el aviso "Eliminar asistencia" y una confirmación para borrar tu participación de la lista.\n• El administrador ve cuántos inscritos tiene cada evento en Eventos, y con el botón de la lista de asistencia puede ver quién se anotó (nombre, categoría y fecha) y quitar a alguien si corresponde.\n• Las inscripciones a eventos son independientes de las clases: no consumen tokens ni requieren membresía activa.'
)
ON CONFLICT (version) DO NOTHING;