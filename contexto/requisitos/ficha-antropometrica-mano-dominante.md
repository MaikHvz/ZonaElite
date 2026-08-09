# Requisito: Ficha antropométrica y mano dominante (datos físicos) — v1.3.0

## 1. Explicación del requisito

Registrar **datos físicos** (peso en kg, altura en cm y mano dominante diestro/zurdo) de los alumnos y de las cargas, con validación estricta de formato y rangos. Los datos se muestran y editan en tres lugares:
- **Perfil del tutor** (`/perfil`): campos peso, altura y mano dominante del propio usuario (`profiles`).
- **Cargas** (`dependents`): al crear/editar una carga (dashboard y panel admin) se pueden registrar sus datos físicos; `DependentCard` los muestra si existen.
- **Ficha médica del dashboard** (`/dashboard/cargas/[id]/medico`): card editable "Datos Físicos" que actualiza `dependents` por browser client (RLS `dependents_update_own_or_admin`).

En el panel de administración (`/admin/usuarios`) cada carga tiene un botón **"Ver Ficha"** que abre un modal **solo lectura** con los datos físicos y personales.

### Roles
- **Tutor (Alumno)**: registra sus datos físicos en `/perfil`; registra los de cada carga al crearla/editarla y los actualiza desde la ficha médica.
- **Administrador**: al crear/editar una carga puede registrar sus datos físicos; con "Ver Ficha" revisa la ficha de solo lectura de cada carga.

## 2. Flujo de implementación propuesto

1. **Helper isomórfico** `src/lib/medidas.ts` (estilo `rut.ts`, sin deps):
   - `normalizeMedida(value)`: recorta y normaliza coma→punto.
   - `parseMedida(value)`: `number | null` — solo dígitos + un separador decimal; rechaza letras/símbolos, vacíos y formatos dobles (`12.34.56`).
   - `isValidPeso(value)`: parse + `0 < n <= 300`.
   - `isValidAltura(value)`: parse + `0 < n <= 250`.
   - `isValidDominantHand(value)`: `'diestro' | 'zurdo'`.
2. **Esquema** — migración `019_physical_info_profiles_dependents.sql` (idempotente):
   - `profiles`: `weight numeric`, `height numeric`, `dominant_hand text` (nullable) + CHECK via DO block (`weight > 0 AND weight <= 300`, `height > 0 AND height <= 250`, `dominant_hand IN ('diestro','zurdo')`).
   - `dependents`: mismos campos + CHECK. Sin cambios de RLS.
3. **`src/lib/supabase/dashboard.ts`**: `DependentData` con `weight/height/dominant_hand`; `getProfileForEdit` select+retorno con los 3; `updateProfile` los acepta.
4. **`/perfil/page.tsx`**: campos peso/altura/mano (select diestro/zurdo) con validación `medidas.ts` antes de guardar.
5. **`AddDependentModal`/`EditDependentModal`** (dashboard): campos de medidas con validación; insert/update con valores numéricos (o null).
6. **`PhysicalInfoCard.tsx`** (dashboard): card editable en la ficha médica; el page resuelve el `dependentId` y actualiza `dependents` vía browser client.
7. **`DependentCard.tsx`**: muestra peso/altura/mano si existen.
8. **Admin**:
   - `CreateDependentModal.tsx`: campos de medidas + validación, envía en el body.
   - `POST /api/admin/create-dependent` y `update-dependent`: aceptan `weight/height/dominant_hand`, los persisten, los incluyen en el select de retorno y en `audit_logs.metadata`.
   - `DataTable.tsx`: prop opcional `onView` (y `canView`) para el botón ojo "Ver Ficha".
   - `VerFichaModal.tsx` (solo lectura): muestra datos personales + físicos de la carga.
   - `/admin/usuarios/page.tsx`: carga los campos físicos de dependents, pasa `onView` y abre el modal.

## 3. Análisis de impacto

- **No rompe** Checkout/Flow, tokens, QR/check-in, transferencias, `dates.ts` ni `flow.ts`: solo columnas nullable y UI.
- `beneficiaries`, `medical_records` y `academy_settings` **no se modifican**.
- RLS sin cambios (`own_or_admin` cubre profiles/dependents).
- El patrón de guardado en ficha médica reutiliza el flujo existente de `MedicalInfoCard` (onSave desde el page) para mantener consistencia.
- Tests: se agrega sección **Z** en `test-flows.mjs`; se actualizan regex de secciones existentes que cambian con las columnas nuevas.

## 4. Documentación post-implementación

- `documentacion/flujo-modulos.md`: datos físicos + card en ficha médica + Ver Ficha.
- `documentacion/requisitos-implementados.md`: entrada del requisito (sección 22).
- `contexto/BRAIN.md`: regla de test count.
- `scripts/test-flows.mjs`: sección Z.
- **Changelog**: migración `contexto/migrations/019_changelog_v1_3_0.sql` (entrada `v1.3.0` "Datos Físicos y Ver Ficha", idempotente `ON CONFLICT (version) DO NOTHING`) + espejo en `documentacion/squema-sql-actualizado.sql`.
