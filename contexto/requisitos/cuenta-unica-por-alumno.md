# Plan: Una cuenta única por alumno (eliminar el sistema de cargas) + anti-duplicados

**Fecha:** 2026-10-16 · **Estado:** fase 0 ✅ (cargas de prueba borradas, duplicado de Hilder resuelto) · fase 1 ✅ aplicada (037/038/039, índices únicos creados) · **fases 2–4 implementadas en código** (migraciones 040/041 pendientes de aplicar): BD de migración, panel `/admin/migracion-cargas`, congelamiento de cargas nuevas y datos del apoderado en `/perfil` · fases 5–7 pendientes · **Fases de la guía:** 1 (requisito) + 2 (análisis de impacto)

> **Implementación real de la fase 2 (difiere del borrador de abajo):** en vez de `dependent_migrations` con un snapshot jsonb, la carga migrada se copia completa en la tabla **`dependents_archive`** (las columnas de `dependents` + `beneficiary_id`, `migrated_to_profile_id`, `migrated_by`, `migrated_at`, `moved_summary`, `reverted_*`). RPC: `get_pending_dependents()`, `migrate_dependent_to_profile(dependent, profile)` y `revert_dependent_migration(archive)`, todas con `is_admin()` dentro y llamadas desde el browser del admin. No hace falta la API `migrate-dependent`: la cuenta se crea con `/api/admin/create-user`, reutilizando su chequeo de duplicados. Hallazgo: `beneficiaries.dependent_id` es **ON DELETE CASCADE**, así que la RPC desengancha el beneficiario antes de borrar la carga, y la 040 quita a los tutores el permiso DELETE sobre `dependents`.

> **Decisiones confirmadas por el usuario (2026-10-16):**
> - **D1:** el padre entra con el correo y la contraseña de la cuenta del hijo para pagar o inscribirlo, **o** el administrador le asigna la membresía. No hay "pagar por otro alumno".
> - **D2:** se mantiene el acceso actual (contraseña temporal por correo de `create-user`).
> - **D3:** se mantiene: QR desde la cuenta del niño (en el celular del padre, porque un niño siempre va con su padre) o asistencia manual del profesor.
> - **D4:** **sí**, se guardan los datos del apoderado en el perfil del menor (importante para la academia).
> - **D5:** **sí**, se borran las 3 cargas de prueba de la cuenta "maickol Hernandez" (Kai, john valenzuela, Maickol chiquito; ninguna tiene datos). La cuarta carga de esa cuenta ("alemendra muñoz", con perfil deportivo y podios) **no** entra en el borrado.
> - **D6 (Hilder) y D7:** pendientes. D6 bloquea la creación del índice de RUT único (la migración 037 lo omite con un WARNING hasta resolverlo).
>
> **Numeración:** 037/038 = anti-duplicados (fase 1, **aplicadas 2026-10-16**; índices únicos aún sin crear por el duplicado de Hilder). 039 = corrección de permisos de funciones. La BD de migración de cargas (fase 2) pasa a **040**.
>
> **Lección (aplica a la fase 2):** Supabase otorga EXECUTE a `anon`/`authenticated` directamente; toda RPC nueva debe hacer `REVOKE ... FROM anon, authenticated` explícito además de `FROM PUBLIC`, y validar permisos dentro.
**Pedido del cliente (9 y 13 oct):** "cada alumno tenga su propia cuenta y que no se carguen a mano"; el admin quiere "tener a toda la gente registrada"; las inscripciones a eventos deben hacerse con la cuenta propia de cada alumno para que nadie se inscriba con un nombre ajeno.

---

## 0. Resumen

