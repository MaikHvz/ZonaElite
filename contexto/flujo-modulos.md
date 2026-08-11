# Flujo por módulos — comportamiento vigente

> **Propósito:** Documentar el comportamiento **actual** de cada flujo tras las correcciones de estabilidad 2026-08 (Fases 1–10).
> Complementa `01-project-context-flow.md` y `02-database-interaction.md`. Si un cambio futuro modifica estos flujos, actualizar este documento y `requisitos-implementados.md`.

---

## 1. Check-in por QR (`/api/checkin` + `/checkin/[sessionId]`)

**Entrada:** `beneficiary_ids[]` + `session_id`. **Cliente:** admin (bypass RLS). **Fecha:** `getChileToday()` (una vez por request).

Por cada beneficiario, en orden:

1. **Propiedad** — `profile_id === user.id` o `dependents.tutor_id === user.id`. Si no → `ok:false`, "No tienes acceso a este beneficiario".
2. **Ya inscrito a la sesión** (`class_enrollments` con `session_id + beneficiary_id`) → salta la verificación y marca presente directamente (sin re-verificar membresía/matrícula/tokens).
3. **Membresía activa** (`status='activa'`, más reciente). Sin membresía → `sin_membresia`, bloqueado. Vencida (`end_date < today`) → `atrasado`, bloqueado.
4. **Matrícula activa** (`academy_enrollments` `status='activa'` y `end_date >= today`). Sin matrícula → `sin_matricula`, bloqueado (mensaje "Sin matrícula activa…").
5. **Tokens** — si el plan no es `is_unlimited` y `get_remaining_tokens().remaining <= 0` → **no bloquea**: inscribe igual y **crea deuda** (`debts`, `status='pendiente'`, `amount=1`), con guard anti-duplicado por `(beneficiary_id, session_id, 'pendiente')`.
6. Inscribe (`class_enrollments`, `source='qr'`) + marca presente (`attendance`) + consume 1 token.

**Resultado por beneficiario:** `{ ok, name, message, membership_status: al_dia|atrasado|sin_membresia|sin_matricula, debt: boolean }`.

**UI (`/checkin/[sessionId]`):** chip "En deuda" por beneficiario con deuda; aviso "Quedó 1 clase en deuda" con botón a `/dashboard/membresias`; bloqueo con mensaje específico para `sin_membresia`/`sin_matricula`.

## 2. Inscripción anticipada (`/horarios` + `EnrollModal`)

- Fuente de verdad: **RPC `enroll_class`** (SECURITY DEFINER). Valida en transacción: sesión no pasada (`session_date >= chile_today()`), cupo (`capacity` con `SELECT … FOR UPDATE`), membresía/inscripción, e idempotencia. Códigos: `UNAUTHORIZED`, `NO_MEMBERSHIP`, `NO_ENROLLMENT`, `CLASS_FULL`.
- El check cliente es solo UX; el error real lo muestra la BD.
- `academy_enrollments` y `class_enrollments` INSERT por REST directo **restringidos a admin/staff** (RLS). El usuario solo inscribe vía RPC.

## 3. Membresías y tokens

- **Estado efectivo** por fecha (`effectiveMembershipStatus` + `getChileToday()`), DST-safe; `status` literal no es la fuente de verdad.
- **Renovación:** pagar de nuevo reemplaza la membresía (la anterior se cancela, la nueva arranca desde hoy). Con B-002 solo existe 1 activa (índice único parcial).
- **Tokens:** conteo **dinámico** atado a la membresía específica (`get_remaining_tokens`, ventana `enrolled_at >= created_at` y `< end_date + 1 día`). `is_unlimited` o `remaining > 0` → hay tokens.
- **Deuda:** indicador "N clases en deuda" en `MembershipCard` usa deuda **materializada** (`getPendingDebts`), no el saldo negativo.

## 4. Deudas (`/admin/deudas`)

- Lista deudas agrupadas por beneficiario; filtros **Pendientes / Resueltas / Todas** (default Pendientes).
- Acciones por deuda y por grupo: **Marcar pagada** / **Condonar** → `status` (`pagada`|`condonada`) + `resolved_at` + `resolved_by` (admin).
- Acceso: admin. RLS de `debts`: admin ALL, staff SELECT, usuario SELECT solo propias.

## 5. Pagos Flow (membresía + inscripción)

