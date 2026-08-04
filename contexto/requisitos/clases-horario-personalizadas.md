# Clases de Horario para Modalidad Personalizada

## Estado
- **Fecha:** 2026-08-04
- **Tipo:** Feature / Módulo desacoplado (extiende el módulo de clases personalizadas)
- **Estado:** 🔵 **PLANIFICADO — documentado, NO implementado.** Este archivo es el requisito + flujo + análisis de impacto (SOP Fase 1 y 2). No hay SQL aplicado ni código.

## Requisito
Las clases personalizadas (el módulo desacoplado creado en la migración 009) necesitan **bloques horarios propios**: clases en horario con día/hora/sala/instructor, exclusivas para la **modalidad personalizada**, que aceptan solo **planes personalizados** y a las que **solo se inscriben alumnos con un pack activo** (consumiendo clases del pack).

- **CRUD en el panel de horarios:** el botón actual "Nueva Clase" pasa a llamarse **"Nueva Clase Normal"** y se agrega un segundo botón **"Nueva Clase Personalizada"**. Ambas viven en la misma página, el mismo `DataTable` y el mismo `FormModal` (con el modo fijado al crear; inmutable al editar).
- **Filtro por modalidad** en el panel de horarios (admin y público): "Membresías" vs "Personalizadas".
- **Distinción explícita:** las clases normales se filtran por `category` (niños/adultos) y por `class_plans` (tipos de membresía); las **personalizadas se filtran por modalidad** y restringen por `personalized_plans`. Son entidades distintas, sin cruce con tokens/membresías.

### Decisión arquitectónica (cerrada con el usuario 2026-08-04)
- **Columna `mode` en `schedules`** (`'normal' | 'personalizado'`, default `'normal'`) → las filas legacy quedan `normal`, cero impacto.
- Se **reusan `class_sessions`** (generación 4 semanas, capacidad, asistencia por `attendance`).
- **Tablas propias nuevas** para el desacople:
  - `personalized_schedule_plans` (enlace schedule ↔ `personalized_plans`; vacío = todos los planes permitidos).
  - `personalized_enrollments` (beneficiario ↔ sesión, con `pack_id` para auditoría).
- **RPC nuevo `enroll_personalized_class`** que consume packs atómicamente (equivalente desacoplado de `enroll_class`).
- **Asistencia:** se reusa el panel admin existente (marcado manual en `attendance`). **Sin QR/check-in** para personalizadas (`/api/checkin` valida membresías).
- `class_enrollments`, `enroll_class`, `/api/checkin`, `EnrollModal`, `CheckoutModal`, `flow.ts`, `dates.ts`: **NO se tocan**.

### Roles que interactúan
| Rol | Interacción |
|-----|-------------|
| Admin (role_id=1) | Crea/edita/elimina clases normal y personalizada en `/admin/horarios`; filtro por modalidad; gestiona asistencia manual de sesiones personalizadas en `/admin/asistencia` (sin QR); inscribe beneficiarios con pack. |
| Instructor/Recepción | Ve las clases personalizadas en la grilla y en asistencia (badge "Personalizada"); marca presencia. |
| Alumno (role_id=4) | Inscribe a sus beneficiarios con pack activo desde la grilla pública (toggle "Personalizadas") o desde el dashboard; el pack descuenta 1 clase por inscripción. |
| Tutor | Igual que el alumno, sobre sus cargas (dependientes con pack comprado por él). |
| Visitante anónimo | Ve la grilla pública con el toggle; al intentar agendar se le pide iniciar sesión (igual que hoy). |

---

