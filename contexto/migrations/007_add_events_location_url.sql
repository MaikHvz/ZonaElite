-- ============================================================
-- 007_add_events_location_url.sql (B-016)
-- Agrega la columna location_url a events. La UI (admin/eventos,
-- EventCard, /eventos/[id]) la envía/lee para el mapa de Google.
-- Idempotente: puede correrse más de una vez.
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;
