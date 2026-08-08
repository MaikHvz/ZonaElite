# Requisito: Editar cargas desde el panel del usuario con validación de RUT

## 1. Explicación del requisito

El usuario (tutor) debe poder **editar los datos de sus cargas** desde `/dashboard/cargas` (panel "Mis Cargas"), por ejemplo corregir el RUT, nombre, fecha de nacimiento o categoría de un dependiente que ya tiene registrado. Hoy las cargas solo se pueden **agregar** (`AddDependentModal`) pero no editar.

Además, el campo **RUT debe validarse con el formato chileno real** (cuerpo + dígito verificador con módulo 11, aceptando `12.345.678-9`, `12345678-9`, `12345678-9k` etc.) para evitar datos inválidos. La validación aplica al editar y, por consistencia, también al agregar.

### Roles
- **Tutor (Alumno)**: edita los datos de sus propias cargas desde el dashboard. El RLS `dependents_update_own_or_admin` (`tutor_id = auth.uid()` o admin) ya permite el update por browser client, así que **no se necesita API server ni migración**.

## 2. Flujo de implementación propuesto

1. **Helper RUT** `src/lib/rut.ts` (isomórfico, sin deps):
   - `normalizeRut(value)` → solo dígitos + DV (mayúscula), sin puntos/guiones.
   - `isValidRut(value)` → valida longitud mínima (cuerpo 1–8 dígitos), DV en `[0-9K]`, y dígito verificador con el algoritmo módulo 11 (rut > 1M para evitar falsos positivos triviales como `0`).
   - `formatRut(value)` → formatea `12.345.678-9` (nice-to-have, opcional).
2. **`EditDependentModal.tsx`** (dashboard): reutiliza la estructura/estilos de `AddDependentModal`, con:
   - Props: `open`, `onClose`, `onUpdated`, `dependent` (con id, full_name, rut, birth_date, category).
   - Carga los valores actuales; campos `full_name *`, `rut` (validado si no está vacío), `birth_date *`, `category`.
   - Al guardar: `supabase.from("dependents").update({...}).eq("id", dependent.id)` vía browser client (RLS permite).
   - Si el RUT no es vacío y no pasa `isValidRut` → error inline "RUT inválido".
3. **`DependentCard.tsx`**: botón "Editar" (icono `edit`) que abre el modal de edición.
4. **`cargas/page.tsx`**: state `editingDependent`, renderiza `EditDependentModal`; al actualizar recarga (`fetchDependents`).
5. **`AddDependentModal.tsx`**: aplicar la misma validación de RUT (consistencia).
6. **Admin `CreateDependentModal.tsx`**: aplicar la misma validación de RUT en el front (back de la API ya acepta, pero validar en cliente evita envíos inválidos). También `perfil` opcional — se deja fuera salvo que se pida.

## 3. Análisis de impacto

- **No rompe** Checkout/Flow/`flow-helpers`/`getRemainingTokens`/asistencia/QR/`dates.ts`: solo se agregan componentes de UI y un helper nuevo.
- `dependents` RLS UPDATE own_or_admin ya existe → sin cambios de esquema, sin migración, sin API.
- El `rut` en `dependents` ya se muestra en la tarjeta (`DependentCard`) cuando existe.
- Tests: se agrega sección **W** en `test-flows.mjs` (helper RUT: casos válidos/inválidos/DV K; modal de edición; botón en tarjeta; validación en AddDependentModal y CreateDependentModal).

## 4. Documentación post-implementación

- `documentacion/flujo-modulos.md`: mención de edición de cargas + validación RUT.
- `documentacion/requisitos-implementados.md`: entrada del requisito (sección 19).
- `contexto/BRAIN.md`: regla de test count + nota del helper RUT.
- `scripts/test-flows.mjs`: sección W.
- **Changelog**: migración `contexto/migrations/016_changelog_v1_1_2.sql` (entrada `v1.1.2` "Editar Cargas y Validación de RUT", idempotente `ON CONFLICT (version) DO NOTHING`) + espejo en `documentacion/squema-sql-actualizado.sql`.
