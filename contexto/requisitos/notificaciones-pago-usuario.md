# Notificaciones al usuario sobre pagos, membresías e inscripciones

## Estado
- **Fecha:** 2026-08-02
- **Tipo:** Feature / Notificaciones

## Requisito
Al adquirir una **membresía** o una **inscripción** para un beneficiario de la cuenta, debe llegar una **notificación al usuario** que indique **qué** membresía/inscripción se asignó y **a quién** (beneficiario). Esto ocurre al **aprobar el pago**.

Si un pago es **rechazado**, **anulado** o queda **pendiente**, también debe llegar una notificación indicando qué pasó (mensaje de feedback).

**Restricción:** NO modificar el flujo de obtención (checkout, webhook, creación de membresías/inscripciones). La notificación es aditiva y best-effort (nunca rompe ni bloquea el pago).

## Contexto técnico
- Tabla `user_notifications` (id, user_id, title, content, read, created_at) ya existe y alimenta:
  - Campana del navbar (`Navbar.tsx:37` — conteo no leídas).
  - Página `/dashboard/notificaciones` (`getPersonalNotifications`, sección "Personales").
- El admin client (`getAdminClient`) bypassa RLS, así que el insert server-side funciona en los 3 routes.
- Puntos donde se determina el resultado del pago:
  - `confirmation/route.ts` (callback Flow, `after()`) — fuente autoritativa.
  - `verify/route.ts` (verificación client-side al volver de Flow).
  - `force-confirm/route.ts` (recuperación manual admin).
  - `create-order/route.ts` marca `rechazado`/`cancelado` al descartar token muerto (B-019) — NO notifica ahí (el feedback rechazado ya lo emite verify/confirmation).

## Flujo de implementación
1. **Helper `notifyUserPaymentStatus(supabase, payment, outcome)` en `src/lib/flow-helpers.ts`**
   - `outcome: "approved" | "rejected" | "cancelled" | "pending"`.
   - Dedup: consulta `user_notifications` del usuario cuyo `content` contenga el `payment.id` (marcador `Ref: <uuid>` al final del content). Si existe, no re-inserta (evita duplicados entre confirmation/verify en carrera).
   - Resuelve el nombre del beneficiario con el mismo patrón que `verify/route.ts` (`beneficiaries` → nested `profiles(full_name)`/`dependents(full_name)`; fallback "Titular").
   - Mensajes (título + content):
     - `approved`: "Pago aprobado" → `Se asignó {concept} a {beneficiaryName}. Ref: <id>`.
     - `rejected`: "Pago rechazado" → `Tu pago de {concept} para {beneficiaryName} fue rechazado. No se realizó ningún cargo. Ref: <id>`.
     - `cancelled`: "Pago anulado" → `Tu pago de {concept} para {beneficiaryName} fue anulado. No se realizó ningún cargo. Ref: <id>`.
     - `pending`: "Pago pendiente" → `Tu pago de {concept} para {beneficiaryName} está pendiente de confirmación. Ref: <id>`.
   - Insert en `user_notifications` con `{ user_id, title, content, read: false }`.
   - Nunca lanza (try/catch), igual que `notifyPaymentWithoutMembership`.
2. **`confirmation/route.ts`**
   - Rama `status !== 2`: tras marcar `rechazado`/`cancelado` → notify `rejected`/`cancelled`; si `mapped === "pendiente"` → notify `pending`.
   - Tras el éxito: si se asignó membresía y/o inscripción (`assignedSomething`) → notify `approved`.
3. **`verify/route.ts`** — mismo patrón (dedup protege del duplicado con confirmation).
4. **`force-confirm/route.ts`** — si se asignó membresía y/o inscripción → notify `approved`.
5. **`create-order/route.ts`** — sin cambios.

## Impacto
- No toca BD (tabla `user_notifications` ya existe), ni fechas, ni RLS, ni `confirmAndCreateMembership`/`extendEnrollment`.
- El flujo de pago permanece idéntico; la notificación es best-effort post-procesamiento.

## Verificación
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` — sección O nueva (scan de helper + 3 routes).
- `npm run build` sin errores.
