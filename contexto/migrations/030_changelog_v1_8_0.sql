-- ============================================================
-- 030_changelog_v1_8_0.sql
-- Entrada de changelog v1.8.0: Adjunto de imagen en eventos.
-- Idempotente: UNIQUE(version) + ON CONFLICT DO NOTHING.
-- ============================================================

-- SEED v1.8.0 — Adjunto de imagen en eventos
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.8.0',
  'Adjunto de imagen en eventos',
  E'• La imagen subida en "Nuevo Evento" ahora se muestra también como documento adjunto descargable en la ficha pública del evento (/eventos/[id]).\n• Al hacer clic en el adjunto se abre una vista previa ampliada (lightbox) con botones "Cerrar" y "Descargar" la imagen.\n• La descarga usa el parámetro ?download= de Supabase Storage para forzar el guardado del archivo.\n• Los eventos sin imagen no muestran la sección de adjunto.'
)
ON CONFLICT (version) DO NOTHING;