## Contexto técnico (puntos de anclaje verificados)
- `schedules`: `discipline_id`, `professor_id`, `room`, `day_of_week`, `start_time`, `end_time`, `capacity`, `category` (`ninos/adultos/ambos`, CHECK), `active`, `description`. RLS `schedules_select_all` + `schedules_admin_write`. FKs SIN cascade (borrar un schedule con sesiones falla hoy; comportamiento pre-existente).
- `class_sessions`: FK → schedules, unique `(schedule_id, session_date)` (el upsert de `generate-sessions` usa `onConflict: "schedule_id,session_date"`).
- `class_plans`: enlace schedule ↔ `membership_plans` (restricción de membresías). Se replica el patrón en `personalized_schedule_plans`.
- `class_enrollments`: `session_id`, `beneficiary_id`, `schedule_id`, `source` (`horarios/admin/qr`). Lo leen `EnrollModal`, `/api/checkin`, `getAttendanceForSession`, `handleCloseSession` del admin/asistencia, y `AttendanceOverview`.
- `enroll_class` (migración 004, SECURITY DEFINER): valida sesión no pasada, lock de sesión, `owns_beneficiary`/admin, membresía activa, inscripción academia, aforo. **Es el patrón del nuevo RPC**, pero contra packs.
- `attendance`: `session_id` + `beneficiary_id` con UNIQUE (upsert `onConflict: "session_id,beneficiary_id"`), FK a `class_sessions`. **Tabla neutral**: sirve para personalizadas sin cambio de esquema.
- `personalized_plans` / `personalized_packs` (migración 009): pack tiene `total_classes`, `used_classes`, `status IN ('activa','agotada','vencida','cancelada')`. El admin consume manualmente con `used_classes + 1` → `'agotada'`.
- `getUpcomingSessions` (dashboard.ts:409): devuelve sesiones próximas con `schedule:schedule(...)`; se agrega `mode` para distinguir modalidad.
- `getAttendanceForSession` (dashboard.ts:434): arma la lista de beneficiarios desde `class_enrollments` y la filtra por membresía activa. Debe ramificar por `mode`.
- `/api/checkin` (route.ts): inserta en `class_enrollments` con `source='qr'` y valida membresía/tokens. **Las sesiones personalizadas no se activan por QR → status queda `cerrada` → la ruta devuelve 403**. Se agrega además una guarda explícita por `mode` (defensa extra).
- Fechas: **siempre** `getChileToday()` / `addDaysChile()` de `src/lib/dates.ts`.
- `owns_beneficiary(id)` y `is_admin()` ya existen en el esquema.

---

## Flujo de implementación

### A. Base de datos (Fase 1) — `contexto/migrations/010_personalized_schedule_classes.sql`

```sql
-- 1. Modalidad en schedules (legacy = 'normal')
ALTER TABLE public.schedules
  ADD COLUMN mode text NOT NULL DEFAULT 'normal';
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_mode_check
  CHECK (mode IN ('normal', 'personalizado'));

-- 2. Enlace schedule <-> planes personalizados (vacío = todos permitidos)
CREATE TABLE IF NOT EXISTS public.personalized_schedule_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id) ON DELETE CASCADE,
  CONSTRAINT personalized_schedule_plans_pkey PRIMARY KEY (id)
);

-- 3. Inscripciones de personalizadas (NO toca class_enrollments)
CREATE TABLE IF NOT EXISTS public.personalized_enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.personalized_packs(id),
  enrolled_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT personalized_enrollments_session_beneficiary_unique UNIQUE (session_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_personalized_schedule_plans_schedule ON public.personalized_schedule_plans(schedule_id);
CREATE INDEX IF NOT EXISTS idx_personalized_schedule_plans_plan ON public.personalized_schedule_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_personalized_enrollments_session ON public.personalized_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_personalized_enrollments_beneficiary ON public.personalized_enrollments(beneficiary_id);

-- RLS
ALTER TABLE public.personalized_schedule_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_schedule_plans_select_all" ON public.personalized_schedule_plans FOR SELECT USING (true);
CREATE POLICY "personalized_schedule_plans_admin_write" ON public.personalized_schedule_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_enrollments_select_own_or_admin" ON public.personalized_enrollments FOR SELECT USING (
  public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_enrollments_admin_write" ON public.personalized_enrollments FOR ALL USING (public.is_admin());
```

- **RPC `enroll_personalized_class`** (SECURITY DEFINER, `STABLE`, `RETURNS TABLE (beneficiary_id uuid, success boolean, error_code text, error_message text)`):
  1. Resuelve `capacity`, `session_date`, `schedule_id` y `mode` de la sesión; si no existe o `mode != 'personalizado'` → excepción.
  2. `session_date < chile_today()` → excepción "La sesión ya pasó".
  3. Lock de la sesión (`FOR UPDATE`) y conteo de `personalized_enrollments` (aforo).
  4. Por cada beneficiario:
     - Ya inscrito → `success=true` (idempotente, 'Ya inscrito').
     - `NOT (admin OR owns_beneficiary)` → `UNAUTHORIZED`.
     - Pack activo: `personalized_packs` con `status='activa'`, `end_date >= chile_today()`, `used_classes < total_classes` (ORDER BY `end_date`) → si no hay, `NO_PACK`.
     - Si el schedule tiene `personalized_schedule_plans` no vacío y el `plan_id` del pack no está → `PLAN_NOT_ALLOWED`.
     - Aforo lleno → `CLASS_FULL`.
     - **Lock `FOR UPDATE` del pack** y re-verificar `used_classes < total_classes` (concurrencia), `used_classes = used_classes + 1`, y `status='agotada'` si `used_classes >= total_classes`.
     - Insert en `personalized_enrollments` (`session_id`, `beneficiary_id`, `pack_id`).
  5. `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`

