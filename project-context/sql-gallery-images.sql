-- =====================================================================
-- MIGRACIÓN: Tabla de imágenes de galería para carousel
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  alt text DEFAULT '',
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery_public_read' AND tablename = 'gallery_images') THEN
    CREATE POLICY "gallery_public_read" ON public.gallery_images FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery_admin_all' AND tablename = 'gallery_images') THEN
    CREATE POLICY "gallery_admin_all" ON public.gallery_images FOR ALL USING (public.is_admin());
  END IF;
END $$;
