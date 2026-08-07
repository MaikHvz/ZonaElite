# Eliminar Usuario Inscrito en Asistencia (con devolución de token)

## Estado
- **Fecha:** 2026-08-07
- **Tipo:** Feature (panel admin/asistencia)
- **Estado:** 🔵 **PLANIFICADO — documentado, NO implementado.** Este archivo es el requisito + flujo + análisis de impacto (SOP Fase 1 y 2).

## Requisito
El admin cometió errores al inscribir beneficiarios en una sesión desde el panel `/admin/asistencia` (o se inscribieron por QR por error). Hoy no hay forma de deshacerlo: la única vía es SQL manual. Se necesita un **botón de eliminación con confirmación** por beneficiario en la lista de inscritos de cada sesión, que:

1. **Elimine la inscripción** de la sesión (normal: `class_enrollments`; personalizada: `personalized_enrollments`).
2. **Devuelva el token real consumido**:
   - Normal: `get_remaining_tokens` cuenta `class_enrollments` dinámicamente → borrar la fila recarga el token automáticamente. Si la inscripción venía de un check-in por QR sin tokens (deuda materializada en `debts`), se elimina también la deuda pendiente de esa (sesión, beneficiario).
   - Personalizada: se **restaura 1 clase al pack** (`used_classes - 1`, mínimo 0, y `status` vuelve a `'activa'`).
3. **Limpie la asistencia marcada** de esa sesión (`attendance`), si existía.
4. **Notifique al titular** del beneficiario (patrón `user_notifications`, igual que la justificación) informando la desinscripción y la devolución.
5. Solo disponible para **admin** (RLS / chequeo `is_admin()`).

### Roles que interactúan
| Rol | Interacción |
|-----|-------------|
| Admin (role_id=1) | Pulsa el botón de eliminar por beneficiario en la sesión expandida de `/admin/asistencia`, confirma en el modal y ve el resultado. |
| Alumno/Tutor | Recibe notificación in-app "Token devuelto" / "Clase devuelta" cuando el admin lo desinscribe. |
| Instructor/Recepción | Solo lectura del listado; no puede eliminar (no es admin). |

---

## Contexto técnico (puntos de anclaje verificados)
- `class_enrollments`: `session_id`, `beneficiary_id`, `schedule_id`, `enrolled_at`, `source IN ('horarios','admin','qr')`. Ya existe policy **`class_enrollments_delete_admin`** (DELETE con `is_admin()`).
- **Enrollamiento de una sesión normal admite dos formas** (lo leen `getAttendanceForSession` y `handleCloseSession`):
  1. `session_id = X` (inscripción a sesión puntual).
  2. `schedule_id = Y AND session_id IS NULL` (inscripción a todo el horario recurrente; la sesión X hereda al usuario).
  → La eliminación debe cubrir **ambas** para que el usuario desaparezca de esta sesión y se devuelva el token.
- `get_remaining_tokens` (migración 005): `remaining = total - (consumed - justified)`, con `consumed = COUNT(class_enrollments)` en la ventana `[membership.start_date, membership.end_date]` y `enrolled_at >= membership.created_at`. **Borrar la fila devuelve el token sin contador separado.**
- `debts` (migración 006): `beneficiary_id`, `membership_id`, `session_id`, `class_enrollment_id`, `amount`, `status IN ('pendiente','pagada','condonada')`. Policy `debts_admin_all` (FOR ALL admin). El check-in QR (`/api/checkin/route.ts:199-223`) crea una deuda `pendiente` cuando no hay tokens → debe eliminarse al desinscribir.
- `attendance`: **no tiene policy de DELETE** (solo select/insert/update). El borrado de asistencia se hará dentro del RPC (SECURITY DEFINER) o necesita policy nueva.
- `personalized_enrollments` (migración 010): `session_id`, `beneficiary_id`, `pack_id`, UNIQUE `(session_id, beneficiary_id)`. Policy `personalized_enrollments_admin_write` (FOR ALL admin).
- `personalized_packs`: `used_classes`, `total_classes`, `status IN ('activa','agotada','vencida','cancelada')`. Policy `personalized_packs_admin_write` (FOR ALL admin).
- `user_notifications`: `user_id`, `title`, `content`, `read`, `created_at`. RPC existente `notify_token_return` (patrón de notificación, pero su mensaje dice "clase justificada" → se crea notificación propia en el nuevo RPC).
- `beneficiaries.profile_id` (adulto) / `beneficiaries.dependent_id → dependents.tutor_id` (niño) = **titular** a notificar (mismo mapeo de `markAttendance` en `dashboard.ts:605-627`).
- Admin panel directo inserta en `class_enrollments` con `source='admin'` (no materializa deuda); el QR sí lo hace. Ambos escenarios quedan cubiertos.

