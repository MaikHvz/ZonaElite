# B-016 — Columna `location_url` faltante en `events`

> **Documento de planificación** (SOP `guia-de-trabajo.md`, fases 1-2).

## 1. Problema

Al crear/editar un evento en `/admin/eventos` con la URL de Google Maps o la imagen, el insert/update falla con:

```
Could not find the 'location_url' column of 'events' in the schema cache
```

**Causa raíz:** la UI envía la columna `location_url` (campo "Ubicación Google Maps"), y las vistas públicas (`EventCard`, `/eventos/[id]`) la leen para renderizar el mapa/embed, pero la tabla `events` **no tiene esa columna**. El esquema actual de `events` es:

```sql
type text NOT NULL, title text NOT NULL, description text, image text,
location_name text, location_lat numeric, location_lng numeric,
event_date date NOT NULL, extra jsonb, created_at timestamptz
```

`location_lat`/`location_lng` no las usa ningún código (columnas legacy sin consumidores).

## 2. Solución propuesta

Agregar la columna a la BD con una migración idempotente y documentarla en el esquema espejo:

```sql
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;
```

No hay cambio de código en frontend: la UI, `EventCard` y `/eventos/[id]` ya consumen `location_url`; solo faltaba la columna. Los `SELECT *` actuales devuelven `location_url` como `null` hasta que se cargue un evento con URL.

## 3. Análisis de impacto

- **No toca** `CheckoutModal.tsx` ni los flujos Flow (sin relación con pagos/membresías/tokens).
- **No toca** fechas/zona horaria (columna `text`, sin manipulación de fechas nuevas).
- **No rompe** el esquema: `ADD COLUMN IF NOT EXISTS` es idempotente y no afecta índices/RLS existentes de `events`.
- Las páginas públicas ya manejan `location_url` opcional (`location_url &&`), así que `null`/`undefined` es seguro.

## 4. Cambios

| Archivo | Cambio |
|---|---|
| `contexto/migrations/007_add_events_location_url.sql` | `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;` |
| `documentacion/squema-sql-actualizado.sql` | Agregar `location_url text,` al DDL de `events` (espejo 1:1) |
| `scripts/test-flows.mjs` | Tests B-016 (migración, espejo 1:1, admin page envía `location_url`) |
| `contexto/informe-bugs.md` | B-016 RESUELTO |

## 5. Verificación

- Suite `scripts/test-flows.mjs` en verde (**161 passed, 0 failed**, sección I).
- `npm run build` sin errores.

## 6. Estado (2026-08-02)

- [x] Migración `007_add_events_location_url.sql` creada + espejo 1:1 en `squema-sql-actualizado.sql`.
- [x] Tests B-016 en sección I: **161 passed, 0 failed**. Build verde.
- [x] `informe-bugs.md` (B-016 RESUELTO), `requisitos-implementados.md` y `flujo-modulos.md` actualizados.
- [ ] ⚠️ Aplicar migración `007_add_events_location_url.sql` en Supabase (usuario).
