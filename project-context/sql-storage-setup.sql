-- ========================================
-- Setup: Crear bucket "public" en Supabase Storage
-- Ejecutar en el SQL Editor de Supabase
-- ========================================

-- 1. Crear el bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: lectura pública (cualquiera puede ver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public read access'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public read access"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'public');
  END IF;
END $$;

-- 3. Política: usuarios autenticados pueden subir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'public');
  END IF;
END $$;

-- 4. Política: usuarios autenticados pueden actualizar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can update"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'public');
  END IF;
END $$;

-- 5. Política: usuarios autenticados pueden eliminar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'public');
  END IF;
END $$;

-- 6. Política: service_role tiene acceso total (backup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Service role full access"
      ON storage.objects
      FOR ALL
      TO service_role
      USING (bucket_id = 'public');
  END IF;
END $$;
