-- ============================================================
-- 012_changelog.sql
-- Changelog de desarrolladores visible en el panel admin.
-- Tabla de solo lectura para el administrador (RLS SELECT
-- con is_admin()); los desarrolladores agregan versiones vía
-- seed/actualizaciones SQL. Idempotente: puede correrse más de
-- una vez (UNIQUE version + ON CONFLICT DO NOTHING).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT changelog_version_unique UNIQUE (version)
);

COMMENT ON TABLE public.changelog IS
'Changelog de desarrolladores para el panel admin. Cada fila es una versión de release con título y resumen. Solo lectura para el administrador.';

ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- Solo el administrador puede leer el changelog (la escritura va
-- por service role / SQL Editor al cerrar cada feature).
CREATE POLICY "changelog_admin_read"
  ON public.changelog FOR SELECT USING (public.is_admin());

-- ============================================================
-- SEED v1.0.0 — resumen de los cambios del sprint 2026-08-07
-- ============================================================
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.0.0',
  'Mejoras en Membresías, Asistencia y Disciplinas',
  E'• Vista de membresías rediseñada con tarjetas por beneficiario y mejor lectura de estado.\n• Botón "Desinscribir" en Asistencia: si un usuario se inscribió por error, se elimina de la sesión y se devuelve el token/clase consumido.\n• Disciplinas: la descripción ahora se despliega con transición suave para visualizarla por completo.'
)
ON CONFLICT (version) DO NOTHING;
