-- ============================================================
-- 016_changelog_v1_1_2.sql
-- Entrada de changelog v1.1.2: Editar cargas en el panel del
-- usuario con validación de RUT.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.1.2 — Editar cargas desde el panel del usuario + validación RUT
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.2',
  'Editar Cargas y Validación de RUT',
  E'• En la sección "Mis Cargas" del panel del usuario, ahora puedes editar los datos de cada carga (nombre, RUT, fecha de nacimiento y categoría) con el botón "Editar datos".\n• El RUT se valida automáticamente con el formato chileno (dígito verificador): si el RUT ingresado no es válido, se muestra un aviso y no se guarda. La validación aplica tanto al agregar como al editar cargas.'
)
ON CONFLICT (version) DO NOTHING;
