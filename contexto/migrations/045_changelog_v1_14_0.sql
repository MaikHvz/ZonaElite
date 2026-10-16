-- ============================================================
-- 045_changelog_v1_14_0.sql
-- Entrada de changelog v1.14.0: ficha rápida del alumno y
-- renovación de membresías (migración 044).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.14.0 — Ficha rápida del alumno y renovación de membresías
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.14.0',
  'Ficha rápida del alumno y renovación de membresías',
  E'• En el panel de administración, al hacer clic en el nombre de un alumno (Usuarios, Membresías, Inscripciones, Ventas, Deudas, Asistencia y lista de eventos) se abre su ficha: datos de contacto, RUT, categoría, apoderado, membresía activa con días y clases restantes, matrícula y packs vigentes.\n• Botón "Renovar membresía": en Membresías, cada membresía vencida de un alumno sin otra activa se puede renovar con un clic (alumno y plan precargados). También se puede renovar desde la ficha del alumno.\n• Los alumnos con la membresía vencida pueden "Solicitar renovación" desde su panel, con un comentario opcional. El administrador recibe un aviso (correo, notificación y contador en el menú) y la renueva o la rechaza con un motivo.\n• Si el administrador renueva o asigna una membresía a un alumno que tenía una solicitud pendiente, la solicitud se aprueba sola y el alumno recibe la notificación.'
)
ON CONFLICT (version) DO NOTHING;
