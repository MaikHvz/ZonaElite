-- ============================================================
-- 023_changelog_v1_4_1.sql
-- Entrada de changelog v1.4.1: Vencimiento automático de
-- beneficios + accesibilidad visual (sin blur).
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.4.1 — Vencimiento automático y accesibilidad
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.4.1',
  'Vencimiento automático y accesibilidad visual',
  E'• Las membresías, inscripciones a la academia y packs de clases personalizadas que cumplen su fecha se marcan automáticamente como vencidas (ya no quedan en estado activo).\n• El botón "Reservar Clase" de la página principal lleva directamente a los horarios, no al inicio de sesión.\n• Se eliminó el desenfoque de fondo (backdrop blur) de toda la interfaz: los paneles ahora usan colores planos con mejor contraste para una lectura más cómoda.'
)
ON CONFLICT (version) DO NOTHING;
