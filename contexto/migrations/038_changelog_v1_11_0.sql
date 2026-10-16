-- ============================================================
-- 038_changelog_v1_11_0.sql
-- Entrada de changelog v1.11.0: una cuenta por persona
-- (anti-duplicados, migración 037).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.11.0 — Una cuenta por persona
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.11.0',
  'Una cuenta por persona',
  E'• El registro ahora pide RUT y fecha de nacimiento, y no permite crear una segunda cuenta con un RUT ya registrado.\n• Tampoco se pueden crear cuentas con correos equivalentes (por ejemplo, en Gmail los puntos no cuentan: "juan.perez@gmail.com" y "juanperez@gmail.com" son el mismo correo).\n• Al crear un usuario desde el panel de administración, si ya existe una cuenta con ese RUT o correo se muestra a quién corresponde en lugar de crear un duplicado. Si solo coinciden el nombre y la fecha de nacimiento, se muestra una advertencia y se puede crear de todas formas.\n• El perfil valida el RUT y avisa si ya pertenece a otra cuenta.\n• Los alumnos sin RUT o sin fecha de nacimiento ven un aviso en su panel para completarlos.'
)
ON CONFLICT (version) DO NOTHING;
