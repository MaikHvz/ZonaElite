-- ============================================================
-- 046_changelog_v1_15_0.sql
-- Entrada de changelog v1.15.0: rediseño visual "fuego y oro"
-- del inicio (hero) y la barra de navegación. Sin cambios de esquema.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.15.0 — Rediseño visual: fuego y oro
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.15.0',
  'Rediseño visual: fuego y oro',
  E'• Nueva portada: la foto principal tiene ahora un tratamiento cinematográfico con alto contraste, luz de fuego y chispas, y brasas animadas que suben por la pantalla.\n• El titular combina "DOMINA TU CUERPO." en dorado metálico y "FORTALECE TU MENTE." en rojo incandescente.\n• "Reservar clase" es un botón rojo-naranja con brillo, y "Ver horarios" lleva un borde dorado.\n• La barra de navegación usa una tipografía más fuerte, el logotipo en tonos de fuego, una línea inferior de rojo a dorado y el botón "Perfil" en dorado.\n• Los botones principales del sitio pasan a un degradado de rojo a naranja.'
)
ON CONFLICT (version) DO NOTHING;
