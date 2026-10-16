# Requisito: Ficha rápida de usuario (admin) + Renovación de membresías

**Fecha:** 2026-10-16 · **Versión:** v1.14.0 · **Migraciones:** `044_membership_renewal_requests.sql`, `045_changelog_v1_14_0.sql`
**Pedido del cliente (9 oct):** "Tío Juan quiere renovarlas él mismo, porque a los alumnos les da lata entrar a pagar": un botón fácil de "Renovar membresía vencida". Pedido del usuario: popup con el perfil del alumno al hacer clic en su nombre en el admin, y solicitud de renovación desde el panel del alumno.

## 1. Requisito

1. **Ficha rápida (admin):** en el panel admin, cada nombre de alumno es clickeable y abre un popup con sus datos (correo, teléfono, RUT, nacimiento y categoría, dirección, apoderado, estado de la cuenta), su **membresía activa** (plan, vigencia, días restantes y tokens) o, si no tiene, la última vencida con el botón **Renovar membresía**. También muestra su matrícula, sus packs personalizados vigentes y si tiene una solicitud de renovación pendiente.
2. **Renovar (admin):** en `/admin/membresias` → Membresías, una membresía vencida cuyo alumno no tiene otra activa muestra **Renovar**. Abre "Asignar membresía" precargado (alumno, mismo plan, inicio hoy, monto del plan). El admin elige método, monto y comprobante como en una asignación normal.
3. **Solicitar renovación (alumno):** con la membresía vencida y sin otra activa, el alumno ve **Solicitar renovación** (en el aviso del resumen y en "Membresías"). Envía la solicitud con una nota opcional. No paga en línea: el pago lo coordina con la academia (hoy todo es manual). Puede cancelarla mientras esté pendiente.
4. **Atención admin:** las solicitudes pendientes aparecen al inicio de Membresías → Membresías con **Renovar** (abre el mismo flujo precargado) o **Rechazar** (con motivo). Se avisa al staff con una notificación interna, por correo a los administradores y con un contador en el menú lateral ("Membresías").
5. **Auto-aceptación:** si al alumno se le asigna una membresía **por cualquier vía** (Renovar, Asignar membresía, aprobación de transferencia o pago Flow) mientras tiene una solicitud pendiente, la solicitud se **aprueba automáticamente**, queda vinculada a esa membresía y el alumno recibe una notificación.

Roles: Administrador (renueva, rechaza, ve la ficha) · Alumno (solicita y cancela).

## 2. Diseño

- **BD (`044`)**: tabla `membership_renewal_requests` (beneficiario, quien la pide, membresía anterior, plan, nota, `status` `pendiente|aprobada|rechazada|cancelada`, membresía resultante, quién y cuándo la resolvió, `admin_note`); índice único parcial (una pendiente por beneficiario); RLS solo SELECT (dueño o admin). Escritura únicamente por RPC `SECURITY DEFINER` (`request_membership_renewal`, `cancel_membership_renewal`, `reject_membership_renewal`), con `REVOKE … FROM PUBLIC, anon` (lección de la 039). La auto-aceptación es un **trigger `AFTER INSERT ON memberships`** (`status = 'activa'`), así cubre todas las vías de asignación sin tocar cada flujo.
- **API `POST /api/memberships/renewal-request`**: llama al RPC con la sesión del usuario (RLS y `auth.uid()` reales) y después envía el correo a los admins en segundo plano (`after()`).
- **UI**: `UserQuickViewProvider` en `admin/layout` + `<UserNameButton>` en las pantallas admin. El provider monta su propio `AssignMembershipModal` para renovar desde la ficha y emite el evento `zonaelite:admin-data-changed` para que la página recargue. `AssignMembershipModal` acepta `prefill` (alumno + plan). `RenewalRequestButton` en el panel del alumno.

## 3. Análisis de impacto

| Flujo | Impacto | Verificación |
|-------|---------|--------------|
| Asignar membresía (admin) | Solo agrega `prefill` opcional; sin `prefill` no cambia nada | Mismo `handleSave` |
| Pago Flow / transferencia | No cambia; si había solicitud pendiente se aprueba por el trigger | Trigger `AFTER INSERT` independiente del flujo; no modifica la membresía insertada |
| `idx_memberships_one_active` / dedup | Sin cambios: el trigger no inserta membresías | — |
| Tokens / asistencia / dashboard | Sin cambios | La solicitud no crea membresías por sí misma |
| RLS existente | Tabla nueva sin escritura directa; RPC validan dueño o admin | Patrón de `enroll_event` |
| Fechas | Se usa `chile_today()` (BD) y `getChileToday()` (UI) | — |
| Notificaciones staff | `type='sistema'`, `target='staff'` (permitidos desde la 035) | CHECK reales |
| Pantallas admin con nombres | El nombre pasa a ser un botón; sin cambios de datos | Solo presentación |

## 4. Reversión

`DROP TRIGGER trg_memberships_resolve_renewals ON public.memberships; DROP TABLE public.membership_renewal_requests;` y revertir los componentes.