1. **Los hijos dejan de ser cargas.** Cada alumno (niño, juvenil o adulto) tiene su propia cuenta (`auth.users` + `profiles`) con su propio correo. No se pueden crear cargas nuevas.
2. **Las cargas existentes se migran desde un panel admin**, una por una: (a) crear la cuenta del alumno con los datos de la carga y un correo nuevo, (b) migrar todo su historial a esa cuenta.
3. **La migración no copia datos: re-ancla el beneficiario.** Membresías, matrículas, packs, inscripciones, asistencia, deudas, pagos, eventos, ficha médica, perfil deportivo y podios cuelgan de `beneficiaries.id`, no de `dependents.id`. Basta con que la fila de `beneficiaries` de la carga pase de apuntar al `dependent_id` a apuntar al `profile_id` de la cuenta nueva. **Cero filas movidas, cero riesgo de perder historial**, en una sola transacción.
4. **Anti-duplicados:** RUT único por persona (normalizado) a nivel BD, más validaciones en el registro y en la creación de cuentas desde el admin.
5. **Se hace por fases con convivencia de ambos modelos**: el sistema sigue funcionando mientras se migra, y la eliminación del código de cargas va al final, cuando ya no quedan cargas pendientes.

---

## 1. Situación actual (BD real, 2026-10-16)

| Dato | Valor |
|------|-------|
| Perfiles | 55 (3 admin, 1 instructor, 51 alumnos) |
| Cargas (`dependents`) | **15** (7 niño, 4 juvenil, 4 adulto) de **11 tutores** (máx. 4 por tutor) |
| Cargas con algún historial | **5** |
| Historial colgado de cargas | 4 membresías (1 activa), 4 matrículas, 2 packs personalizados, 11 inscripciones a clases, 11 asistencias, 9 pagos, 4 inscripciones a eventos, 2 fichas médicas, 1 perfil deportivo, 2 podios |
| Membresías de cargas compradas por el tutor | 4 de 4 (`purchased_by` = tutor) |
| Carga sin fila en `beneficiaries` | 1 (dato de prueba) |
| Cargas con el mismo RUT que su tutor | 3, todas de la cuenta "maickol Hernandez" (parecen datos de prueba) |

**Duplicados de cuenta (el problema del "mismo correo"):**
- **No existen dos perfiles con el mismo correo**, ni pueden existir: Supabase Auth exige correo único. El caso real es **la misma persona con dos correos distintos**.
- **Caso Hilder:** dos perfiles con el **mismo RUT y la misma fecha de nacimiento**, con correos que difieren en un punto. El original (creado por el alumno el 06-09) tiene todo el historial: 4 membresías, 15 asistencias y 5 pagos. El segundo lo creó el admin el 02-10 desde `/admin/usuarios`, está vacío y nunca inició sesión. `create-user` no lo detectó porque solo Auth valida el correo exacto, y nadie valida el RUT.
- Otros 2 pares con el mismo nombre ("David", "David duran"), correos distintos, sin RUT y sin datos.
- 27 de 55 perfiles tienen RUT. **El registro público no pide RUT** (solo nombre, correo y contraseña).

---

## 2. Decisiones que hay que tomar antes de implementar

| # | Decisión | Opciones | Recomendación |
|---|----------|----------|---------------|
| D1 | ¿Cómo paga un padre la membresía de su hijo, si ya no es su carga? | (a) entra a la cuenta del hijo y paga desde ahí; (b) el admin asigna o renueva (canal manual actual); (c) "pagar por otro alumno" buscando por RUT | **(a) + (b)**. Hoy todo es manual y el admin ya asigna; (c) se puede agregar después |
| D2 | ¿Cómo recibe el alumno su acceso? | (a) contraseña temporal por correo (como hoy `create-user`); (b) link para crear su contraseña (`generateLink` tipo recovery/invite) | **(b)**: no viaja la contraseña en texto plano. Mandar también copia al correo del apoderado para los menores |
| D3 | Check-in QR de niños chicos sin celular | (a) el niño inicia sesión en el celular del padre; (b) el profesor marca la asistencia manualmente en `/admin/asistencia`; (c) "check-in de acompañante": el padre logueado marca a hijos vinculados | **(b)** para empezar; evaluar (c) si se vuelve un problema real |
| D4 | ¿Se guarda algún vínculo con el apoderado? | (a) ninguno; (b) datos de contacto del apoderado en el perfil del menor (`guardian_name`, `guardian_phone`, `guardian_email`), solo informativos, sin acceso a la cuenta | **(b)**: lo necesita la academia para contactar al responsable de un menor |
| D5 | ¿Qué hacer con las cargas de prueba? (las 3 de "maickol Hernandez" y la carga sin beneficiario) | migrar o borrar | **Borrar** antes de empezar, tras confirmar |
| D6 | Cuenta duplicada de Hilder | fusionar, borrar la vacía o dejar | Los datos dicen que es la misma persona (mismo RUT y fecha de nacimiento, correo casi igual). **Confirmar con el cliente** (dijo "no era él") y, si se confirma, **borrar la cuenta vacía creada por el admin** (no tiene datos, no hace falta fusionar). La restricción de RUT único de la fase 1 obliga a resolverlo antes |
| D7 | ¿El padre sigue viendo el historial del hijo migrado? | no / sí, por `purchased_by` | **No** en la UI; queda en sus pagos (`payments.user_id` = quien pagó) |

