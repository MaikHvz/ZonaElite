# Requisito: Contraseña de protección para la sesión QR de asistencia

> **Migración:** `contexto/migrations/031_qr_session_lock.sql` · **Changelog:** `032_changelog_v1_9_0.sql` (v1.9.0)
> **Estado:** implementado

---

## 1. Explicación profunda del requisito

### 1.1 El problema

El check-in por QR de ZonaElite funciona así: el administrador (o el profesor) abre
`/admin/asistencia`, expande una sesión y pulsa **"Abrir sesión de asistencia QR"**. A partir de ese
momento la pantalla del profesor muestra un QR con la URL `/checkin/{session_id}` y todos los alumnos
la escanean con su propio celular para marcar su asistencia.

Ese celular/tablet del profesor **queda a la vista y al alcance de los alumnos** mientras dura la clase.
Hoy no hay ninguna barrera entre un alumno y el panel de administración que el profesor tiene abierto:

1. **Colapsar y volver a expandir el acordeón** (`toggleSession`) solo esconde el QR. El alumno puede
   volver a hacer clic y ver el QR de nuevo, sin que el profesor se entere.
2. **Cerrar o reabrir la sesión** (`handleActivateSession` / `handleCloseSession`) se ejecuta con el
   *browser client* usando el RLS `class_sessions_admin_write`. Como el dispositivo está autenticado
   como administrador, cualquier persona que tome el celular tiene exactamente los mismos permisos que
   el profesor: puede pulsar "Finalizar asistencia" o invocar la API directamente.
3. **El QR no es un secreto rotatorio**: es el UUID de la sesión y no cambia nunca. Quien lo fotografíe
   puede reutilizar la URL más tarde mientras la sesión siga `activa` (el cierre es manual).

El requisito es que **la pantalla de la sesión QR esté protegida por una contraseña segura**, y que esa
contraseña sea **configurable desde el panel de administración**.

### 1.2 Roles involucrados

| Rol | Interacción |
|-----|-------------|
| **Administrador (role_id=1)** | Configura la contraseña en `/admin/configuracion`; la ingresa para desbloquear el QR, para volver a expandir una sesión activa y para finalizar la asistencia. |
| **Alumno / Tutor** | No ve nunca la contraseña. Si toma el celular del profesor, encuentra el panel bloqueado y no puede ver el QR ni cerrar la sesión. |
| **Sistema** | `/api/checkin` (alumno) no cambia: sigue exigiendo sesión autenticada + `class_sessions.status = 'activa'`. |

### 1.3 Decisiones tomadas

| Decisión | Valor | Motivo |
|----------|-------|--------|
| Acciones protegidas | **Ver el QR / expandir** y **Finalizar asistencia** | Son las dos acciones desde las que un alumno obtiene el QR o destruye la sesión. "Reabrir sesión" queda cubierta de forma natural: activar no muestra el QR hasta que se desbloquee. |
| Verificación | **Server-side** (`/api/admin/close-session`) | Un gate solo en la UI sería decorativo: el UPDATE de `class_sessions.status` seguiría siendo ejecutable con el browser client. |
| Alcance de la contraseña | **Una global de la academia** | La academia tiene 1–2 personas a cargo; una contraseña compartida es operable en el mostrador. |
| Sin contraseña configurada | **Fail-open + aviso visible** | Nunca deja al administrador encerrado fuera de su propio panel. El aviso rojo indica que la protección está inactiva. |

---

## 2. Flujo de implementación propuesto

### 2.1 Base de datos (`031_qr_session_lock.sql`)

Tabla **singleton** con el hash de la contraseña. **No** puede vivir en `academy_settings` porque esa
tabla tiene `academy_settings_select_all ... USING (true)`: cualquiera que llame a la API REST de
Supabase leería el hash.

