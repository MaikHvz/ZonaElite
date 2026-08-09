-- ============================================================
-- 018_changelog_v1_2_1.sql
-- Entrada de changelog v1.2.1: Dirección en perfil del tutor y en
-- cargas (dependents) con la opción "usar la misma dirección que
-- el tutor" al crear o editar una carga desde el dashboard y desde
-- el panel de administración.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.2.1 — Dirección en perfil y cargas
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.2.1',
  'Dirección en Perfil y Cargas',
  E'• El perfil del tutor ahora tiene un campo "Dirección".\n• Al crear o editar una carga (niño/adulto) desde el dashboard del usuario o desde el panel de administración, se puede indicar su dirección o usar el checkbox "Usar la misma dirección que el tutor", que autocompleta el dato desde el perfil.\n• Las cargas muestran su dirección en la tarjeta del dashboard.'
)
ON CONFLICT (version) DO NOTHING;