- Callbacks `confirmation`/`verify`: validan `commerceOrder` antes de aplicar; firma HMAC intacta.
- Post-pago: si un pago exitoso no genera membresía/inscripción → **alerta admin** (`notifyPaymentWithoutMembership`).
- Matrícula/membresía solo por pago Flow o asignación manual del admin (nunca auto-insert del usuario).
- **Estados (B-018):** `verifyFlowPayment` devuelve `1=pendiente`, `2=pagada`, `3=rechazada`, `4=anulada`. `mapFlowStatus` (única fuente en `flow.ts`) traduce a `pendiente | pagado | rechazado | cancelado`:
  - `status 2` → `pagado` + crea/actualiza membresía o inscripción (flujo existente).
  - `status 3` → el pago se actualiza a `rechazado` en BD (tanto en `verify` como en el callback `confirmation`); **no** crea membresía.
  - `status 4` → pago a `cancelado`.
  - `status 1` → pago queda `pendiente`; el callback asíncrono de Flow puede completarlo después.
- **Feedback al usuario** en `/dashboard/pagos` tras el retorno de Flow: overlay verde `PaymentSuccessModal` con botón **OK** (`pagado`), overlay rojo `PaymentErrorModal` con botón **OK** (`rechazado`, `cancelado`, `not_found` o error de verificación) o banner ámbar "Tu pago está pendiente" (`pendiente`). Aplica a membresías, inscripciones y cualquier pago.
- **Ventas admin** (`/admin/ventas`): filtro de estado "Rechazado" + tarjeta de conteo de rechazados.
- **Notificaciones al usuario (`user_notifications`)** — helper `notifyUserPaymentStatus` en `flow-helpers.ts` (best-effort, nunca lanza, dedup por `payment.id` en `content`):
  - **Aprobado** (membresía o inscripción asignada): "Pago aprobado — Se asignó {concept} a {beneficiario}". Se dispara en `confirmation`, `verify` y `force-confirm` SOLO si la membresía/inscripción se asignó (`assignedSomething`).
  - **Rechazado**: "Pago rechazado — Tu pago de {concept} para {beneficiario} fue rechazado. No se realizó ningún cargo."
  - **Anulado**: "Pago anulado — … fue anulado. No se realizó ningún cargo."
  - **Pendiente**: "Pago pendiente — … está pendiente de confirmación."
  - Se muestran en la campana del navbar y en `/dashboard/notificaciones` (filtro "Personales"). `create-order` NO notifica (evita ruido/duplicados).

## 6. Registro de BD (migraciones aplicadas)

| Migración | Contenido |
|-----------|-----------|
| `001` | Columna `tokens` en `membership_plans` |
| `002` | Índice único parcial (1 sola membresía activa) + limpieza de vencidas |
| `003` | `chile_today()` + RLS regenerada |
| `004` | RPC `enroll_class` (capacidad server-side) |
| `005` | `get_remaining_tokens` atado a membresía (ventana) |
| `006` | Tabla `debts` + RLS restringidas (B-013) + drop constraint legacy (B-014) |
| `007` | Columna `events.location_url` (B-016) |
| `008` | Tabla `reglamento_interno` + RLS (admin edita, usuarios leen) |
| `024` | Perfil deportivo: `belt_grades` + `sport_profiles` + `sports_podiums` (trigger + seeds + policies RLS) |
| `025` | Seed changelog v1.5.0 "Perfil Deportivo de Alumnos" |

## 7. Eventos (`/admin/eventos`, `/eventos`)

- Crear/editar un evento inserta `type, title, description, image, location_name, location_url, event_date`.
- `location_url` guarda el link de Google Maps o dirección; `/eventos/[id]` genera el embed vía `extractGoogleMapsEmbed` y `EventCard` muestra nombre/lugar.
- `events` (tras migración 007): `type, title, description, image, location_name, location_url, location_lat, location_lng, event_date, extra, created_at`.

## 8. Reglamento Interno (`/admin/reglamento`, `/dashboard/reglamento`)

