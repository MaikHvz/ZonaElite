-- ============================================================
-- 051_changelog_v1_18_0.sql
-- Entrada de changelog v1.18.0: los alumnos publican en su perfil
-- de atleta por su cuenta. Esquema en 050_athlete_posts.sql.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.18.0 — Publica en tu perfil de atleta
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.18.0',
  'Publica en tu perfil de atleta',
  E'• Cada alumno publica por su cuenta en su perfil de atleta, sin depender del administrador: torneos con su resultado, cinturones (también de otras escuelas), trofeos, hitos y publicaciones de texto libre.\n• Lo que registra la academia lleva la insignia "Verificado por ZonaElite"; lo que publica el alumno se muestra como "Publicado por el atleta". Ambos suman en los contadores de torneos, medallas y trofeos.\n• Se pueden fijar hasta 3 publicaciones al inicio del perfil.\n• El alumno edita o elimina sus publicaciones cuando quiera; el administrador puede eliminarlas si no corresponden.'
)
ON CONFLICT (version) DO NOTHING;