---

## 3. Diseño técnico

### 3.1 Por qué re-anclar el beneficiario y no copiar datos

```
ANTES                                        DESPUÉS (misma fila beneficiaries, mismo id)
beneficiaries B  (dependent_id = D)    ──►   beneficiaries B  (profile_id = P_nuevo, dependent_id = NULL)
  ├─ memberships ─────────────┐                ├─ memberships        (sin cambios)
  ├─ academy_enrollments      │                ├─ academy_enrollments
  ├─ personalized_packs       │  14 tablas     ├─ ...
  ├─ class_enrollments        │  con FK a      │
  ├─ attendance / debts       │  beneficiary   │
  ├─ payments.beneficiary_id  │                │
  ├─ event_attendees          │                │
  ├─ medical_records          │                │
  └─ sport_profiles / podiums ┘                └─ sport_profiles / podiums
```

Restricciones reales que hay que respetar (verificadas en BD):
- `beneficiaries.chk_beneficiary_exactly_one`: exactamente uno de `profile_id`/`dependent_id` → el UPDATE pone ambos en un solo paso (`profile_id = P`, `dependent_id = NULL`).
- `UNIQUE (beneficiaries.profile_id)`: el trigger `trg_profiles_create_beneficiary` ya le creó a la cuenta nueva un beneficiario vacío `B_nuevo` → **hay que borrarlo antes** de re-anclar `B`. Solo se permite si `B_nuevo` no tiene ningún dato.
- `trg_dependents_create_beneficiary`: al revertir (reinsertar la carga) crea un beneficiario automático que también hay que borrar antes de re-anclar.

### 3.2 BD (nueva migración `040_single_account_migration.sql`)

1. **Tabla `dependent_migrations`** (auditoría + reversión): `id`, `dependent_id`, `dependent_snapshot jsonb` (fila completa de la carga), `beneficiary_id`, `tutor_id`, `profile_id` (cuenta nueva), `migrated_by`, `migrated_at`, `reverted_at`, `reverted_by`. RLS: solo admin.
2. **Columnas nuevas en `profiles`**: `guardian_name`, `guardian_phone`, `guardian_email` (si se aprueba D4). La categoría **no** se guarda: se deriva de `birth_date` (ya existe `compute_category_from_birth()` en la BD; falta un helper TS compartido).
3. **RPC `migrate_dependent_to_profile(p_dependent_id uuid, p_profile_id uuid)`**: SECURITY DEFINER, solo `is_admin()`, `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated`. En una transacción:
   1. Bloquea con `FOR UPDATE` la carga, su beneficiario y el perfil destino.
   2. Valida: la carga existe y no fue migrada; el perfil destino existe, es `role_id = 4`, no es el tutor y no tiene cargas propias.
   3. Toma el beneficiario vacío del perfil destino (`B_nuevo`) y verifica que **no tenga datos** en ninguna de las 14 tablas que referencian `beneficiaries` (memberships, academy_enrollments, personalized_packs, class_enrollments, personalized_enrollments, attendance, debts, payments, event_attendees, medical_records, sport_profiles, sports_podiums, consent_forms, body_metrics). Si tiene → error `TARGET_HAS_DATA` (la fusión queda fuera de la v1).
   4. `DELETE B_nuevo`, y luego `UPDATE beneficiaries SET profile_id = P, dependent_id = NULL WHERE id = B_dep`. Si la carga no tenía beneficiario, se conserva `B_nuevo`.
   5. Copia al perfil los datos de la carga **solo donde el perfil esté vacío**: `rut`, `birth_date`, `address`, `weight`, `height`, `dominant_hand` (y `full_name` si está vacío). Corre como service role, así que el trigger `trg_profiles_protect_privileged` no interfiere.
   6. Inserta el snapshot en `dependent_migrations`, `DELETE FROM dependents WHERE id = D` y escribe `audit_logs`.
   7. Notifica in-app al tutor ("<hijo> ahora tiene su propia cuenta") y al alumno.
   - **Borrar la fila de `dependents`** en vez de marcarla hace que todas las pantallas que todavía leen cargas dejen de mostrarla automáticamente. No hace falta tocar 30 archivos antes de migrar, y el snapshot permite revertir.
