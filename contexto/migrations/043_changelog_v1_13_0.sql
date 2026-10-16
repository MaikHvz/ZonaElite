-- ============================================================
-- 043_changelog_v1_13_0.sql
-- Entrada de changelog v1.13.0: una cuenta por alumno (fin del
-- sistema de cargas, fases 5 y 6).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.13.0 — Una cuenta por alumno
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.13.0',
  'Una cuenta por alumno',
  E'• Cada alumno (también los niños) usa su propia cuenta: la compra de membresías, matrículas y packs, la inscripción a clases y eventos y el check-in por QR se hacen siempre para la persona que inició sesión. El apoderado entra con la cuenta de su hijo cuando corresponde.\n• La pestaña "Mis Cargas" se reemplazó por "Mi ficha": perfil deportivo, ficha médica, datos físicos y contacto de emergencia del propio alumno.\n• El resumen del panel ahora muestra las asistencias del mes.\n• En el panel de administración, la asignación de membresías, packs y matrículas busca directamente la cuenta del alumno (por nombre, correo o RUT), y la sección Usuarios lista cada alumno con su categoría, ficha (incluido el apoderado de los menores) y perfil deportivo.\n• Se retiró el sistema de cargas: ya no se crean ni editan cargas, y las cargas que quedaban se eliminaron (con respaldo). Cada alumno se registra con su propia cuenta.'
)
ON CONFLICT (version) DO NOTHING;
