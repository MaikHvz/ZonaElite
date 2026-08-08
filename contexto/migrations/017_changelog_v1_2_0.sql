-- ============================================================
-- 017_changelog_v1_2_0.sql
-- Entrada de changelog v1.2.0: Nota de revisión en aprobaciones
-- de pago por transferencia + más feedback para usuario y admin.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.2.0 — Nota visible en aprobaciones + feedback de revisión
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.2.0',
  'Nota del Administrador en Aprobaciones y Mejor Feedback',
  E'• Ahora, al aprobar un pago por transferencia, el administrador puede dejar una nota (aunque todo esté en orden). La nota queda guardada y el usuario la ve en su panel "Mis Solicitudes de Pago", en el historial de pagos, en la notificación y en el correo.\n• El correo de aprobación ahora muestra la nota con la etiqueta "Nota del administrador" (y el rechazo conserva "Motivo del rechazo").\n• El administrador recibe una confirmación visual tras aprobar o rechazar una solicitud, y la lista de solicitudes muestra la nota tanto en aprobadas como en rechazadas.'
)
ON CONFLICT (version) DO NOTHING;