4. **RPC `revert_dependent_migration(p_migration_id uuid)`**: reinserta la carga con su `id` original desde el snapshot, borra el beneficiario que crea el trigger, re-ancla `B` a `dependent_id`, recrea el beneficiario vacío del perfil y marca `reverted_at`. Solo si la cuenta nueva no generó datos propios desde la migración.
5. **Congelar cargas nuevas:** reemplazar la policy `dependents_owner_or_admin` (ALL) por SELECT/UPDATE del tutor + ALL del admin → ningún usuario puede insertar cargas aunque quede código viejo.

### 3.3 API `POST /api/admin/migrate-dependent`

Solo `role_id = 1`, con el patrón de `create-user`:
- **Paso 1 — crear cuenta:** body `{ dependentId, email, full_name, … }` → valida el correo (formato, y que no exista por correo canónico ni por RUT, ver 3.6) → `auth.admin.createUser` → los triggers crean el perfil y el beneficiario vacío → completa el perfil → envía el acceso (D2). Devuelve `profileId`.
- **Paso 2 — migrar:** body `{ dependentId, profileId }` → `rpc("migrate_dependent_to_profile")` → devuelve el resumen de lo migrado.
- Se separa en dos pasos, como pidió el cliente ("primero crear la cuenta y luego migrar"). Si el paso 2 falla justo después de crear la cuenta, el panel ofrece reintentar, porque el paso es idempotente. También se puede borrar la cuenta recién creada, que está vacía.
- **Vincular a una cuenta existente:** si el hijo ya se registró solo, el paso 1 se reemplaza por buscar esa cuenta por RUT o correo. Funciona solo si está vacía (3.2.3).

### 3.4 Panel admin `/admin/migracion-cargas` (nuevo, en `AdminSidebar`)

- **Lista de cargas pendientes:** nombre, tutor, categoría, RUT, y un resumen de su historial (membresía activa, matrícula, packs, n.º de asistencias, pagos). Contador "N de 15 migradas".
- **Asistente por carga:**
  1. *Crear cuenta*: formulario precargado con los datos de la carga, más el correo del alumno (obligatorio) y los datos del apoderado (D4). Botón "Crear cuenta".
  2. *Revisar*: muestra todo lo que se moverá y advierte si la cuenta destino no está vacía.
  3. *Migrar*: confirmación → resultado.
- **Historial de migraciones** con botón "Revertir".
- **Resolución de duplicados** (pestaña aparte): lista de perfiles con el mismo RUT normalizado o el mismo nombre y fecha de nacimiento; permite borrar una cuenta **vacía** (`auth.admin.deleteUser` vía API, con audit). Sirve para el caso Hilder.

### 3.5 Categoría del alumno sin cargas

Hoy la categoría sale de `dependents.category`, y para el titular se asume `adulto` o se usa la del plan (`EnrollModal`, `CheckoutModal`, `AssignMembershipModal`, `EventAttendeesModal`, asistencia admin). Con cuentas únicas se calcula desde `profiles.birth_date`, con un helper compartido `categoryFromBirth()` en `src/lib/` que reemplaza las tres copias de `computeCategoryFromBirth` (admin/usuarios, create-dependent, update-dependent). **`birth_date` pasa a ser obligatorio** para alumnos: en el registro, al crear desde el admin, y con un aviso "completa tu perfil" para los perfiles que no lo tengan.

