-- ============================================================
-- 041_changelog_v1_12_0.sql
-- Entrada de changelog v1.12.0: migración de cargas a cuentas
-- propias (migración 040).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.12.0 — Migración de cargas a cuentas propias
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.12.0',
  'Migración de cargas a cuentas propias',
  E'• Nuevo panel "Migración de cargas" en el panel de administración: lista cada carga con su tutor y su historial, y permite crear la cuenta propia del alumno (o elegir una cuenta existente vacía) y trasladarle todo: membresías, matrículas, packs, inscripciones y asistencia a clases, pagos, eventos, ficha médica, perfil deportivo y podios.\n• El traslado no copia datos: el historial queda exactamente igual, solo cambia de dueño. Si algo sale mal, la migración se puede revertir desde la pestaña "Migradas".\n• Para los menores de edad se guardan en su perfil los datos del apoderado (nombre, teléfono y correo), que también pueden editarse desde "Mi perfil".\n• Ya no se pueden crear cargas nuevas: cada alumno se registra con su propia cuenta. Las cargas existentes se siguen viendo hasta que se migren.'
)
ON CONFLICT (version) DO NOTHING;