- **Espejo 1:1** en `documentacion/squema-sql-actualizado.sql` (tablas + FKs + índices + RLS + RPC).

### B. Backend (Fase 2)
- **`/api/checkin/route.ts`**: guarda defensiva — si el `class_sessions.schedules.mode == 'personalizado'` → 403 "Las clases personalizadas no usan check-in por QR". No toca el flujo normal.
- Sin cambios en `flow.ts`, `dates.ts`, `confirmAndCreateMembership`, `CheckoutModal`, `EnrollModal`, `AssignMembershipModal`.

### C. Panel Admin horarios (Fase 3) — `src/app/admin/horarios/page.tsx`
- Botones: **"Nueva Clase Normal"** y **"Nueva Clase Personalizada"** (ambos abren el `FormModal` con `mode` fijado; `mode` se muestra read-only al editar).
- `emptyForm` + `mode: 'normal' | 'personalizado'`.
- Carga extra: `personalized_plans` (id, name, active) y `personalized_schedule_plans(plan_id)` junto a cada schedule.
- En modo personalizado: la sección "Planes permitidos" lista **planes personalizados** y se persiste en `personalized_schedule_plans` (delete+insert como `class_plans` hoy); en modo normal: comportamiento actual.
- `payload` incluye `mode`; al borrar un schedule personalizado se eliminan sus `personalized_schedule_plans` (FK CASCADE) y `class_plans` explícitamente (como hoy).
- `DataTable`: columna **"Modalidad"** (pill Normal/Personalizada) + **filtro por modalidad** (pills "Todas | Membresías | Personalizadas").
- Export Excel: columna Modalidad.

### D. Público `/horarios` + `PersonalizedEnrollModal` (Fase 4)
- Toggle **"Membresías | Personalizadas"** (`modeFilter`, default `'normal'`): la grilla filtra por `mode`; los filtros de disciplina actúan dentro del modo activo.
- Botón "Agendar": si `mode='personalizado'` abre el **nuevo `src/components/PersonalizedEnrollModal.tsx`** (paralelo a `EnrollModal`, que NO se toca):
  - Sesiones futuras + cupos (conteo de `personalized_enrollments` por sesión).
  - Beneficiarios del usuario con **pack activo** (`status='activa'`, `end_date >= getChileToday()`, `used_classes < total_classes`).
  - Elegibilidad: pack activo, plan permitido por la clase (si `personalized_schedule_plans` no vacío), no inscrito en la sesión, aforo.
  - Muestra el pack por beneficiario ("Personalizado por Clase — 2/3 usadas").
  - Llama a `enroll_personalized_class` y mapea códigos de error (`NO_PACK`, `PLAN_NOT_ALLOWED`, `CLASS_FULL`, ...).

### E. Admin asistencia (Fase 5) — `src/app/admin/asistencia/page.tsx` + `dashboard.ts`
- `ClassSessionData` + `getUpcomingSessions`: incluir `mode` del schedule. En la lista, sesiones con `mode='personalizado'` muestran badge **"Personalizada"** y **no** el botón "Abrir sesión QR".
- `getAttendanceForSession(sessionId)`: ramifica por `mode` — si `'personalizado'`, arma la lista desde `personalized_enrollments` (nombres vía `beneficiaries`/dependents/profiles, sin filtro de membresía) con sus registros de `attendance`; si `'normal'`, lógica actual.
- `handleCloseSession`: para sesiones personalizadas, los ausentes se derivan de `personalized_enrollments`.
- Modal "Inscribir" (`searchUsers`/`handleEnroll`): en sesión personalizada busca beneficiarios con pack activo y llama a `enroll_personalized_class`; en normal, comportamiento actual.

### F. Dashboard (Fase 6) — `dashboard/membresias/page.tsx`
- Sección **"Próximas clases personalizadas"** (debajo de "Mis Clases Personalizadas"): lista de sesiones próximas de schedules `mode='personalizado'` con fecha/disciplina/instructor/cupos, estado de inscripción por beneficiario y botón que abre `PersonalizedEnrollModal`.