### 3.6 Anti-duplicados (independiente; se puede entregar primero) — ✅ implementado (migración 037, v1.11.0)

Implementación real: `normalize_rut()` y `canonical_email()` IMMUTABLE; índices `profiles_rut_unique_idx` y `profiles_email_canonical_unique_idx`, que se crean solo si no hay duplicados (si los hay, emiten un WARNING y basta con re-ejecutar 037 tras resolverlos); `handle_new_user()` guarda `rut` y `birth_date`; RPC `check_registration_conflict` (anon, solo devuelve un código) y `find_account_conflicts` (service role, con detalle). En código: registro con RUT y fecha de nacimiento + pre-chequeo; `create-user` responde 409 por RUT o correo y advierte por nombre + fecha de nacimiento (el admin puede forzar la advertencia); `/perfil` valida el RUT y traduce el índice; `CompleteProfileBanner` en el dashboard. Suite sección AG.

| Capa | Cambio |
|------|--------|
| BD | Función `normalize_rut(text)` IMMUTABLE (solo dígitos y K, en mayúscula) + **índice único parcial** `profiles (normalize_rut(rut)) WHERE rut IS NOT NULL AND rut <> ''`. Requiere resolver antes el caso Hilder (D6). Índice único `profiles (lower(email))` como defensa adicional |
| Registro público `/auth` | Pedir **RUT** (validado con `src/lib/rut.ts`) y **fecha de nacimiento**. Pasarlos en `options.data` y que `handle_new_user()` los guarde. Si el RUT ya existe, el índice único hace fallar el alta → mensaje "Ya existe una cuenta con este RUT, recupera tu contraseña" |
| `POST /api/admin/create-user` | Antes de crear: buscar por RUT normalizado y por **correo canónico** (minúsculas; en Gmail sin puntos ni `+etiqueta`, que es justo el caso Hilder). Si hay coincidencia → 409 con la cuenta existente. Advertencia (no bloqueo) si coinciden nombre y fecha de nacimiento |
| `/admin/usuarios` | El modal de crear usuario muestra la coincidencia ("Ya existe: <nombre>, <correo enmascarado> → Ver ficha") en vez de un error genérico |
| Perfiles sin RUT (28) | Aviso en el dashboard para completar el RUT. El índice no los afecta mientras esté vacío |

---

## 4. Inventario de impacto (qué usa cargas hoy)

**34 archivos** de `src/` referencian `dependents`/`dependent_id`/`tutor_id`. Agrupados por módulo, con la fase en la que cambian:

