ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS location_url text;
