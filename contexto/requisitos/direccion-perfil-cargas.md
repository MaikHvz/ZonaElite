# Requisito: Dirección en perfil del tutor y en cargas (v1.2.1)

## 1. Explicación del requisito

El perfil del tutor debe poder registrar su **dirección** (`profiles.address`). Las **cargas** (niño/adulto en `dependents`) también deben tener dirección, con un checkbox "Usar la misma dirección que el tutor" que autocompleta el campo desde el perfil del tutor al crear o editar una carga, tanto desde el dashboard del usuario (`/dashboard/cargas`) como desde el panel de administración (`/admin/usuarios`). La tarjeta de cada carga (`DependentCard`) debe mostrar la dirección si existe.

### Roles
- **Tutor (Alumno)**: registra su dirección en `/perfil`; al agregar/editar una carga puede escribir la dirección de la carga o marcar el checkbox para copiar la suya.
- **Administrador**: al crear o editar una carga desde `/admin/usuarios` puede indicar la dirección o usar el checkbox (autocompleta desde la dirección del tutor seleccionado).

## 2. Flujo de implementación propuesto

1. **Esquema** — migración `018_address_dependents_profiles.sql` (idempotente, `ADD COLUMN IF NOT EXISTS`):
   - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;`
   - `ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS address text;`
   - Sin cambios de RLS: los policies `own_or_admin` existentes cubren la columna nueva (mismo nombre de tabla/columna ya protegidas).
2. **`src/lib/supabase/dashboard.ts`**:
   - `DependentData.address: string | null`.
   - `getProfileForEdit`: select `full_name, phone, birth_date, rut, address` y retorno con `address`.
   - `updateProfile`: acepta `address?: string` en `updates`.
   - `getUserMemberships`: select de dependents incluye `address`.
   - `getUserDependents` usa `*` → ya incluye `address`.
3. **`/perfil/page.tsx`**: campo "Dirección" (state `address`, carga en el effect de `getProfileForEdit`, se envía en `handleSave`).
4. **`AddDependentModal.tsx`** (dashboard): estado `address` + checkbox "Usar la misma dirección que el tutor" que autocompleta desde `profiles.address` (query browser client a `profiles` por `tutorId`, RLS permite lectura del propio perfil). Insert con `address: address.trim() || null`.
5. **`EditDependentModal.tsx`** (dashboard): prop `dependent` con `address` y `tutor_id`; carga `dependent.address`; mismo checkbox (autocompleta desde la dirección del tutor); update incluye `address`.
6. **`DependentCard.tsx`**: fila "Dirección" cuando `dependent.address` existe.
7. **Admin**:
   - `CreateDependentModal.tsx`: `editingDependent` con `address`; campo dirección + checkbox que autocompleta desde la dirección del tutor seleccionado (via prop `tutors`, que ahora incluye `address`).
   - `POST /api/admin/create-dependent` y `POST /api/admin/update-dependent`: aceptan `address`, la persisten (`address?.trim() || null`), la incluyen en el `.select(...)` de retorno y en `audit_logs.metadata`.
   - `/admin/usuarios/page.tsx`: select de `dependents` con `address`, `_address` en `UserRow`, `openEdit` pasa `address`, lista de tutores incluye `address`.

## 3. Análisis de impacto

- **No rompe** Checkout/Flow, tokens, QR/check-in, transferencias, `dates.ts` ni `flow.ts`: solo se agrega una columna nullable y campos de UI.
- `beneficiaries` y `medical_records` **no se modifican**.
- RLS sin cambios (`own_or_admin` ya cubre profiles/dependents select/update).
- Tests: se agrega sección **Y** en `test-flows.mjs`; se ajustan los regex existentes que dependen del select/insert de `dependents` (secciones U/V) y el conteo de seeds del espejo (sección T).

## 4. Documentación post-implementación

- `documentacion/flujo-modulos.md`: sección Cargas con dirección + checkbox.
- `documentacion/requisitos-implementados.md`: entrada del requisito (sección 21).
- `contexto/BRAIN.md`: regla de test count (484).
- `scripts/test-flows.mjs`: sección Y.
- **Changelog**: migración `contexto/migrations/018_changelog_v1_2_1.sql` (entrada `v1.2.1` "Dirección en Perfil y Cargas", idempotente `ON CONFLICT (version) DO NOTHING`) + espejo en `documentacion/squema-sql-actualizado.sql`.