### G. Tests (Fase 7) — sección **Q** en `scripts/test-flows.mjs`
- Guardas de esquema: `mode` + CHECK en `squema-sql-actualizado.sql`; tablas `personalized_schedule_plans`/`personalized_enrollments` presentes y normalizadas 1:1 entre migración 010 y esquema; RLS (4 policies); RPC `enroll_personalized_class` normalizado 1:1.
- Contrato del RPC (estático sobre el SQL): códigos `NO_PACK`, `PLAN_NOT_ALLOWED`, `CLASS_FULL`, `UNAUTHORIZED`; `FOR UPDATE` del pack; incremento `used_classes`.
- Regresión: `enroll_class` sigue normalizado 1:1 con migración 004; `EnrollModal` no referencia `personalized_enrollments`/`enroll_personalized_class`; `PersonalizedEnrollModal` no usa `class_enrollments` insert ni `get_remaining_tokens`; `/horarios` contiene el toggle de modo.
- Suite completa verde + `npx tsc --noEmit` + `npm run build`.

### H. Documentación (Fase 8)
- `documentacion/flujo-modulos.md`, `documentacion/requisitos-implementados.md`, nuevo `documentacion/plan-clases-horario-personalizadas.md`, `BRAIN.md`, espejo 1:1 del esquema.

---

## Análisis de impacto (SOP Fase 2) — cruce contra el código existente

| Punto existente | ¿Se toca? | Razón |
|-----------------|-----------|-------|
| `enroll_class` / `class_enrollments` / `source` | ❌ No | Las personalizadas viven en `personalized_enrollments`; el RPC nuevo no inserta en `class_enrollments`. |
| `/api/checkin` + `/checkin/[sessionId]` | ✅ Solo guarda aditiva | Se agrega un early-403 por `mode='personalizado'`; el flujo de membresías no cambia. |
| `EnrollModal.tsx` | ❌ No | Se crea `PersonalizedEnrollModal.tsx` paralelo. |
| `CheckoutModal.tsx`, `AssignMembershipModal.tsx`, `flow.ts`, `dates.ts` | ❌ No | Lista de prohibidos respetada. |
| `generate-sessions` | ✅ Reusa (sin cambios) | Ya itera todos los schedules activos → generará sesiones de los personalizados automáticamente. |
| `getUpcomingSessions` / `getAttendanceForSession` (dashboard.ts) | ✅ Aditivo | `mode` en el select; rama personalizada en la lectura de inscritos. |
| `handleCloseSession` / `AttendanceOverview` / export asistencia | ✅ Aditivo | Personalizadas entran en `attendance` (tabla neutral) y se suman a métricas/export; ausentes desde `personalized_enrollments`. |
| Admin horarios (CRUD, class_plans) | ✅ Aditivo | Sección modo personalizado con `personalized_schedule_plans`; flujo normal intacto. |
| RLS de `schedules`/`class_sessions`/`class_enrollments` | ❌ No | Nueva columna `mode` no cambia policies; tablas nuevas con policies propias. |
| `membership_plans` / `personalized_plans` | ❌ No | `personalized_schedule_plans` solo enlaza; ningún plan se modifica. |
| Zonas horarias | ✅ Usar | `getChileToday()`/`addDaysChile()` para vigencias y fechas; nunca `toISOString().split("T")[0]`. |

**Conclusión:** los flujos de membresías, pagos Flow, tokens y check-in **no colapsan**. La feature es aditiva (columna con default, tablas nuevas, RPC nuevo) y deja intactos los contratos probados por la suite (244 tests A–P + sección Q).

## Restricciones
- NO tocar `CheckoutModal.tsx`, `EnrollModal.tsx`, `AssignMembershipModal.tsx`, `flow.ts`, `dates.ts`, `class_enrollments`, `enroll_class`, `idx_memberships_one_active`, `get_remaining_tokens`.
- `mode` se fija al crear la clase; no editable después.
- Sin QR/check-in para clases personalizadas (validan membresías); asistencia manual por el admin en `attendance`.
- Un pack puede inscribir en varias clases; cada inscripción consume 1 clase atómicamente (lock `FOR UPDATE`).
- Fechas SIEMPRE con `getChileToday()`/`addDaysChile()`.

## Verificación (cuando se implemente)
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` (244 A–P + sección Q) en verde.
- `npx tsc --noEmit` limpio; `npm run build` OK.
- Migración 010 aplicada en Supabase y verificada en vivo (columna, tablas, FKs, índices, RLS, RPC).
- End-to-end: crear clase personalizada → generar sesiones → inscribir beneficiario con pack (descuenta 1 clase) → asistencia manual.
