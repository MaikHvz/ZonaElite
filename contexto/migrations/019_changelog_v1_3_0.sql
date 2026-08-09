-- ============================================================
-- 019_changelog_v1_3_0.sql
-- Entrada de changelog v1.3.0: Datos físicos (peso, altura y mano
-- dominante) en el perfil del tutor y en las cargas, con una card
-- "Datos Físicos" editable en la ficha médica del dashboard, y el
-- botón "Ver Ficha" (solo lectura) en la sección Usuarios del
-- panel de administración.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.3.0 — Datos físicos y ver ficha
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.3.0',
  'Datos Físicos y Ver Ficha',
  E'• El perfil del tutor ahora incluye datos físicos: peso (kg), altura (cm) y mano dominante (diestro o zurdo), validados con rangos permitidos (peso hasta 300 kg y altura hasta 250 cm).\n• Las cargas (niño/adulto) también tienen datos físicos: se pueden registrar al crear o editar la carga, y cada tarjeta los muestra si existen.\n• La ficha médica del dashboard incluye una card editable "Datos Físicos" donde el tutor actualiza peso, altura y mano dominante de la carga.\n• En la sección Usuarios del panel de administración, cada carga tiene un botón "Ver Ficha" que abre una ficha de solo lectura con los datos físicos y personales.'
)
ON CONFLICT (version) DO NOTHING;
