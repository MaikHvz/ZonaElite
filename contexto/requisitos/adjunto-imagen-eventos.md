# Adjunto de imagen en eventos (portada + documento descargable)

## Estado

- **Fecha:** 2026-09-15
- **Tipo:** Feature (UI, sin cambios de esquema)
- **Estado:** ✅ **IMPLEMENTADO.** La imagen subida en `/admin/eventos` sigue siendo la portada del evento y además se muestra como adjunto/documento en la ficha pública `/eventos/[id]`, con vista previa ampliada y botones "Cerrar" y "Descargar".

## Requisito

En la ruta `/admin/eventos`, la imagen que se suba para el evento (sin importar el tipo: torneo, graduación, seminario o clase especial) ya se guarda como portada (`events.image`). Se pide que **la misma imagen** quede además disponible como un documento o archivo adjunto dentro de la publicación del evento, de modo que los alumnos puedan:

1. Hacer clic en la imagen del adjunto.
2. Abrir una **vista previa ampliada única** (lightbox a pantalla completa).
3. **Cerrar** la vista previa con un botón.
4. **Descargar** la imagen con un botón.

### Roles que interactúan

| Rol | Interacción |
|-----|-------------|
| Admin (role_id=1) | Sube la imagen del evento en `/admin/eventos` (portada + adjunto en una sola subida). |
| Alumno (role_id=4) / Tutor / Visitante | En `/eventos/[id]` abre la vista previa de la imagen adjunta y la descarga. |

## Contexto técnico (puntos de anclaje verificados)

- `events` (migración base + 007): columnas `id, type, title, description, image, location_name, location_url, location_lat, location_lng, event_date, extra jsonb, created_at`. **`image` ya es la portada** (se muestra en el hero de `/eventos/[id]` y en el `DataTable` del admin).
- `/admin/eventos` (`src/app/admin/eventos/page.tsx`): CRUD con `ImageUpload` (`folder="events"`) que guarda la URL pública en `events.image`. Dado que portada y adjunto provienen de la **misma imagen**, **no se requiere columna ni tabla nueva**: el adjunto reusa `events.image`.
- Storage: bucket `"public"`, carpetas `events/`. URLs públicas (`getPublicUrl`). Para **forzar la descarga** de una URL de Supabase Storage se usa el parámetro `?download=<nombre>` (respeta `Content-Disposition: attachment`).
- Patrón de modal existente: `FormModal.tsx` (overlay `fixed inset-0`, cierre por ESC y clic en overlay, lock de scroll). Se replica en el nuevo `ImagePreviewModal`.
- Solo se toca UI: **no hay cambios en RLS, RPC, fechas Chile ni flujos de pago/inscripción**.

## Análisis de impacto (Fase 2)

1. **Checkout Flow / `confirmAndCreateMembership` / tokens / inscripciones**: sin impacto (solo presentación de la tabla `events`, de solo lectura pública).
2. **Zonas horarias**: sin manipulación de fechas nuevas (se reusa el `event.event_date` existente).
3. **Base de datos**: **ningún** cambio DDL → el espejo `squema-sql-actualizado.sql` no cambia su estructura. Solo se completan los seeds de changelog `v1.6.0` y `v1.7.0` (que faltaban en el espejo, corrección de sincronización) y se agrega `v1.8.0` → el conteo de seeds del test pasa de 9 a 12.
4. **Componentes compartidos**: `ImagePreviewModal.tsx` es nuevo y autónomo (no altera `FormModal`, `DataTable` ni `ImageUpload`).
5. **Compatibilidad**: si un evento no tiene `image`, la sección de adjunto simplemente no se renderiza (igual que hoy no hay hero).

## Flujo de implementación

1. Crear `src/components/ImagePreviewModal.tsx` (componente cliente): overlay a pantalla completa con la imagen en `object-contain`, botones **"Cerrar"** y **"Descargar"**, cierre por ESC / clic en overlay / botón cerrar, y lock de scroll. Para descargar: si la URL es de Supabase Storage (`/storage/v1/object/public/`) se fuerza el header con `?download=<archivo>`; si no, se abre en pestaña nueva.
2. En `src/app/eventos/[id]/page.tsx`: agregar una sección **"Adjunto / Documento"** (bajo la descripción) que renderiza la imagen como tarjeta de adjunto clickeable. Al hacer clic abre `ImagePreviewModal`.
3. En `src/app/admin/eventos/page.tsx`: ajustar el label de `ImageUpload` para indicar que la imagen será portada y adjunto descargable (sin cambio de lógica).
4. Changelog: migración `030_changelog_v1_8_0.sql` (seed idempotente, `ON CONFLICT (version) DO NOTHING`).
5. Sincronizar `documentacion/squema-sql-actualizado.sql`: completar los seeds faltantes `v1.6.0` y `v1.7.0` (Histórico de asistencias, migración 029) y agregar `v1.8.0` (mantener espejo 1:1 con las migraciones) y actualizar el conteo de seeds en `scripts/test-flows.mjs`.
6. Tests: agregar sección al suite que valide la migración, el espejo y la integración de `ImagePreviewModal` en la ficha del evento.
7. Documentación post-implementación: `flujo-modulos.md`, `requisitos-implementados.md`, `BRAIN.md`.