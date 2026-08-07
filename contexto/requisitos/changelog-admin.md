# Requisito: Changelog de Desarrolladores en Panel Admin

> Estado: 🔵 PLANIFICADO → implementado el 2026-08-07.
> SOP: Fase 1 (planificación) + Fase 2 (impacto) de `documentacion/guia-de-trabajo.md`.

## 1. Explicación profunda del requisito

**Qué**: Incorporar a la sección Admin un **Changelog de desarrolladores** muy resumido y **versionado** (como versiones de release), para que el administrador conozca de un vistazo los nuevos cambios que han hecho los desarrolladores en la plataforma.

**Por qué**: El administrador necesita enterarse de las mejoras recientes (vista de membresías, botón de desinscripción en asistencia, disciplinas con transición suave, etc.) sin revisar código ni commits.

**Roles**:
- **Administrador (role_id=1)**: único rol que ve la sección. Lee los cambios versionados.
- **Desarrollador**: es quien agrega cada entrada del changelog (por migración/seed SQL) al cerrar cada feature.

**Alcance**: Se agrega una tabla `changelog` (solo lectura admin), una página `/admin/changelog`, un link en el sidebar admin y una entrada seed **v1.0.0** que resume los 3 cambios recientes de este sprint (membresías, desinscripción con devolución de token, disciplinas con transición suave).

**Restricciones**:
- Solo visible en el panel admin (RLS `is_admin()` + ruta bajo `/admin` protegida por `AdminGuard`).
- No es editable desde la UI por ahora: los desarrolladores agregan versiones vía SQL seed/actualización de la tabla. La UI es de solo lectura.
- No tocar `CheckoutModal.tsx`, `EnrollModal.tsx`, `flow.ts`, `dates.ts`, `enroll_class`, `get_remaining_tokens`, `cancel_class_enrollment`.
- Nada de manipulación de fechas nuevas: `created_at` lo asigna la BD (`now()`).

## 2. Flujo de implementación propuesto

### Fase A — Base de datos (migración `012_changelog.sql`)
1. Tabla `changelog`:
   - `id uuid PK DEFAULT gen_random_uuid()`
   - `version text NOT NULL` — ej. `'v1.0.0'`
   - `title text NOT NULL` — título corto de la versión
   - `summary text NOT NULL` — resumen breve (1-2 líneas)
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `UNIQUE (version)` para que el seed sea idempotente (`ON CONFLICT (version) DO NOTHING`).
2. RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy única:
   - `changelog_admin_read` → `FOR SELECT USING (public.is_admin())`.
   - (El seed lo inserta el service role / SQL Editor, bypass de RLS.)
3. Seed idempotente `v1.0.0`:

```sql
INSERT INTO public.changelog (version, title, summary)
VALUES (
  'v1.0.0',
  'Mejoras en Membresías, Asistencia y Disciplinas',
  '• Vista de membresías rediseñada con tarjetas por beneficiario y mejor lectura de estado.
• Botón "Desinscribir" en Asistencia: si un usuario se inscribió por error, se elimina de la sesión y se devuelve el token/clase consumido.
• Disciplinas: la descripción ahora se despliega con transición suave para visualizarla por completo.'
)
ON CONFLICT (version) DO NOTHING;
```

### Fase B — Frontend admin
1. `src/app/admin/changelog/page.tsx` (`"use client"`):
   - Query `changelog` ordenada por `created_at DESC` (vía `createClient()`, el browser client respeta RLS).
   - Estado de carga con spinner (mismo patrón que `admin/reglamento`).
   - Render: header "Changelog de Desarrolladores" + tarjetas por versión: badge `version`, `title`, `summary` (respetando los saltos de línea con `whitespace-pre-line`), fecha `created_at` formateada con `toLocaleString("es-CL")`.
   - Solo lectura (sin botones de edición).
2. `src/components/admin/AdminSidebar.tsx`: agregar link `{ href: "/admin/changelog", label: "Changelog", icon: "update" }` al final de `sidebarLinks`.

### Fase C — Sync esquema/documentación
1. Espejo 1:1 del DDL + policy + seed al final de `documentacion/squema-sql-actualizado.sql`.
2. `contexto/BRAIN.md`: tabla en listado de tablas, policy en conteo, ruta admin, regla de IA (cada feature nueva agrega una entrada de changelog).
3. `documentacion/flujo-modulos.md` sección 10 y `documentacion/requisitos-implementados.md` sección 16.

## 3. Tabla de impacto

| Área | Impacto | Mitigación |
|------|---------|------------|
| `AdminSidebar.tsx` | +1 link (changelog) | Aditivo, no afecta rutas existentes |
| Nuevo `admin/changelog/page.tsx` | Ruta nueva | Protegida por `AdminGuard` del layout |
| Esquema BD | +1 tabla `changelog` + 1 policy | No toca tablas/funciones existentes |
| `get_remaining_tokens` / `enroll_class` / `cancel_class_enrollment` | Ninguno | No se modifican |
| RLS de otras tablas | Ninguno | Policy aislada en tabla nueva |
| Suite de tests | + sección S | Tests de contrato de migración 012 + espejo + frontend |

## 4. Verificación
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` → suite en verde (310 + nuevos).
- `npx tsc --noEmit` limpio.
- `npm run build` OK.
- Manual: `/admin/changelog` muestra la versión v1.0.0 con los 3 cambios; usuario no-admin no ve la ruta (AdminGuard) ni los datos (RLS).

## 5. Restricciones respetadas
- NO se toca `CheckoutModal.tsx`, `EnrollModal.tsx`, `flow.ts`, `flow-helpers.ts`, `dates.ts`, `enroll_class`, `get_remaining_tokens`, `cancel_class_enrollment`.
- La UI es solo lectura; los desarrolladores agregan versiones vía SQL seed.
- Fechas: solo `now()` de la BD y `toLocaleString("es-CL")` en el cliente (sin cálculos nuevos).
