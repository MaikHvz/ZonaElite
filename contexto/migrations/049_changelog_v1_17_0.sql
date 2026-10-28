-- ============================================================
-- 049_changelog_v1_17_0.sql
-- Entrada de changelog v1.17.0: Perfil de Atleta tipo Instagram
-- (fase 1 – MVP). Esquema en 048_athlete_profiles.sql.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.17.0 — Perfil de Atleta
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.17.0',
  'Perfil de Atleta',
  E'• Cada alumno tiene un perfil de atleta al estilo Instagram en /atletas: portada, iniciales con el color de su cinturón, contadores de torneos, medallas, trofeos y años en la academia, y sus disciplinas como destacados.\n• Las publicaciones del perfil son tarjetas de logros que se crean solas: campeonatos, podios, torneos, cinturones y trofeos. No se publican fotos.\n• Pestañas Publicaciones, Palmarés y Torneos, con visor de cada logro.\n• Cada alumno personaliza su perfil: nombre de usuario, apodo, biografía, disciplina principal, portada y privacidad (comunidad o privado).\n• Buscador de atletas por nombre, apodo o usuario, con filtros por categoría y disciplina, y perfiles visitados recientemente.\n• Los perfiles solo se ven con la sesión iniciada. El administrador otorga trofeos, puede ocultar un perfil y abre el perfil de atleta desde la ficha rápida del alumno.'
)
ON CONFLICT (version) DO NOTHING;