| Módulo | Archivos | Qué cambia | Fase |
|--------|----------|------------|------|
| Dashboard: cargas | `dashboard/cargas/page.tsx`, `DependentCard`, `AddDependentModal`, `EditDependentModal`, `TutorSportCard`, `BeneficiaryCard` | Se elimina la pestaña "Cargas". El perfil deportivo y los podios pasan a "Mi perfil" o al resumen | 5 |
| Ficha médica | `dashboard/cargas/[id]/medico/page.tsx` (`MedicalInfoCard`, `EmergencyContactCard`, `PhysicalInfoCard`) | Pasa a `/dashboard/ficha` del propio alumno (los datos ya están por beneficiario) | 5 |
| Queries de usuario | `lib/supabase/dashboard.ts` (50 refs: `getUserMemberships`, `getUserDependents`, `getDependentSportProfile`, `getDashboardSummary`, asistencia, packs) | Se simplifican a un solo beneficiario (`profile_id = user.id`). Mientras convivan, siguen leyendo cargas no migradas | 5 |
| Resumen / navegación | `dashboard/page.tsx`, `QuickStats`, `MembershipCard`, `DashboardNav`, `dashboard/membresias/page.tsx` | Sin contadores ni etiquetas de cargas | 5 |
| Compra | `CheckoutModal`, `PersonalizedCheckoutModal`, `api/flow/create-order`, `api/payments/transfer` | Sin selector "¿Para quién?": beneficiario = el propio. Las APIs validan solo `profile_id = user.id` | 5 |
| Inscripción a clases | `EnrollModal`, `PersonalizedEnrollModal` | Un beneficiario. Categoría desde `birth_date` | 5 |
| Check-in QR | `checkin/[sessionId]/page.tsx`, `api/checkin` | Solo el propio alumno (ver D3) | 5 |
| Eventos | `EventEnrollModal`, `EventEnrollButton`, `EventAttendeesModal` | Inscripción solo del propio alumno. La categoría en la lista admin se toma del perfil | 5 |
| Admin usuarios | `admin/usuarios/page.tsx` (43 refs), `CreateDependentModal`, `VerFichaModal`, `SportProfileModal`, export Excel | Lista plana de alumnos. Se retira "Crear y asignar carga". "Ver ficha" y perfil deportivo por perfil | 4 (ocultar) / 6 (borrar) |
| Admin asignación | `AssignMembershipModal`, `AssignPersonalizedModal`, `admin/inscripciones/page.tsx` | El buscador encuentra alumnos, no "carga de X". Se aprovecha para el botón **"Renovar membresía vencida"** pedido por el cliente | 5 |
| Admin listados | `admin/membresias`, `admin/asistencia`, `admin/deudas`, `admin/ventas`, `api/admin/close-session` | Los nombres salen de `profiles` (hoy usan el fallback `profiles ?? dependents`, así que **no se rompen durante la migración**) | 6 (limpieza) |
| APIs de cargas | `api/admin/create-dependent`, `api/admin/update-dependent` | Se retiran | 6 |
| Pagos (helpers) | `lib/flow-helpers.ts`, `api/flow/verify` | Nombre del beneficiario sin rama de cargas | 6 |
| Guía | `guide/guide-data.ts` (tour "cargas") | Se elimina o reemplaza | 5 |
| BD | `dependents`, `beneficiaries` (CHECK, triggers), `owns_beneficiary()` (rama de cargas), `cancel_class_enrollment` (`COALESCE(dep.tutor_id, …)`), policy `dependents_owner_or_admin`, `trg_dependents_create_beneficiary` | Se congela en la fase 2 y se retira en la fase 6. `owns_beneficiary` queda solo con `profile_id = auth.uid()` | 2 / 6 |
| Tests | `scripts/test-flows.mjs` (secciones de cargas, RUT, dirección, datos físicos, perfil deportivo, eventos) | Se actualizan las aserciones y se agrega una sección de migración | cada fase |

**Lo que no se toca:** las 14 tablas de historial (siguen apuntando a `beneficiaries`), los RPC `enroll_class`, `enroll_personalized_class`, `enroll_event`, `cancel_*` y `get_remaining_tokens` (operan por `beneficiary_id`), el flujo de transferencia y review, y la tienda.

---

## 5. Fases (orden pensado para no romper nada)

| Fase | Entrega | Criterio de salida |
|------|---------|--------------------|
| **0. Preparación** | Decisiones D1–D7. Respaldo de `dependents`, `beneficiaries` y `profiles` (export desde Supabase). Borrar las cargas de prueba (D5). Resolver Hilder (D6) | Decisiones escritas; quedan solo las cargas reales |
| **1. Anti-duplicados** | 3.6 completo: `normalize_rut`, índices únicos, RUT y nacimiento en el registro, validación en `create-user` | No se puede crear un segundo perfil con el mismo RUT ni con un correo Gmail equivalente |
| **2. BD de migración** | Migración 040: `dependent_migrations`, RPC migrar y revertir, columnas de apoderado, congelar `dependents` INSERT | RPC probado con una carga de prueba: migrar → verificar historial → revertir → migrar |
| **3. Panel admin** | `/admin/migracion-cargas` + API de 2 pasos + pestaña de duplicados | El admin migra las 15 cargas. El tutor deja de verlas y el alumno ve todo su historial |
| **4. Congelar en UI** | Ocultar "Agregar carga" (dashboard) y "Crear y asignar carga" (admin); aviso en "Cargas": "las cargas pasan a cuentas propias" | No se crean cargas nuevas |
| **5. UI de cuenta única** | Módulos de la tabla 4 marcados "5", uno por PR, con su test | Cada flujo (comprar, inscribirse, QR, eventos, ficha, dashboard, asignación admin) funciona con una sola persona por cuenta |
| **6. Retiro** | Con 0 cargas pendientes: quitar la rama de cargas de `owns_beneficiary` y `cancel_class_enrollment`, las policies y el trigger de `dependents`, las APIs `create/update-dependent` y el código muerto. `beneficiaries.profile_id` pasa a `NOT NULL`. Renombrar `dependents` a `dependents_archive` (no borrar) | `grep dependents src/` vacío salvo el archivo; suite en verde |
| **7. Documentación** | BRAIN.md, `flujo-modulos.md`, `requisitos-implementados.md`, espejo SQL, changelog | Docs al día |

