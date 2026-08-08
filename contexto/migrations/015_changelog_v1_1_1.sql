-- ============================================================
-- 015_changelog_v1_1_1.sql
-- Entrada de changelog v1.1.1: Crear y asignar carga desde admin.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.1.1 — Crear y asignar carga desde el panel admin
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.1',
  'Crear y Asignar Cargas desde el Panel Admin',
  E'• Nuevo botón "Crear y Asignar Carga" en la sección Usuarios del panel de administración: el administrador selecciona al usuario (padre/madre) al que se le asignará la carga e ingresa los datos completos del hijo/familiar (nombre, RUT, fecha de nacimiento y categoría).\n• La carga queda lista con el mismo comportamiento que una creada por el propio usuario: aparece en el panel del tutor y puede comprar membresía o inscripción para ella.\n• Las cargas existentes también pueden editarse directamente desde la misma tabla de usuarios.'
)
ON CONFLICT (version) DO NOTHING;
