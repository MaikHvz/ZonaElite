# Reglamento Interno (admin editable + visible para usuarios)

> **Documento de planificación** (SOP `guia-de-trabajo.md`, fases 1-2).

## 1. Requisito

La academia necesita un **reglamento interno** visible para todos los usuarios desde su panel y **editable por el admin** desde una sección propia del panel admin.

**Roles:**
- **Admin**: crea/edita el contenido del reglamento desde `/admin/reglamento`.
- **Usuario autenticado (Alumno/Instructor/Recepción)**: lo lee desde `/dashboard/reglamento`.

**Decisiones confirmadas con el cliente (2026-08-02):**
- Ubicación usuarios: **pestaña "Reglamento" en el menú del dashboard** (barra lateral + nav móvil).
- Formato: **texto con párrafos** (cuadro de texto grande en admin; cada párrafo se muestra separado). Mismo patrón que el blog (`content.split("\n")`), sin dependencias nuevas.

## 2. Flujo de implementación

### 2.1 Base de datos (migración `008_reglamento_interno.sql`)
Tabla de contenido único (una sola fila, el reglamento):

```sql
CREATE TABLE IF NOT EXISTS public.reglamento_interno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.reglamento_interno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reglamento_interno_select_all" ON public.reglamento_interno FOR SELECT USING (true);
CREATE POLICY "reglamento_interno_admin_all" ON public.reglamento_interno FOR ALL USING (public.is_admin());
```

- **SELECT** para todos los autenticados (para leerlo en el dashboard).
- **INSERT/UPDATE/DELETE** solo admin.
- Sin seed: el admin crea la fila la primera vez que guarda (o se usa `INSERT ... ON CONFLICT`). La página del usuario muestra un mensaje "aún no publicado" si no existe.

### 2.2 Frontend

| Archivo | Cambio |
|---|---|
| `src/app/admin/reglamento/page.tsx` | **NUEVO** (client): carga la fila (o estado vacío), textarea grande para el contenido, botón Guardar → update si existe o insert si no (`updated_by` = user.id, `updated_at` = now). Toast de éxito/error. |
| `src/components/admin/AdminSidebar.tsx` | Link `/admin/reglamento` (ícono `menu_book`). |
| `src/app/dashboard/reglamento/page.tsx` | **NUEVO** (client): lee la fila vía browser client (RLS SELECT true) y renderiza párrafos; estado vacío → mensaje. |
| `src/components/dashboard/DashboardNav.tsx` | Tab `{ label: "Reglamento", href: "/dashboard/reglamento", icon: "rule" }`. |

### 2.3 Seguridad
- El cliente browser respeta RLS: los usuarios **no pueden** modificar el reglamento (solo admin). No se usa ninguna RPC.

## 3. Análisis de impacto

- **No toca** `CheckoutModal.tsx` / Flow / tokens / membresías / asistencias / deudas.
- **No toca** fechas: `updated_at` la setea la BD (`now()`); no hay lógica de `getChileToday()` necesaria (solo exhibición, sin comparación).
- **No rompe** el esquema existente: tabla nueva, RLS nuevas sin colisión de nombres.
- El patrón de párrafos es idéntico al usado en `/blog/[slug]` (ya probado).

## 4. Tests (sección J en `scripts/test-flows.mjs`)

- Migración 008: tabla `reglamento_interno` (columnas `content`, `updated_at`, `updated_by`), RLS habilitada, policies `reglamento_interno_select_all` (SELECT true) y `reglamento_interno_admin_all` (FOR ALL is_admin()).
- Espejo 1:1 migración↔esquema (tabla + policies).
- `admin/reglamento/page.tsx`: carga fila, textarea, guarda con update/insert.
- `dashboard/reglamento/page.tsx`: renderiza párrafos del contenido.
- `DashboardNav` incluye el tab; `AdminSidebar` incluye el link.

## 5. Verificación

- Suite `scripts/test-flows.mjs` en verde (**168 passed, 0 failed**, sección J).
- `npm run build` sin errores.

## 6. Estado (2026-08-02)

- [x] Migración `008_reglamento_interno.sql` creada + espejo 1:1 en `squema-sql-actualizado.sql`.
- [x] `/admin/reglamento` (edición) + link en `AdminSidebar`.
- [x] `/dashboard/reglamento` (visualización) + tab en `DashboardNav`.
- [x] Tests sección J: **168 passed, 0 failed**. Build verde.
- [x] Docs actualizados (`requisitos-implementados.md`, `flujo-modulos.md`).
- [ ] ⚠️ Aplicar migración `008_reglamento_interno.sql` en Supabase (usuario).
