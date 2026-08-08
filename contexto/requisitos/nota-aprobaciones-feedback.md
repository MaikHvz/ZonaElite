# Requisito: Nota de revisión visible en aprobaciones + más feedback para usuario y admin

## 1. Explicación del requisito

Hoy la nota del administrador (`admin_note`) solo se guarda al **rechazar** una solicitud de transferencia y solo se muestra en ese caso. El usuario quiere:

1. **Nota en aprobaciones**: si el admin aprueba un pago y agrega una nota (aunque todo esté OK), la nota debe **guardarse** y el usuario debe **verla en pagos** exactamente igual que cuando se rechaza (panel "Mis Solicitudes de Pago", fila de pago en `/dashboard/pagos`, correo y notificación in-app).
2. **Más feedback**: el mismo tipo de feedback que ya existe para las solicitudes debe extenderse — cuando se aprueba/rechaza cualquier pago, usuario y administrador deben recibir feedback claro:
   - **Admin**: confirmación visual tras aprobar/rechazar (toast de éxito con estado), y ver la nota guardada en la lista de solicitudes (aprobadas y rechazadas).
   - **Usuario**: nota del admin visible en aprobaciones (verde, "Nota del administrador") y rechazos (rojo, "Motivo del rechazo"), tanto en el panel de solicitudes como en la fila de pago de `/dashboard/pagos`, en la notificación in-app y en el correo.

## 2. Flujo de implementación propuesto

1. **`src/app/api/payments/review/route.ts`**:
   - En el **aprobar**: agregar `admin_note: adminNote || null` al UPDATE (hoy no se guarda). Pasar `adminNote` a `notifyTransferReviewEmail("approved", payment, adminNote)` y a `notifyUserPaymentStatus(admin, payment, "approved", adminNote)`.
   - En el **rechazar**: pasar `adminNote` también a `notifyUserPaymentStatus` (para que la notificación in-app incluya la nota).
2. **`src/lib/flow-helpers.ts` `notifyUserPaymentStatus`**: nuevo parámetro opcional `adminNote?: string`; si viene, se agrega al `content` de la notificación (`Nota del administrador: ...`).
3. **`src/lib/email.ts` `sendTransferReviewEmail`**: el bloque de nota se muestra en **ambos** outcomes, con label distinto: aprobado → "Nota del administrador", rechazado → "Motivo del rechazo". Hoy solo se muestra al rechazar y siempre dice "Motivo del rechazo".
4. **`src/app/admin/ventas/page.tsx`**:
   - Cambiar el label del textarea: "Nota (opcional, visible para el usuario)" (sin "al rechazar").
   - Agregar **toast de feedback** tras revisar: "Solicitud aprobada" / "Solicitud rechazada" (verde/rojo).
   - `SolicitudesSection`: mostrar la nota también en aprobadas (color verde) y en rechazadas (rojo, "Nota:").
5. **`src/components/dashboard/TransferRequestsPanel.tsx`**:
   - Mostrar nota también en `status === "pagado"`: caja verde "Nota del administrador". Mantener la caja roja "Motivo del rechazo" para `rechazado`.
6. **`src/components/dashboard/PaymentRow.tsx`**:
   - Mostrar `admin_note` también cuando `status === "pagado"` (texto verde) además del rechazado (rojo).
7. **Tests sección T** (ampliar): aprobación guarda admin_note; approve email incluye nota con label "Nota del administrador"; panel muestra nota en aprobadas; admin ventas tiene toast de feedback; notifyUserPaymentStatus acepta adminNote.

## 3. Análisis de impacto

- **No rompe** checkout/Flow/`getRemainingTokens`/asistencia/QR: solo se extiende el guardado de `admin_note` (ya existía en el esquema) y el render condicional.
- `admin_note` ya existe en `payments` (migración 013) y ya se lee en `PaymentData`/`Payment` → sin cambios de esquema ni migración.
- `notifyUserPaymentStatus` recibe un parámetro opcional; las llamadas existentes (confirmation/verify/force-confirm) no lo pasan → comportamiento inalterado (backward-compatible).
- El correo de aprobación ahora puede incluir nota: es un cambio de plantilla (solo si `adminNote` presente).

## 4. Documentación post-implementación

- `documentacion/requisitos-implementados.md`: actualizar sección 17 (pago manual) con el bullet de nota en aprobaciones.
- `contexto/BRAIN.md`: regla de test count + nota de `admin_note` en aprobaciones.
- `scripts/test-flows.mjs`: ampliar sección T.
- **Changelog**: nueva entrada `v1.2.0` en `contexto/migrations/017_changelog_v1_2_0.sql` + espejo en `squema-sql-actualizado.sql`.
