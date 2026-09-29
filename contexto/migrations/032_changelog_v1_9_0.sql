-- ============================================================
-- 032_changelog_v1_9_0.sql
-- Entrada de changelog v1.9.0: Contraseña de protección para la
-- pantalla de sesión QR de asistencia.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.9.0 — Contraseña de protección para la sesión QR
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.9.0',
  'Contraseña de protección para la sesión QR',
  E'• La pantalla de la sesión QR en /admin/asistencia ahora está protegida por una contraseña: al expandir una sesión activa hay que ingresarla para volver a ver el QR.\n• Al colapsar la sesión, cambiar de pestaña o pulsar "Bloquear", el QR se oculta y queda bloqueado (el desbloqueo no se guarda en el navegador, solo dura mientras la pantalla siga abierta).\n• "Finalizar asistencia" se valida en el servidor a través de /api/admin/close-session: sin la contraseña correcta la sesión no se cierra.\n• La contraseña se configura en Configuración → "Seguridad de la sesión QR" y se guarda con hash scrypt en la tabla qr_session_lock, que solo el administrador puede leer. Cambiarla o quitar la protección exige la contraseña actual.\n• Si no hay contraseña configurada, el panel sigue funcionando sin bloqueo y muestra un aviso para configurarla.'
)
ON CONFLICT (version) DO NOTHING;