```sql
public.qr_session_lock (
  id            uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',  -- singleton
  password_hash text NOT NULL,     -- scrypt (N=16384, r=8, p=1, keylen=64) en hex
  password_salt text NOT NULL,     -- 16 bytes aleatorios en hex
  updated_at    timestamptz DEFAULT now() NOT NULL,
  updated_by    uuid
)
```

- `enabled` **no** se agrega: la existencia de la fila *es* el interruptor (fail-open si no hay fila).
- RLS: `ENABLE ROW LEVEL SECURITY` + **una sola** policy `qr_session_lock_admin_all FOR ALL USING (is_admin()) WITH CHECK (is_admin())`.
  Ningún usuario no-admin puede leer ni escribir; el service role la ignora (como todas las tablas).
- Trigger `update_updated_at()` reutilizado (patrón de las demás tablas).
- No se crea fila inicial → fail-open.

### 2.2 Hashing (`src/lib/qr-lock.ts`, server-only)

Usa `node:crypto` (**sin dependencias nuevas**; el repo ya usa `crypto` en `flow.ts`, `store.ts`,
`create-user/route.ts` y `payments/transfer/route.ts`):

- `scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` con salt de 16 bytes (`crypto.randomBytes`).
- Comparación con `crypto.timingSafeEqual` sobre buffers del mismo largo.
- `MIN_PASSWORD_LENGTH = 4` (contraseña de mostrador; se recomienda 6+ en la UI).
- **Rate limit en memoria** por `user_id`: 8 intentos fallidos → bloqueo de 15 minutos, respuesta 429.
  Se limpia al acertar.

### 2.3 Rutas de API

| Ruta | Método | Acción | Body | Respuesta |
|------|--------|--------|------|-----------|
| `/api/admin/qr-lock` | GET | Estado (para el badge de las dos páginas) | — | `{ configured, updated_at }` — **nunca el hash** |
| `/api/admin/qr-lock` | POST | `set` | `{ action:"set", password, current_password? }` | `{ ok:true }` — si ya existe, exige `current_password` correcto |
| `/api/admin/qr-lock` | POST | `clear` | `{ action:"clear", current_password }` | `{ ok:true }` — borra la fila (fail-open) |
| `/api/admin/qr-lock` | POST | `verify` | `{ action:"verify", password }` | `{ ok:true }` / 401 `Contraseña incorrecta` / 429 |
| `/api/admin/close-session` | POST | Finalizar asistencia | `{ session_id, password }` | `{ ok, warning?, summary:[{beneficiary_id, full_name, marked_at}] }` |

Todas: `role_id === 1` obligatorio (patrón de `create-dependent`), `getAdminClient()` para leer/escribir
el hash, respuestas `Cache-Control: no-store`, y `audit_logs` en cada evento sensible
(`set_qr_lock_password`, `clear_qr_lock_password`, `verify_qr_lock_denied`, `close_session`,
`close_session_denied`).

`/api/admin/close-session` mueve la lógica que hoy vive en `handleCloseSession` (page.tsx:331-441):

1. Verifica rol admin y contraseña (fail-open si no hay fila, devolviendo `warning`).
2. Sesión personalizada → lee `personalized_enrollments`; normal → `class_enrollments` de
   `session_id` **más** las del horario recurrente (`schedule_id` con `session_id IS NULL`).
3. Inserta `ausente` para los inscritos sin registro en `attendance`.
4. `UPDATE class_sessions SET status='cerrada'`.
5. Devuelve el **resumen de check-ins por QR** (mismo criterio que antes: `source = 'qr'` en normal,
   todos los presentes en personalizada) con el nombre resuelto desde
   `beneficiaries → profiles.full_name | dependents.full_name`.

### 2.4 Frontend

**`src/app/admin/asistencia/page.tsx`**

- Estados nuevos: `qrLockConfigured`, `qrUnlocked` (**solo en memoria**, nunca en `localStorage`),
  `unlockTarget`, `unlockPassword`, `unlockError`, `unlockLoading`, `lockPanel()`.