---

## Flujo de implementación

### A. Base de datos (Fase 1) — `contexto/migrations/011_cancel_class_enrollment.sql`

**RPC `cancel_class_enrollment(p_session_id uuid, p_beneficiary_id uuid)`** (SECURITY DEFINER, `SET search_path = public`):

1. `v_is_admin := public.is_admin()`; si no es admin → excepción `P0001` "Sin permisos de administrador".
2. Resuelve la sesión: `session_date`, `schedule_id`, `schedule.mode`, `disciplines.name`. Si no existe → excepción.
3. Resuelve el **titular** del beneficiario (`profile_id` o `dependents.tutor_id`) y su nombre para la notificación.
4. Rama **personalizada** (`mode = 'personalizado'`):
   - Busca `personalized_enrollments` por `(session_id, beneficiary_id)`; si no existe → retorna `removed=false`, mensaje "No inscrito".
   - `UPDATE personalized_packs SET used_classes = GREATEST(used_classes - 1, 0), status = 'activa' WHERE id = pack_id` (restaura la clase; si el pack quedó en 0 por esta clase, vuelve a 'activa').
   - `DELETE FROM attendance WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id`.
   - `DELETE FROM personalized_enrollments WHERE id = ...`.
   - Notificación: "Se devolvió 1 clase de tu pack por desinscripción del {DD/MM/YYYY} ({disciplina})."
5. Rama **normal**:
   - `DELETE FROM class_enrollments WHERE beneficiary_id = p_beneficiary_id AND (session_id = p_session_id OR (schedule_id = v_schedule_id AND session_id IS NULL))`.
   - `DELETE FROM debts WHERE beneficiary_id = p_beneficiary_id AND session_id = p_session_id AND status = 'pendiente'` (deuda del QR sin tokens).
   - `DELETE FROM attendance WHERE session_id = p_session_id AND beneficiary_id = p_beneficiary_id`.
   - Notificación: "Se devolvió 1 token por desinscripción de la clase del {DD/MM/YYYY} ({disciplina})."
6. Retorna `TABLE (removed boolean, token_returned boolean, attendance_deleted boolean, message text)`.
7. `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`

- **No se necesitan policies DELETE nuevas**: `class_enrollments_delete_admin` existe; `debts`, `personalized_enrollments`, `personalized_packs` ya tienen `FOR ALL admin`. El borrado de `attendance` va dentro del RPC (SECURITY DEFINER), que ignora RLS.
- **Espejo 1:1** en `documentacion/squema-sql-actualizado.sql` (RPC + comentario).

### B. Frontend (Fase 2) — `src/app/admin/asistencia/page.tsx`
- Estado nuevo: `removeTarget: { beneficiary_id, full_name } | null`, `removing: boolean`.
- Botón de eliminar por fila (icono `person_remove`) en la lista de inscritos (junto a los badges de estado), solo visible para admin (el panel ya es admin-only).
- Modal de confirmación: "Desinscribir a {nombre}" con aviso "Se devolverá el token/clase consumido y se eliminará la asistencia marcada." Botón "Eliminar" (rojo) + "Cancelar".
- `handleRemoveBeneficiary`: llama `supabase.rpc("cancel_class_enrollment", { p_session_id, p_beneficiary_id })`; muestra toast con el `message` del RPC; recarga la lista de la sesión (`toggleSession`) para refrescar `enrolledCount` y el listado.
- No toca `EnrollModal`, `handleEnroll`, `handleMark`, `handleSaveAll`.