Las fases 1 y 2–3 son independientes: la 1 se puede entregar ya. **La fase 5 va después de migrar** porque, mientras queden cargas, los flujos de tutor siguen siendo la única forma de que esos alumnos compren o se inscriban.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Perder historial al migrar | No se mueven datos (re-anclaje). Transacción única. Snapshot en `dependent_migrations` + RPC de reversión |
| Membresía activa de la carga queda "huérfana" de pagador | `purchased_by` se mantiene (sigue siendo quien pagó). La membresía sigue vigente en el beneficiario |
| Cuenta destino con datos (el hijo ya se había registrado y comprado) | La v1 bloquea con `TARGET_HAS_DATA`. Con solo 15 cargas, se resuelve caso a caso; la fusión automática queda fuera |
| Pantallas viejas leen la carga ya migrada | La fila de `dependents` se borra → desaparece de todas las consultas que la leen |
| Niños sin correo propio | El padre crea un correo por hijo (requisito del cliente). El acceso se envía con copia al apoderado (D2/D4) |
| Niño sin celular para el QR | Asistencia manual del profesor (D3) |
| El índice único de RUT falla al crearse por duplicados existentes | Fase 0 resuelve Hilder. El índice es parcial (ignora RUT vacío) |
| Correos de bienvenida masivos | Son 15 migraciones manuales, muy por debajo del límite de Gmail SMTP |
| Trigger `trg_profiles_protect_privileged` bloquea la copia de datos | El RPC y la API corren como service role (`auth.uid()` nulo) y además no tocan `role_id`/`active`/`email` |

---

## 7. Pruebas

- **Suite (`test-flows.mjs`), nueva sección:** RPC migrar (SECURITY DEFINER, solo admin, bloquea si el destino tiene datos, borra `B_nuevo` antes del UPDATE, snapshot, borra `dependents`), RPC revertir, índices de unicidad, `normalize_rut`, correo canónico de Gmail, `categoryFromBirth`, y que ningún flujo de usuario siga leyendo `dependents` al cerrar la fase 5.
- **Ensayo en BD:** en un branch de Supabase o con una carga de prueba creada para eso: migrar → revisar que el alumno ve membresía, asistencia, packs, eventos, ficha y perfil deportivo → revertir → volver a migrar.
- **Manual por rol:** tutor (ya no ve al hijo), alumno migrado (ve todo, compra por transferencia, se inscribe a clase y evento), admin (asigna o renueva al alumno, marca asistencia, ve listas).

---

## 8. Reversión

- Por carga: botón "Revertir" (RPC 3.2.4).
- Global, antes de la fase 6: revertir las migraciones en orden inverso; las fases 4 y 5 se revierten con git.
- Después de la fase 6: `dependents_archive` + `dependent_migrations` conservan todo lo necesario para reconstruir.

## 9. Fuera de alcance (pedidos relacionados, en otros planes)

Botón "Renovar membresía vencida" (cabe en la fase 5 junto a `AssignMembershipModal`), cobro por correo con link, evaluación de examen por alumno, sección "Programa técnico" y mejoras de UX del pago manual y de la asistencia.
