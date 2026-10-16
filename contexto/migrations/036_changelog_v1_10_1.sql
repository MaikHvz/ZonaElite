-- ============================================================
-- 036_changelog_v1_10_1.sql
-- Entrada de changelog v1.10.1: mejoras de seguridad y
-- correcciones (migración 035).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.10.1 — Mejoras de seguridad y correcciones
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.10.1',
  'Mejoras de seguridad y correcciones',
  E'• Se reforzaron los permisos de la base de datos: los alumnos ya no pueden modificar datos sensibles de su cuenta (rol, estado o correo), ni crear o editar pagos e inscripciones a clases por fuera de los flujos oficiales.\n• Las imágenes y archivos del sitio (productos, eventos, galería, comprobantes) ahora solo pueden ser subidos, reemplazados o eliminados por el administrador.\n• Los pagos en línea verifican que el monto cobrado coincida con el registrado antes de asignar el beneficio.\n• Corregido: las alertas internas al administrador (pago sin membresía asignada, nueva solicitud de transferencia) ahora se guardan correctamente.\n• Corregido: la asignación manual de inscripciones con el método "Cortesía" ya no falla.'
)
ON CONFLICT (version) DO NOTHING;
