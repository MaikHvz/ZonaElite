# Requisito: Crear y asignar carga desde el panel admin

## 1. Explicación del requisito

El administrador debe poder crear una **carga (dependent)** y **asignarla a un usuario (profile)** directamente desde `/admin/usuarios`, sin depender de que el tutor la cree por su cuenta. El caso de uso: el admin crea el perfil del padre (`Crear Usuario`) y luego le asigna una carga (hijo/a) con todos sus datos, para que el padre pueda comprar la membresía de la carga desde su panel.

La carga creada debe comportarse **igual que una creada por el propio usuario** (flujo `AddDependentModal` del dashboard):
- Se inserta en `dependents` con `tutor_id = profile seleccionado`, `full_name`, `rut`, `birth_date`, `category`.
- Debe quedar **usable para comprar membresía / inscribir**: para eso necesita un registro en `beneficiaries` con `dependent_id` apuntando a la carga (Checkout/Enroll/AssignMembership solo muestran cargas con beneficiario).
- RLS: `dependents` permite INSERT/UPDATE/DELETE a admin (`is_admin()`), pero `beneficiaries` **solo tiene policy de SELECT** (no INSERT browser) → el insert de `beneficiaries` debe ir por **API server con admin client** (patrón `create-user/route.ts`).

### Interacción de roles
- **Admin**: crea y asigna la carga, y puede editar sus datos desde la tabla de usuarios.
- **Tutor (profile)**: ve la carga asignada en su panel "Mis Cargas", la selecciona en checkout y compra la membresía/inscripción.
- **Alumno (carga)**: beneficiario con su propio RUT, fecha de nacimiento y categoría.

## 2. Flujo de implementación propuesto

1. **API** `POST /api/admin/create-dependent` (server-only, `getAdminClient()`):
   - Valida sesión + `role_id === 1`.
   - Body: `tutor_id`, `full_name`, `rut`, `birth_date`, `category`.
   - Validaciones: `tutor_id` debe existir en `profiles`; `full_name` y `birth_date` obligatorios; `category` en `["nino","adulto"]`.
   - Inserta en `dependents` (admin client).
   - **Asegura** el registro en `beneficiaries` con `dependent_id` (select por `dependent_id`; si no existe, insert). Idempotente.
   - Registra en `audit_logs` (patrón create-user).
2. **API** `POST /api/admin/update-dependent` (server-only):
   - Valida admin; body `dependent_id`, `full_name`, `rut`, `birth_date`, `category`.
   - `UPDATE dependents` (admin client).
   - `audit_logs`.
3. **Frontend** `/admin/usuarios/page.tsx`:
   - Botón **"Crear y asignar carga"** junto a "Crear Usuario".
   - Modal `CreateDependentModal` con:
     - Selector de tutor (lista de `profiles` no dependientes: nombre + email).
     - Campos: `full_name *`, `rut` (opcional), `birth_date *`, `category *` (Niño/Adulto).
   - Al guardar: `fetch POST /api/admin/create-dependent` → toast éxito → `load()`.
   - **Editar carga**: `openEdit` ya no devuelve temprano para `_isDependent`; el modal se abre en modo edición y hace `POST /api/admin/update-dependent` → `load()`.
4. **Tests** sección **V** en `scripts/test-flows.mjs`:
   - Botón "Crear y asignar carga" presente.
   - Modal con campos (full_name/rut/birth_date/category) + selector de tutor.
   - API create: valida admin, inserta `dependents` + asegura `beneficiaries` (idempotente), audit_logs.
   - API update: valida admin, actualiza `dependents`.
   - `openEdit` ya no retorna para dependientes.

## 3. Análisis de impacto

- **No toca** Checkout/Flow/`confirmAndCreateMembership`/`getRemainingTokens`/asistencia/QR/`dates.ts`.
- `beneficiaries` no tiene trigger documentado que auto-cree registros al insertar en `dependents`; la creación explícita por API es idempotente y cubre el caso (si el trigger existiera en prod, el `select` previo lo detecta y no duplica).
- El modal reutiliza `FormModal` + estilos existentes; no se crean componentes nuevos de infraestructura.
- `DataTable` ya renderiza dependientes en la lista; solo se habilita `onEdit` para ellos.

## 4. Documentación post-implementación

- `documentacion/flujo-modulos.md`: mención de la carga creada por admin.
- `documentacion/requisitos-implementados.md`: entrada del requisito.
- `contexto/BRAIN.md`: regla de test count + nota del flujo admin→carga.
- `scripts/test-flows.mjs`: sección V.
- **Changelog**: migración `contexto/migrations/015_changelog_v1_1_1.sql` (entrada `v1.1.1` "Crear y Asignar Cargas desde el Panel Admin", idempotente `ON CONFLICT (version) DO NOTHING`) + espejo en `documentacion/squema-sql-actualizado.sql`.