### C. Tests (Fase 3) — sección **R** en `scripts/test-flows.mjs`
- Guardas de esquema: RPC `cancel_class_enrollment` presente en migración 011 y esquema normalizado 1:1; `REVOKE/GRANT` a `authenticated`; excepción `P0001` "Sin permisos de administrador"; borrados normal (`session_id` OR `schedule_id AND session_id IS NULL`) y personalizado (`personalized_packs` restaura `used_classes`/`status='activa'`); borrado de `debts` pendientes.
- Regresión: `class_enrollments_delete_admin` sigue documentada; suite completa verde.

### D. Documentación (Fase 4)
- `documentacion/squema-sql-actualizado.sql` (espejo), `documentacion/flujo-modulos.md`, `documentacion/requisitos-implementados.md`, `BRAIN.md`.

---

## Análisis de impacto (SOP Fase 2) — cruce contra el código existente

| Punto existente | ¿Se toca? | Razón |
|-----------------|-----------|-------|
| `enroll_class` / `class_enrollments` / `source` | ✅ Solo lectura de referencia | El RPC nuevo borra filas, no cambia el insert ni el consumo. |
| `/api/checkin` (QR) y sus `debts` | ✅ Aditivo | El RPC elimina la deuda `pendiente` de la (sesión, beneficiario) cuando se desinscribe; el flujo de check-in no cambia. |
| `get_remaining_tokens` / dashboard tokens | ✅ Compatible | Al borrar `class_enrollments`, `consumed` baja y `remaining` sube automáticamente. |
| `markAttendance` / `attendance` / `notify_token_return` | ❌ No | El borrado de asistencia y la notificación van dentro del RPC. |
| `getAttendanceForSession` / `handleCloseSession` | ❌ No | Devuelven el listado; la eliminación solo modifica el estado subyacente, y `toggleSession` lo re-lee. |
| `personalized_enrollments` / `personalized_packs` | ✅ Aditivo | Solo en la rama personalizada: borrado + restauración de `used_classes`. |
| RLS existentes | ❌ No | `class_enrollments_delete_admin` ya cubre el DELETE; el resto se hace vía RPC SECURITY DEFINER. No se crean policies nuevas. |
| Zonas horarias | ✅ Usar | La notificación usa la `session_date` (DATE) tal cual; sin `toISOString().split("T")[0]`. |
| `CheckoutModal`, `flow.ts`, `dates.ts`, `AssignMembershipModal` | ❌ No | Lista de prohibidos respetada. |

**Conclusión:** los flujos de membresías, pagos Flow, tokens, check-in y clases personalizadas **no colapsan**. La feature es aditiva (RPC nuevo + botón con confirmación) y deja intactos los contratos probados por la suite.

## Restricciones
- NO tocar `CheckoutModal.tsx`, `EnrollModal.tsx`, `AssignMembershipModal.tsx`, `flow.ts`, `dates.ts`, `enroll_class`, `idx_memberships_one_active`, `get_remaining_tokens`, `notify_token_return`.
- No crear policies DELETE nuevas (no hace falta; `class_enrollments_delete_admin` existe y el resto va por RPC).
- El RPC solo borra la deuda **pendiente** de la sesión; las deudas pagadas/condonadas quedan como auditoría.
- Fechas SIEMPRE con `getChileToday()`/`addDaysChile()`.

## Verificación (cuando se implemente)
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` en verde (sección R nueva).
- `npx tsc --noEmit` limpio; `npm run build` OK.
- Migración 011 aplicada en Supabase y verificada en vivo (RPC + `information_schema`).
- End-to-end: inscribir por error en sesión normal (token baja) → eliminar (token vuelve); QR sin tokens genera deuda → eliminar (deuda pendiente desaparece, token no queda negativo); personalizada → eliminar (pack restaura 1 clase y 'activa').
