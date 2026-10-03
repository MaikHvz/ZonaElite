# Requisito: Lista de asistencia a eventos (inscripción del usuario)

> **Migración:** `contexto/migrations/033_event_attendees.sql` · **Changelog:** `034_changelog_v1_10_0.sql` (v1.10.0)
> **Estado:** implementado

---

## 1. Explicación profunda del requisito

### 1.1 El problema

El módulo de eventos de ZonaElite tiene tres piezas descritas en `contexto/requisitos/adjunto-imagen-eventos.md`:

1. `/admin/eventos`: CRUD completo (tipo, título, descripción, fecha, lugar, Maps, portada/adjunto).
2. `/eventos`: listado público con tabs por tipo (`torneo`, `graduacion`, `seminario`, `clase_especial`).
3. `/eventos/[id]`: ficha pública con hero, fecha, lugar, descripción, adjunto descargable y mapa.

El botón **"Inscribirse"** de la ficha del evento (`src/app/eventos/[id]/page.tsx:258-263`) es hoy un
`<Link href="/auth">`: no inscribe a nadie, solo manda a iniciar sesión. Es decir, **la academia no sabe
quién va a un torneo, a una ceremonia ni a un seminario**. En la práctica el conteo de participantes se
hace a mano, en un cuaderno o por mensaje privado, lo que produce:

- Sobrecupo sin control: el admin se entera del aforo del local cuando ya llegó gente de más.
- Imposibilidad de avisar cambios de hora o lugar a los asistentes.
- Ninguna trazabilidad de quién asistió (auditoría, reclamos, proporciones entre categorías en un torneo).
- El administrador no puede pasar lista el día del evento ni generar el conteo final.

El requisito es que **el usuario pueda inscribirse a un evento desde la ficha pública, que esa inscripción
quede en una lista de asistencia por evento, y que el administrador pueda ver y administrar esa lista
desde el panel**.

### 1.2 Roles involucrados

| Rol | Interacción |
|-----|-------------|
| **Alumno / Tutor (role_id=4 y cualquier autenticado)** | En `/eventos/[id]` pulsa "Inscribirse", confirma en un modal, ve el modal de "Confirmación exitosa" y el CTA pasa a "Inscrito". No puede inscribir cargas ajenas: la RPC valida `owns_beneficiary`. |
| **Administrador (role_id=1)** | En `/admin/eventos` ve el contador de inscritos por evento y abre "Lista de asistencia" (modal): nombre, categoría y fecha de inscripción de cada participante. Puede quitar a alguien de la lista. |
| **Público (anónimo)** | Sigue viendo la ficha completa. El CTA lo manda a `/auth` (comportamiento actual preservado). |
| **Sistema** | La lista es de solo lectura para staff (`is_staff()`) y de escritura vía RPC `SECURITY DEFINER`. |

### 1.3 Decisiones tomadas

| Decisión | Valor | Motivo |
|----------|-------|--------|
| Ancla de datos | **`beneficiaries`** (titular + cargas), no `profiles` | Todo el dominio de la academia cuelga de `beneficiaries` (`memberships`, `attendance`, `class_enrollments`, `academy_enrollments`, `sport_profiles`). Anclar ahí reutiliza `owns_beneficiary()` y hace que la lista sirva para algo real, como contar categorías en un torneo junior. |
| Quién se inscribe | **El usuario y sus cargas** | Un torneo de menores o una ceremonia de graduación se inscribe el tutor. La UI replica el patrón de checkboxes de `EnrollModal`. |
| Gate de membresía / tokens | **Ninguno** (cualquier autenticado) | A diferencia de una clase de horario (que consume tokens y exige inscripción a la academia), un evento es una actividad de comunidad. Poner un gate duro bloquearía a las familias sin membresía propia y dejaría al admin como único filtro, que es exactamente lo que este módulo agrega. Si más adelante se quiere gatear, es agregar dos `EXISTS` en `enroll_event` (el único punto de escritura). |
| Aforo | **Sin aforo** | `events` no tiene columna de capacidad y el requisito no la pide. No se agrega columna ni UI de cupos. |
| Escritura | **Solo por RPC `SECURITY DEFINER`** | No hay policy INSERT/DELETE en la tabla. El browser client no puede escribir directo: toda alta/baja pasa por la RPC, que valida propiedad del beneficiario, existencia del evento y que la fecha no haya pasado. Es el patrón de `enroll_class` / `cancel_class_enrollment`. |
| Eventos pasados | **No permiten inscripción ni baja** | `event_date >= chile_today()`. El CTA se muestra deshabilitado con el motivo. Evita ensuciar la lista después del evento. |
| UI de confirmación | **Modales explícitos** (pregunta → confirmación exitosa) | Es lo pedido literalmente y evita el doble clic accidental. El estado real se refleja en el CTA ("Inscribirse" ⇄ "Inscrito"). |
| Reversión | `DROP TABLE public.event_attendees;` | El botón vuelve al `<Link href="/auth">` inerte actual si además se revierte el front. |

