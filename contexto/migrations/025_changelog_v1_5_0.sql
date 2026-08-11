-- ============================================================
-- 025_changelog_v1_5_0.sql
-- Entrada de changelog v1.5.0: Perfil deportivo de alumnos.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.5.0 — Perfil deportivo de alumnos
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.5.0',
  'Perfil deportivo de alumnos',
  E'• Cada alumno (titular o carga) ahora tiene un perfil deportivo con su disciplina y grado/cinturón, mostrado como tarjeta en "Mis Cargas".\n• El administrador asigna disciplina y grado desde la sección Usuarios con un botón dedicado por alumno.\n• Registro de podios: torneo, fecha, disciplina, categoría y lugar obtenido (1°, 2°, 3° o participación), con foto opcional.\n• Las tarjetas muestran la disciplina, el cinturón y el resumen de logros del alumno.'
)
ON CONFLICT (version) DO NOTHING;