- Contenido único en la tabla `reglamento_interno` (1 fila: `content`, `updated_at`, `updated_by`).
- **Admin**: `/admin/reglamento` edita el texto (textarea grande); al guardar crea la fila si no existe o actualiza la existente (con `updated_by` = admin).
- **Usuarios**: tab "Reglamento" en el panel → `/dashboard/reglamento` muestra el texto como párrafos (patrón `content.split("\n")`, igual que el blog). Sin contenido → "El reglamento aún no ha sido publicado".
- **RLS**: SELECT para todos los autenticados; INSERT/UPDATE/DELETE solo `is_admin()`. Los usuarios no pueden modificar el reglamento.

## 9. Navegación del panel admin (móvil + desktop)

- El navbar público (`Navbar.tsx`) **no se renderiza en rutas `/admin`** (B-017): era `fixed z-50` y tapaba el ☰ del header admin en móvil. El panel admin es auto-contenido.
- **Header admin**: ☰ (móvil, abre el drawer), "Panel de Administración", "Ver sitio" (→ `/`), perfil (→ `/perfil`) y botón **Cerrar sesión** (`signOut()` → `/auth`).
- **Drawer CRUD** (`AdminSidebar`): en móvil se desliza con overlay/backdrop y cierra al navegar; en desktop es estático con colapso a iconos. Incluye los 15 módulos (Dashboard, Productos, Eventos, Horarios, Tipos de Clase, Asistencia, Usuarios, Membresías, Inscripciones, Deudas, Ventas, Blog, Notificaciones, Reglamento, Configuración).
- `/dashboard` conserva el navbar público con offset `pt-24 md:pt-28` (sin cambios).

## 10. Perfil deportivo de alumnos (disciplina, grado/cinturón y podios)

**Modelo:** tres tablas ancladas a `beneficiaries.id` (migración `024`):

1. `belt_grades` — catálogo de grados por disciplina: `(discipline_id FK, position, name, color)` con UNIQUE `(discipline_id, position)`. Seed por disciplina activa: Blanco→Negro (8 grados) con `ON CONFLICT (discipline_id, position) DO NOTHING`.
2. `sport_profiles` — perfil 1:1 por beneficiario: `(beneficiary_id UNIQUE, discipline_id, grade_id)`. El trigger `sport_profile_validate_grade()` impide guardar un cinturón cuya disciplina no coincide con la del perfil.
3. `sports_podiums` — historial: `(beneficiary_id, tournament, event_date, discipline_id, category, position, description, image_url)` con `position CHECK IN ('1','2','3','participacion')` e índice por `(beneficiary_id, event_date)`.

**RLS (escritura solo admin):** INSERT/UPDATE/DELETE únicamente `is_admin()`; SELECT `owns_beneficiary(beneficiary_id) OR is_admin()` (y lectura de `belt_grades` para cualquier autenticado). Anclar a `beneficiaries` —y no a columnas de `profiles`/`dependents`— evita que el tutor se autoconceda grados a través de `dependents_update_own_or_admin`.

**Lectura (dashboard):** `getUserMemberships`/`getUserDependents` embeben `sport_profiles` (1:1, con `disciplines` + `belt_grades`) y `sports_podiums` en cada beneficiario. Helpers `sportProfileFrom`/`sportPodiumsFrom` normalizan 1:1 vs array. `getUserSportProfile(userId)` consulta el perfil del titular por `profile_id`; `getDependentSportProfile(dependentId)` por `dependent_id`. Todo el color del cinturón proviene de `belt_grades.color` (BD).

**UI usuario:** `TutorSportCard` en `/dashboard/cargas` (perfil del titular: franja de cinturón + disciplina/grado + contadores de podios). `DependentCard` muestra `BeltBanner` (fondo con el color del grado) + `SportProfileInfo` (disciplina, grado, línea de podios 🥇🥈🥉🎖️). Los podios se ordenan por fecha descendente (`sortPodiumsByDateDesc`).

**Gestión admin (`/admin/usuarios`):** botón `sports_martial_arts` en `DataTable` (`onSport`/`canSport`) → `SportProfileModal`, que resuelve el beneficiario por `profile_id` (titular) o `dependent_id` (carga), guarda disciplina/grado (upsert en `sport_profiles`; si no hay beneficiario → toast de aviso) y administra los podios con `PodiumFormModal` (torneo, fecha, disciplina, resultado `PODIUM_POSITIONS`, categoría con `SUGGESTED_CATEGORIES`, descripción e imagen a `public/podiums`). Las estadísticas (`computePodiumStats`) se calculan en runtime, nunca se persisten.