---

## 2. Flujo de implementación propuesto

### 2.1 Base de datos (`033_event_attendees.sql`)

```sql
public.event_attendees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendees_event_beneficiary_key UNIQUE (event_id, beneficiary_id)
)
```

- `ON DELETE CASCADE` en `event_id`: borrar un evento en `/admin/eventos` limpia su lista (si no, quedaría
  huérfana). `beneficiaries` **sin** cascade (patrón de `class_enrollments`/`academy_enrollments`: la baja
  de un beneficiario la maneja el flujo correspondiente).
- Índices `idx_event_attendees_event_id` y `idx_event_attendees_beneficiary_id` (el count por evento del
  panel admin y la lectura de "mis eventos" del usuario).
- **RLS — solo lectura desde el cliente:**

  ```sql
  CREATE POLICY event_attendees_select_own_or_staff
    ON public.event_attendees FOR SELECT
    USING (public.is_staff() OR public.owns_beneficiary(beneficiary_id));
  ```

  Sin policies INSERT/UPDATE/DELETE → el browser client no puede escribir. El service role (API admin)
  y las RPC `SECURITY DEFINER` sí.

**RPC `enroll_event(p_event_id uuid, p_beneficiary_ids uuid[])`
`RETURNS TABLE (beneficiary_id uuid, success boolean, error_code text, error_message text)`**

Espejo de `enroll_class` (migración 004):

1. Carga `event_date` del evento; `EVENT_NOT_FOUND` / `EVENT_PASSED` (`event_date < chile_today()`).
2. `PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE` (guard de concurrencia).
3. Por beneficiario:
   - ya inscrito → `(true, NULL, 'Ya inscrito')` (idempotencia ante doble clic);
   - no es `is_admin()` ni `owns_beneficiary` → `(false, 'UNAUTHORIZED', …)`;
   - si no → `INSERT` (UNIQUE `(event_id, beneficiary_id)` impide el duplicado) → `(true, NULL, 'Inscrito')`.
4. `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated`.

**RPC `cancel_event_attendance(p_event_id uuid, p_beneficiary_id uuid)`
`RETURNS TABLE (removed boolean, message text)`**

1. Autorización: `is_admin()` (panel) **o** `owns_beneficiary()` (el usuario saca su propia participación).
   En otro caso `UNAUTHORIZED`.
2. Valida que el evento exista y no haya pasado.
3. `DELETE … RETURNING`; idempotente (`false, 'No estabas en la lista de asistencia'`).

Ningún RPC toca tokens, deudas, membresías ni `attendance` de clases: es un módulo **desacoplado**
(igual que `personalized_packs` respecto de `class_enrollments`).

### 2.2 Frontend — usuario

**`src/components/EventEnrollButton.tsx`** (nuevo, `"use client"`). Es el CTA completo del sidebar de
`/eventos/[id]` y dueño de los tres estados:

- **Sin sesión** → `<Link href="/auth">Inscríbete</Link>` (idéntico al comportamiento actual).
- **Con sesión** → carga, con browser client y RLS:
  - `beneficiaries` propia (`profile_id = userId`) y `dependents` (`tutor_id = userId`);
  - `event_attendees` del evento → `Set` de `beneficiary_id` ya inscritos.

  Estados y clicks:

  | Estado | CTA | Hover | Click |
  |--------|-----|-------|-------|
  | Nadie inscrito | `Inscribirse` (`how_to_reg`) | — | abre `EventEnrollModal` |
  | ≥1 inscrito | `Inscrito` (verde, `check_circle`) | tooltip **"Eliminar asistencia"** + `close` rojo | abre `DeleteConfirm` "¿Deseas eliminar tu participación del evento?" |
  | Evento pasado | `Evento finalizado` deshabilitado (`event_busy`) | — | — |

  Tras confirmar el alta aparece el modal de **"¡Confirmación exitosa!"** con el texto
  *"Te agregaste a la lista de asistencia del evento"* y botón "Entendido". Tras confirmar la baja, un
  `Toast` verde *"Tu participación fue eliminada de la lista de asistencia"*.