- `GET /api/admin/qr-lock` al montar → badge "Protegida" / aviso "Configura la contraseña en
  Configuración →" cuando no hay fila.
- `toggleSession`:
  - **Colapsar** la sesión activa → `lockPanel()` (el QR se oculta y hay que volver a digitar la
    contraseña). Esto cubre el "volver atrás" del alumno.
  - **Expandir** una sesión con `status='activa'` → si hay contraseña configurada, muestra el panel
    bloqueado (no el QR) hasta verificarla; si no la hay, muestra el QR con el aviso fail-open.
- Botón **"Bloquear"** explícito en el panel del QR (inmediato, sin contraseña).
- `handleCloseSession` → ahora `POST /api/admin/close-session` con la contraseña del modal; el resumen
  se arma con la respuesta del servidor. Sin contraseña configurada el botón Finalizar funciona sin
  pedirla (fail-open) y se muestra el aviso.
- `handleActivateSession` se mantiene (activar no muestra el QR: el panel queda bloqueado hasta
  desbloquear), por lo que "Reabrir sesión" también queda cubierto.

**`src/app/admin/configuracion/page.tsx`** → sección nueva **"Seguridad de la sesión QR"**:
estado, contraseña + confirmación, "Guardar contraseña" (exige la actual si ya hay una),
"Quitar protección" y el texto de advertencia cuando está inactiva.

---

## 3. Análisis de impacto (no romper nada)

| Flujo existente | Evaluación |
|-----------------|------------|
| `CheckoutModal` / webhook Flow | **Sin impacto.** No se toca `payments`, `memberships` ni `flow-helpers.ts`. |
| Tokens y deudas (`get_remaining_tokens`, `debts`) | **Sin impacto.** El cierre sigue marcando `ausente` a los inscritos sin registro; la lógica de `class_enrollments` (`session_id` + horario recurrente) se replica 1:1 en el servidor, solo cambia quién la ejecuta. |
| `/api/checkin` (alumno) | **Sin cambios.** Sigue validando `status='activa'` y `mode !== 'personalizado'` en servidor. La contraseña no se aplica al alumno: si el QR está publicado y la sesión activa, el check-in es legítimo. |
| Zonas horarias | **Sin impacto.** No se calculan fechas; `session_date` y `marked_at` no se tocan (el `marked_at` de los `ausente` pasa de `new Date().toISOString()` cliente a `new Date().toISOString()` servidor, mismo instante). No se usan `toISOString().split("T")[0]` ni `new Date(y, m, 1).toISOString()`. |
| RLS de `class_sessions` / `attendance` | **Sin cambios de policies.** `close-session` escribe con service role, igual que el browser client lo hacía con `is_admin()`. No se crean policies nuevas. |
| `academy_settings` | **No se toca.** Sigue siendo legible por todos (por eso el hash va en su propia tabla). |
| `scripts/test-flows.mjs` | Se agregan asserts en la sección **AD** y se actualiza el espejo SQL; el assert de sincronía migración↔espejo se mantiene verde. |
| Reversión | `DROP TABLE public.qr_session_lock;` deja el panel exactamente como está hoy (fail-open). |

### Riesgos aceptados

1. **El alumno puede navegar fuera del panel** (barra del navegador, otra app). La contraseña no puede
   impedir eso; lo que evita es que **vea el QR** o **cierre la sesión** sin que el profesor lo sepa.
2. **La contraseña vive en la memoria de la pestaña**: si el profesor deja el celular desbloqueado, el
   QR sigue visible (igual que hoy). Por eso existe el botón "Bloquear".
3. **Fase 2 opcional (no implementada)**: rotar un token secreto por sesión dentro del QR para que una
   foto del QR quede invalidada al cerrar. Requiere columna en `class_sessions` y validación en
   `/api/checkin`; es un cambio mayor y no era parte de este requisito.
