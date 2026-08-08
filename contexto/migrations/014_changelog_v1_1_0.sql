-- ============================================================
-- 014_changelog_v1_1_0.sql
-- Entrada de changelog v1.1.0: Pago manual por transferencia.
-- La escritura del changelog va por SQL Editor / service role al
-- cerrar cada feature (ver requisito changelog-admin.md). La tabla
-- y su seed v1.0.0 se crearon en la migración 012. Idempotente:
-- UNIQUE(version) + ON CONFLICT DO NOTHING, puede correrse más de
-- una vez.
-- ============================================================

-- SEED v1.1.0 — Pago manual por transferencia (migración 013)
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.1.0',
  'Pago por Transferencia',
  E'• Nuevo modo de pago por transferencia: el administrador puede activarlo por tipo de producto (Membresías, Clases Personalizadas e Inscripciones) desde Configuración, sin usar Flow.\n• Cuando está activo, el usuario elige "Pagar por transferencia" en el checkout, ve los datos bancarios de la academia y envía su comprobante adjunto (imagen o PDF).\n• El administrador recibe un correo y una notificación con cada solicitud, y la revisa en la pestaña "Solicitudes" de la sección Ventas, pudiendo ver el comprobante completo antes de aprobar o rechazar.\n• Aviso permanente de solicitudes pendientes: el menú de administración muestra en "Ventas" un contador de solicitudes sin revisar y aparece un aviso destacado con botón para revisarlas de inmediato.\n• Al aprobar, el beneficio se asigna automáticamente con las mismas reglas que el pago en línea (la membresía corre desde la fecha de aprobación; los packs personalizados se acumulan; la inscripción se extiende).\n• Al rechazar, el usuario ve el motivo indicado por el administrador en su historial de pagos.\n• El perfil ahora incluye el campo RUT, usado como referencia en las transferencias.'
)
ON CONFLICT (version) DO NOTHING;
