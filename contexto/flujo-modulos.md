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

## 7. Eventos (`/admin/eventos`, `/eventos`)

- Crear/editar un evento inserta `type, title, description, image, location_name, location_url, event_date`.
- `location_url` guarda el link de Google Maps o dirección; `/eventos/[id]` genera el embed vía `extractGoogleMapsEmbed` y `EventCard` muestra nombre/lugar.
- `events` (tras migración 007): `type, title, description, image, location_name, location_url, location_lat, location_lng, event_date, extra, created_at`.
