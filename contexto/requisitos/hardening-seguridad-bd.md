# Requisito: Endurecimiento de seguridad de la BD (RLS, storage y CHECK)

**Fecha:** 2026-10-16 · **Versión:** v1.10.1 · **Migraciones:** `035_security_hardening.sql`, `036_changelog_v1_10_1.sql`
**Origen:** auditoría de la BD real (`contexto/auditoria-esquema-real.md`), hallazgos S-1…S-6 y bugs F-1/F-2.

## 1. Contexto de negocio

La academia tiene **dos canales para obtener membresías, matrículas y packs personalizados**:

1. **Manual (transferencia validada por el administrador):** el usuario envía su comprobante (`POST /api/payments/transfer`) y el admin aprueba o rechaza en `/admin/ventas?tab=solicitudes` (`POST /api/payments/review`). Además, el admin puede asignar directamente desde `/admin/membresias`, `/admin/inscripciones` y el modal de personalizadas.
2. **Online (Flow.cl):** `POST /api/flow/create-order` → pago en Flow → callback `/api/flow/confirmation` / `GET /api/flow/verify`.

**Estado actual (verificado en BD el 2026-10-16):** `academy_settings.payment_settings` tiene `memberships`, `personalized` y `enrollment` en **`manual`** por temas legales. Flow está apagado para estos productos (`create-order` responde 400). La tienda de productos sigue usando Flow (no depende de este toggle).

## 2. Qué se corrige y por qué

| Id | Problema en la BD real | Corrección |
|----|------------------------|------------|
| S-1 | `profiles_update_own_or_admin` sin `WITH CHECK` + UPDATE de todas las columnas → un usuario puede setear su `role_id = 1` | Trigger `BEFORE UPDATE` `trg_profiles_protect_privileged` que rechaza cambios de `id`, `role_id`, `active`, `email` si quien actualiza es un usuario autenticado no admin. El service role y el SQL Editor (`auth.uid()` nulo) no se ven afectados |
| S-2 | El usuario puede INSERT/UPDATE sus pagos `method='flow'` (concepto, beneficiario, monto, estado) y el callback no valida monto | Eliminar `payments_user_insert_own`, `payments_owner_update_flow`, `payments_flow_update`. `create-order` pasa a escribir pagos con el admin client. Confirmation/verify comparan `verification.amount` con `payments.amount` (`isVerificationAmountMatch`) |
| S-3 | `enrollments_own_insert` (sin validar membresía/matrícula/aforo) y `enrollments_own_delete` (recupera tokens) | Eliminar ambas y también `class_enrollments_insert_admin_or_self`. La inscripción de alumnos va por el RPC `enroll_class` (SECURITY DEFINER), el QR por `/api/checkin` (service role) y el admin por `enrollments_admin_all` |
| S-4 | Cualquier autenticado puede subir/reemplazar/borrar cualquier archivo del bucket `public` | Reemplazar las 5 policies de escritura de `storage.objects` por 3 solo-admin. Los vouchers se suben server-side (service role) |
| S-5 | `user_notifications` INSERT con `WITH CHECK (true)` | Eliminar la policy (el service role y los RPC SECURITY DEFINER no la necesitan) |
| S-6 | `roles` sin RLS y con escritura para `anon` | `ENABLE ROW LEVEL SECURITY` + policy SELECT pública |
| F-1 | CHECK de `notifications` rechaza `type='sistema'` / `target='staff'` → alertas al staff nunca se guardan | Ampliar los CHECK con esos valores |
| F-2 | CHECK de `payments.method` rechaza `cortesia` (ofrecido en `/admin/inscripciones`) | Agregar `cortesia` |
| — | Sin índice en `payments.flow_token` | `idx_payments_flow_token` |

**Fuera de alcance (decisión de negocio, se documenta):** S-7 escritura amplia del staff (instructor/recepción) en `payments`, `attendance`, `class_sessions`, `medical_records`; mover `vouchers/` a bucket privado; que `/api/checkin` revalide membresía cuando el alumno ya estaba inscrito (con S-3 cerrado, solo el RPC validado o el admin pueden crear inscripciones).

## 3. Roles afectados

- **Alumno/Tutor:** pierde capacidades que la UI nunca usó (escribir pagos, inscripciones directas, archivos, notificaciones, su propio rol). `/perfil` sigue editando nombre, teléfono, nacimiento, RUT, dirección y datos físicos.
- **Administrador:** sin cambios funcionales; recupera alertas de sistema (F-1) y la opción "Cortesía" (F-2).
- **Instructor/Recepción:** sin cambios (S-7 fuera de alcance).

## 4. Análisis de impacto

| Flujo | ¿Se rompe? | Verificación |
|-------|-----------|--------------|
| Canal manual: `transfer` / `review` | No | Ambas rutas usan `getAdminClient()` (service role, salta RLS) |
| Asignación admin (`AssignMembershipModal`, `AssignPersonalizedModal`, `/admin/inscripciones`) | No | Insertan `payments` desde el browser como admin → `payments_staff_write` (`is_staff()` incluye admin) sigue vigente |
| Flow `create-order` (cuando se reactive) | No, tras el cambio de código | Las escrituras de `payments` pasan a `getAdminClient()`; las lecturas de planes/beneficiario siguen con el server client |
| Flow `confirmation` / `verify` | No | Ya usan admin client; se agrega validación de monto (un pago con monto distinto queda `pendiente` y alerta al staff) |
| Tienda (`/api/store/checkout`) | No | Usa admin client; `amount = total` y Flow recibe `Math.round(total)` → la comparación redondea ambos lados |
| `/horarios` → `EnrollModal` | No | Usa `rpc("enroll_class")` (SECURITY DEFINER) |
| `/admin/asistencia` inscribir/desinscribir | No | Insert como admin (`enrollments_admin_all`) y `rpc("cancel_class_enrollment")` |
| `/api/checkin` | No | Service role |
| `/perfil` (`updateProfile`) | No | No envía `role_id`, `active`, `email` ni `id`; el trigger compara OLD vs NEW |
| `/admin/usuarios` cambiar rol/activo | No | El trigger permite cuando `is_admin()` |
| `/api/admin/create-user` (setea `role_id`) | No | Service role (`auth.uid()` nulo) |
| Subida de imágenes (`ImageUpload`, `SportProfileModal`) | No | Solo se usan en pantallas admin |
| `notify_token_return`, `cancel_class_enrollment` (insertan `user_notifications`) | No | SECURITY DEFINER |
| `/admin/usuarios` lee `roles` | No | Nueva policy SELECT pública |
| Fechas Chile | No aplica | No se manipulan fechas |

## 5. Reversión

Cada bloque de `035` es independiente: recrear las policies eliminadas (definiciones en `contexto/auditoria-esquema-real.md` §4), `DROP TRIGGER trg_profiles_protect_privileged ON public.profiles`, y revertir los cambios de código en `create-order`, `confirmation`, `verify` y `flow-helpers.ts`.
