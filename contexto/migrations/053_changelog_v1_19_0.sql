-- ============================================================
-- 053_changelog_v1_19_0.sql
-- Entrada de changelog v1.19.0: avatares y portadas del perfil de
-- atleta; el botón "Perfil" abre el perfil de atleta y desde ahí se
-- editan también los datos de la cuenta. Esquema en 052.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.19.0 — Avatares y portadas del perfil
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.19.0',
  'Avatares y portadas del perfil',
  E'• Nuevos avatares para el perfil: 16 ilustraciones de artes marciales (patada, guante, combate, meditación, fuego, medalla, loto y más). El anillo del avatar sigue mostrando el color del cinturón. También se pueden seguir usando las iniciales.\n• Nuevas portadas ilustradas: dojo al atardecer, montañas, olas, brasas, bambú, tatami, energía, sakura y ring, además de los colores de la academia.\n• El botón "Perfil" de la barra superior abre el perfil de atleta. En "Editar perfil", la pestaña Perfil cambia el avatar, la portada, el usuario, el apodo, la biografía y la privacidad, y la pestaña Cuenta los datos personales, la contraseña y el cierre de sesión.\n• No se suben fotos: avatares y portadas se eligen de un catálogo fijo.'
)
ON CONFLICT (version) DO NOTHING;