**`src/components/EventEnrollModal.tsx`** (nuevo). Modal `max-h-[85vh] flex flex-col` con la misma
lenguaje visual de `EnrollModal` (checkbox falso, badge de categoría, header con icono del tipo de
evento, footer con CTA `btn-primary-gradient`). Título: *"¿Deseas inscribirte al evento XXXX?"*.
Lista de beneficiarios (yo + cargas) con los ya inscritos deshabilitados y marcados "Inscrito".
Submit → `supabase.rpc("enroll_event", { p_event_id, p_beneficiary_ids })`, mapeando `error_code` a
mensajes en español; si alguna fila falla se muestra el error en el footer (patrón `EnrollModal`).

**`src/app/eventos/[id]/page.tsx`**: se reemplaza el `<Link href="/auth">` por `<EventEnrollButton …>` y se
pasa `eventId`, `eventTitle`, `eventDate`, `eventType`. El resto de la ficha no cambia.

### 2.3 Frontend — administrador

**`src/components/admin/EventAttendeesModal.tsx`** (nuevo). Envuelto en `FormModal` (ancho `max-w-lg` ya
lo impone). Contenido:

- Cabecera con el contador "N inscritos" y la fecha del evento.
- Lista: avatar `person`, nombre (resuelto `profiles.full_name | dependents.full_name`), badge de
  categoría y fecha de inscripción (`dd/mm/yyyy hh:mm`).
- Acción por fila (solo admin, que es quien lo abre): `person_remove` → confirmación inline →
  `rpc("cancel_event_attendance")` → recarga la lista y `Toast`.
- Estados de carga y de lista vacía (`group_off`, "Nadie se ha inscrito a este evento todavía").
- Exportación opcional: **no** en esta versión (el requisito es "visualizar").

**`src/app/admin/eventos/page.tsx`**:

- `load()` pasa a seleccionar `events` + `event_attendees(beneficiary_id)` anidado y calcula
  `attendeesCount` por evento (una sola query, sin N+1).
- Nueva columna **"Asistencia"** en el `DataTable`: `N inscritos` con ícono `group`, y con
  `count > 0` abre `EventAttendeesModal`. Con `0` muestra "Sin inscritos" apagado (sin acción).
- No se toca el CRUD existente (`FormModal`, `ImageUpload`, `DeleteConfirm`, `Toast`).

### 2.4 Documentación

- Espejo 1:1 en `documentacion/squema-sql-actualizado.sql`: tabla en `TABLES` (después de `events`),
  índices en `INDEXES`, policies en el bloque de RLS, bloque de RPCs de eventos junto a los de
  asistencia, y el seed `v1.10.0` al final de la sección de changelog.
- `scripts/test-flows.mjs`: nueva sección **AE** con asserts de espejo migración↔esquema, de RLS, de las
  RPCs y de la UI (CTA, tooltip, modales, columna admin).
- `contexto/BRAIN.md` (§3 estructura, §4 rutas, §6 tablas, §8 reglas), `documentacion/flujo-modulos.md`
  y `documentacion/requisitos-implementados.md`.

---

## 3. Análisis de impacto (no romper nada)

| Flujo existente | Evaluación |
|-----------------|------------|
| `CheckoutModal` / webhook Flow / `confirmAndCreateMembership` | **Sin impacto.** No se tocan `payments`, `memberships`, `personalized_packs` ni `flow-helpers.ts`. |
| Tokens (`get_remaining_tokens`, `get_enrollment_debt`) y `debts` | **Sin impacto.** `get_remaining_tokens` cuenta `class_enrollments`; la tabla nueva es independiente. Inscribirse a un evento **no** consume ni devuelve tokens. |
| `/admin/asistencia` (normal y personalizada) | **Sin impacto.** No se agregan ni modifican RPCs, tablas ni policies de `class_enrollments`, `personalized_enrollments`, `attendance` ni `debts`. |
| `/api/checkin` | **Sin impacto.** Sigue validando `status='activa'` y `mode != 'personalizado'`. |
| RLS de `events` | **Sin cambios.** Se mantiene `events_select_all … USING (true)` (la ficha es pública) y `events_admin_write`. La lista de asistentes **no** es pública: vive en `event_attendees`, que no tiene policy para `anon`. |
| Zonas horarias | **Sin impacto.** No se calculan fechas de negocio en el cliente: `event_date` se pasa tal cual y la comparación "evento pasado" la hace la RPC con `chile_today()`. El formateo usa `d + "T12:00:00"` + `toLocaleDateString("es-CL")`, igual que el resto del módulo. No se introduce `toISOString().split("T")[0]` (el scan estático de la suite lo detectaría). |
| `DataTable` | **Sin cambios.** La columna "Asistencia" es un `render` con un `<button>`; no se agregan props al componente compartido. |
| Sesión / `SessionProvider` | **Solo lectura**: `useSession()` para `user`. No se toca el provider. |
| `scripts/test-flows.mjs` | Se agregan asserts en la sección **AE**; el assert de sincronía migración↔espejo se mantiene verde. |
| Reversión | `DROP TABLE public.event_attendees CASCADE;` (el `CASCADE` es solo para las policies; la tabla no es referenciada por ninguna otra). |

### Riesgos aceptados

1. **No hay aforo.** Si un evento tiene aforo físico, el admin debe sacar a los sobrantes desde el modal.
   Mitigación futura: columna `capacity` en `events` + guarda `COUNT(*) < capacity` en `enroll_event`.
2. **No hay gate de membresía.** Cualquier autenticado (incluido un tutor nuevo sin membresía) puede
   apuntar a su carga. Mitigación: el admin filtra la lista; y el gate se agrega en un solo lugar
   (`enroll_event`).
3. **No hay notificación al confirmar.** El usuario no recibe aviso por correo ni `user_notifications`
   al inscribirse. Se deja fuera a propósito: la confirmación visual es inmediata y los recordatorios son
   un módulo aparte (`admin/notificaciones`).
4. **Un beneficiario, una fila.** No se guardan acompañantes extra (por ejemplo un invitado que no es
   carga). El requisito habla de "inscribirse", no de gestionar invitados.

---

## 4. Registro de implementación (2026-10-03)

**Archivos creados**

| Archivo | Rol |
|---------|-----|
| `contexto/migrations/033_event_attendees.sql` | Tabla `event_attendees` + índices + RLS (solo lectura) + RPC `enroll_event` y `cancel_event_attendance` |
| `contexto/migrations/034_changelog_v1_10_0.sql` | Seed de changelog v1.10.0 (`ON CONFLICT (version) DO NOTHING`) |
| `src/components/EventEnrollButton.tsx` | CTA de la ficha: estado Inscribirse/Inscrito, aviso hover, confirmaciones y modal de éxito |
| `src/components/EventEnrollModal.tsx` | Modal de inscripción multi (titular + cargas) + `fetchOwnBeneficiaries` / `fetchMyEventAttendees` |
| `src/components/admin/EventAttendeesModal.tsx` | Lista de asistencia del admin con quitar con confirmación |

**Archivos modificados**: `src/app/eventos/[id]/page.tsx` (monta el CTA), `src/app/admin/eventos/page.tsx`
(columna Asistencia + `attendeesCount`), `documentacion/squema-sql-actualizado.sql` (espejo 1:1),
`scripts/test-flows.mjs` (sección **AE**, 18 asserts; y el count de seeds de changelog 13 → 14),
`contexto/BRAIN.md`, `documentacion/flujo-modulos.md` (§15) y `documentacion/requisitos-implementados.md` (§31).

**Desviaciones respecto del plan**: en la columna del admin se usa el ícono `group` (no `visibility`) y el
contador se renderiza como botón solo cuando hay inscritos. La baja del usuario quita **todas** sus filas
(titular + cargas) en una sola confirmación, porque el CTA "Inscrito" es único para la sesión completa.

**Verificación**: `node scripts/test-flows.mjs` → 612 pass / 1 fail (el fail es preexistente y dependiente
de la fecha: `extend: membresía vigente se extiende desde current_end` fija `2026-10-01`, que ya venció).
`npx tsc --noEmit` limpio. En lint, los 4 archivos nuevos emiten `react-hooks/set-state-in-effect`, que es
**el mismo patrón de carga de datos ya usado en el repo** (`/admin/asistencia`, `/admin/usuarios`,
`SportProfileModal` lo tienen igual), más `no-img-element` y el import `StatusBadge` sin uso en
`/admin/eventos` (preexistente, no introducido por este cambio). No hay errores nuevos de otra categoría.

**Pendiente fuera del código**: aplicar `033_event_attendees.sql` y `034_changelog_v1_10_0.sql` en el
Supabase SQL Editor (el botón "Inscribirse" real y el contador del admin no funcionarán hasta entonces).