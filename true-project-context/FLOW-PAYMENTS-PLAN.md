# Plan de Implementación — Flow Payments + Compra de Membresías

> **Archivo**: `true-project-context/FLOW-PAYMENTS-PLAN.md`
> **Fecha**: 2026-07-17
> **Estado**: Plan completo — listo para implementar por fases

---

## 1. Visión General del Sistema de Pagos

### 1.1 Dos vías de asignación de membresías

El sistema ZONAELITE soporta **dos formas** de asignar membresías:

| Vía | Quién actúa | Método de pago | Flujo |
|---|---|---|---|
| **Manual (admin)** | Admin/Recepción | Transferencia, Efectivo, Otro | Admin busca usuario → selecciona beneficiario → asigna membresía → sube comprobante |
| **Online (usuario)** | El mismo usuario | Flow (Webpay, transferencia, etc.) | Usuario selecciona plan → elige beneficiario → paga vía Flow → membresía se crea automáticamente |

**Regla fundamental**: El precio siempre lo define el admin en el CRUD de planes (`membership_plans.price`). Flow usa ese precio. El admin puede asignar membresías sin precio (para casos especiales) pero Flow siempre cobra el precio del plan.

### 1.2 Diagrama de flujo completo

```
                    ┌─────────────────────────────────────────────┐
                    │          SISTEMA DE MEMBRESÍAS              │
                    │                                             │
                    │  membership_plans (precio definido por admin)│
                    │         │                                   │
                    │         ├──► ASIGNACIÓN MANUAL (admin)       │
                    │         │    Admin asigna → membresía creada │
                    │         │    Payment: method=transferencia   │
                    │         │                                   │
                    │         └──► COMPRA ONLINE (usuario)         │
                    │         │    Flow payment → membresía auto   │
                    │         │    Payment: method=flow            │
                    │         │                                   │
                    │  memberships ←── beneficiaries ←── dependents│
                    │                  (bridge table)    (cargas)  │
                    └─────────────────────────────────────────────┘
```

---

## 2. Modelo de Datos Actual vs Requerido

### 2.1 Tabla `payments` — Columnas actuales

```sql
payments (
  id uuid PK,
  user_id uuid FK profiles,
  membership_id uuid FK memberships (nullable),
  order_id uuid FK product_orders (nullable),
  concept text,
  amount numeric(10,2),
  method text CHECK (efectivo|transferencia|flow|otro),
  status text CHECK (pendiente|pagado|rechazado|expirado),
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz
)
```

### 2.2 Columnas nuevas requeridas

```sql
-- Agregar para tracking de Flow
ALTER TABLE public.payments
  ADD COLUMN commerce_order text UNIQUE,  -- UUID interno de la orden
  ADD COLUMN flow_token text,             -- Token de transacción Flow
  ADD COLUMN flow_order bigint;           -- Número de orden Flow
```

**¿Por qué `commerce_order`?** Flow necesita un identificador único de orden. Usamos un UUID propio para poder rastrear la orden internamente sin depender de Flow.

**¿Por qué `flow_token`?** Cuando Flow llama al callback, envía un token. Lo almacenamos para poder verificar el estado después.

### 2.3 Tabla `membership_plans` — Sin cambios

El precio ya está en `membership_plans.price`. Flow usa este precio directamente.

### 2.4 Tabla `memberships` — Sin cambios

Se crea igual que la asignación manual: `beneficiary_id, plan_id, purchased_by, start_date, end_date, status`.

---

## 3. Flujo Detallado por Escenario

### 3.1 Escenario A: Usuario compra vía Flow (happy path)

```
1. Usuario hace clic "Comprar" en landing → si no logueado → /auth
2. Abre CheckoutModal → ve resumen del plan
3. Selecciona beneficiario (yo / carga 1 / carga 2...)
4. Clic "Pagar con Flow"
5. Frontend POST /api/flow/create-order
   → Valida sesión, plan, ownership del beneficiario
   → Crea payment(status='pendiente', commerce_order=UUID)
   → Llama Flow API POST /payment/create
   → Retorna { url, token }
6. Redirect → Flow Checkout (url?token=token)
7. Usuario paga en Flow
8. Flow POST → /api/flow/confirmation (callback server-side)
   → Recibe token
   → Llama Flow /payment/getStatus para verificar
   → Si status=2 (aprobado):
     a. Actualiza payment.status='pagado', paid_at=now()
     b. Crea membership(beneficiary_id, plan_id, start=today, end=today+duración)
     c. Actualiza payment.membership_id
   → Responde HTTP 200
9. Flow Redirect → /dashboard/pagos?status=success
10. Usuario ve confirmación
```

### 3.2 Escenario B: Admin asigna manualmente (ya implementado)

```
1. Admin en /admin/membresias → clic "Asignar Membresía"
2. Busca usuario → selecciona beneficiario
3. Selecciona plan → fecha inicio → método (transferencia/efectivo)
4. Clic "Asignar Membresía"
5. Se crea membership directamente
6. Se crea payment(status='pagado', method=transferencia)
```

**Nota**: El admin puede asignar membresías **sin precio** o con precio diferente al del plan. Esto es intencional para casos manuales (becas, promociones, etc.).

### 3.3 Escenario C: Pago fallido o abandonado

```
1. Usuario inicia pago vía Flow
2. Cierra navegador / Flow rechaza pago
3. Payment queda en status='pendiente'
4. La membresía NO se crea
5. Opciones:
   - El usuario puede intentar de nuevo (nueva orden)
   - El admin puede ver pagos pendientes y decidir
   - Las órdenes pendientes expiran después de X tiempo (configurable)
```

---

## 4. Requerimientos por Fase

### FASE 0: Configuración Base (Prerequisitos)

**Objetivo**: Preparar entorno y esquema de BD para Flow.

**Tareas**:
1. Crear cuenta en Flow.cl (sandbox)
2. Obtener API Key y Secret Key de sandbox
3. Agregar variables de entorno en `.env.local`:
   ```
   FLOW_API_KEY=tu_api_key
   FLOW_SECRET_KEY=tu_secret_key
   FLOW_API_URL=https://sandbox.flow.cl/api
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```
4. Ejecutar SQL en Supabase:
   ```sql
   ALTER TABLE public.payments
     ADD COLUMN IF NOT EXISTS commerce_order text UNIQUE,
     ADD COLUMN IF NOT EXISTS flow_token text,
     ADD COLUMN IF NOT EXISTS flow_order bigint;

   CREATE INDEX IF NOT EXISTS idx_payments_commerce_order
     ON public.payments(commerce_order);
   ```
5. Verificar que el bucket `public` de Supabase Storage existe (ya creado)

**Problemas que resuelve**:
- `commerce_order UNIQUE` evita duplicados de órdenes
- `flow_token` permite verificar pagos después del callback
- Variables de entorno seguras (nunca en frontend)

**Archivos modificados**:
- `.env.local` (nuevo)
- SQL ejecutado en Supabase Dashboard

---

### FASE 1: Librería Flow (Server-Side)

**Objetivo**: Crear utilidades para comunicarse con Flow API.

**Archivo nuevo**: `src/lib/flow.ts`

**Funciones a implementar**:

```typescript
// Firma HMAC-SHA256 de parámetros
function signFlowParams(params: Record<string, string>, secretKey: string): string

// Crear orden de pago en Flow
async function createFlowOrder({
  commerceOrder: string,    // UUID interno
  subject: string,          // "Membresía - Nombre Plan"
  amount: number,           // Precio del plan (CLP)
  email: string,            // Email del usuario
  urlConfirmation: string,  // https://dominio.com/api/flow/confirmation
  urlReturn: string,        // https://dominio.com/dashboard/pagos
  metadata?: string,        // JSON con {paymentId, planId, beneficiaryId}
}): Promise<{ url: string; token: string; flowOrder: number }>

// Verificar estado de un pago
async function verifyFlowPayment(
  token: string
): Promise<{ status: number; amount: number; commerceOrder: string }>
```

**Detalles técnicos**:
- Usar `crypto.createHmac('sha256', secretKey)` (Node.js nativo)
- Usar `fetch()` para llamadas HTTP (Node.js 18+)
- Content-Type: `application/x-www-form-urlencoded`
- Params ordenados alfabéticamente para la firma
- Flow responde con `{ url, token, flowOrder }`

**Problemas que resuelve**:
- Firma correcta evita que Flow rechace las peticiones
- `commerceOrder` como UUID evita colisiones
- Verificación server-side del pago (no confiar en el redirect del frontend)

**Dependencias**: Ninguna externa. Solo Node.js nativo.

**Archivos nuevos**:
- `src/lib/flow.ts`

---

### FASE 2: API Routes (Server-Side Logic)

**Objetivo**: Endpoints para crear órdenes y recibir confirmaciones de Flow.

#### 2a. `POST /api/flow/create-order`

**Archivo**: `src/app/api/flow/create-order/route.ts`

**Request**:
```json
{ "planId": "uuid", "beneficiaryId": "uuid" }
```

**Lógica**:
1. Verificar sesión: `supabase.auth.getUser()` → obtener `user.id`
2. Validar `planId` → consultar `membership_plans` → obtener `price`, `duration_days`, `name`
3. Validar `beneficiaryId` → verificar ownership:
   - Buscar en `beneficiaries` donde `id = beneficiaryId`
   - Verificar `profile_id = user.id` OR `dependent_id` pertenece a un `dependent` donde `tutor_id = user.id`
4. Generar `commerce_order = crypto.randomUUID()`
5. Insertar en `payments`:
   ```sql
   INSERT INTO payments (user_id, commerce_order, concept, amount, method, status)
   VALUES ($userId, $commerceOrder, 'Membresía - ' || $planName, $planPrice, 'flow', 'pendiente')
   RETURNING id
   ```
6. Llamar Flow API:
   ```typescript
   createFlowOrder({
     commerceOrder,
     subject: `Membresía ${planName} - ZONAELITE`,
     amount: planPrice,
     email: user.email,
     urlConfirmation: `${BASE_URL}/api/flow/confirmation`,
     urlReturn: `${BASE_URL}/dashboard/pagos`,
     metadata: JSON.stringify({ paymentId, planId, beneficiaryId })
   })
   ```
7. Actualizar payment con `flow_token` y `flow_order`
8. Retornar `{ url, token }` al frontend

**Errores posibles y manejo**:
| Error | Causa | Respuesta |
|---|---|---|
| 401 | No hay sesión | "Inicia sesión para continuar" |
| 400 | planId inválido | "Plan no encontrado" |
| 400 | beneficiaryId no pertenece al usuario | "Beneficiario no válido" |
| 400 | Plan inactivo | "Plan no disponible" |
| 500 | Flow API error | "Error al procesar pago. Intenta de nuevo." |

#### 2b. `POST /api/flow/confirmation`

**Archivo**: `src/app/api/flow/confirmation/route.ts`

**Request**: Flow envía `token` como parámetro (POST body o query)

**Lógica**:
1. Recibir `token` del body (Content-Type: `application/x-www-form-urlencoded`)
2. Parsear body: `const params = new URLSearchParams(body); const token = params.get('token');`
3. Verificar pago: `verifyFlowPayment(token)`
4. Si `status === 2` (aprobado):
   a. Buscar payment: `SELECT * FROM payments WHERE flow_token = $token`
   b. Si `payment.status === 'pagado'` → responder 200 (ya procesado, idempotencia)
   c. Actualizar payment:
      ```sql
      UPDATE payments
      SET status = 'pagado', paid_at = now()
      WHERE id = $paymentId
      ```
   d. Parsear metadata del payment (planId, beneficiaryId) — **IMPORTANTE**: guardar metadata en el paso anterior
   e. Calcular `end_date = today + plan.duration_days`
   f. Crear membership:
      ```sql
      INSERT INTO memberships (beneficiary_id, plan_id, purchased_by, start_date, end_date, status)
      VALUES ($beneficiaryId, $planId, $userId, today, $endDate, 'activa')
      RETURNING id
      ```
   g. Actualizar payment:
      ```sql
      UPDATE payments SET membership_id = $membershipId WHERE id = $paymentId
      ```
5. Responder HTTP 200 SIEMPRE (Flow requiere respuesta en <15 segundos)

**Problemas que resuelve**:
- **Idempotencia**: Si Flow envía el callback 2 veces, el payment ya está `pagado` → no duplica membresía
- **Timeout**: Flow requiere HTTP 200 en <15 segundos. Toda la lógica debe ser rápida
- **Metadata**: Se guarda en el payment para saber qué plan y beneficiario crear

**Edge cases**:
- Flow envía callback pero el payment no existe → responder 200 igual (no fallar)
- El plan fue eliminado después de crear la orden → usar datos del payment (amount, concept)
- El beneficiario fue eliminado → la membresía no se crea, pero el pago queda registrado

---

### FASE 3: Frontend — CheckoutModal

**Objetivo**: Modal que el usuario ve al comprar un plan.

**Archivo nuevo**: `src/components/CheckoutModal.tsx`

**Props**:
```typescript
interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: { id: string; name: string; price: number; duration_days: number; category: string; benefits: string[] };
}
```

**Contenido visual**:
1. Header: "Comprar Membresía" + botón cerrar
2. Resumen del plan:
   - Nombre del plan
   - Precio formateado (`$25.000`)
   - Duración (`30 días`)
   - Beneficios (lista)
3. Selección de beneficiario:
   - Radio buttons
   - Opción 1: "Yo" (beneficiary del perfil del usuario)
   - Opción 2+: Cada carga del usuario (dependientes)
   - Si el usuario no tiene cargas, solo aparece "Yo"
4. Resumen de compra:
   - Plan + Precio
   - Beneficiario seleccionado
5. Botón "Pagar con Webpay" (gradient, disabled si no seleccionó beneficiario)

**Nota**: Solo se ofrece Webpay como medio de pago online. Transferencia y efectivo son solo para asignación manual del admin.

**Lógica**:
1. Al abrir: `useEffect` carga beneficiarios del usuario
   - Consultar `beneficiaries` donde `profile_id = user.id`
   - Consultar `dependents` donde `tutor_id = user.id` → luego `beneficiaries` de cada uno
2. Al hacer clic "Pagar":
   - POST `/api/flow/create-order` con `{ planId, beneficiaryId }`
   - Si respuesta OK: `window.location.href = url + '?token=' + token`
   - Si error: mostrar mensaje de error

**Problemas que resuelve**:
- **Selección de beneficiario**: El usuario decide para quién es la membresía
- **Validación client-side**: No permitir pagar sin seleccionar beneficiario
- **Loading state**: Botón deshabilitado durante la petición
- **Error handling**: Mostrar error si la API falla

**Dependencias**:
- `useSession()` de SessionProvider
- `createClient()` de Supabase client
- Admin FormModal (reutilizar estilo, pero crear modal propio)

---

### FASE 4: Integración con Landing

**Objetivo**: Cambiar botones de membresías para soportar compra online.

**Archivo modificar**: `src/components/Memberships.tsx`

**Cambios**:
1. Importar `useSession`, `CheckoutModal`
2. Agregar estado: `modalOpen`, `selectedPlan`
3. Lógica del botón:
   ```
   Si NO logueado → Link href="/auth" (como actual)
   Si logueado → onClick={() => { setSelectedPlan(plan); setModalOpen(true); }}
   ```
4. Renderizar `<CheckoutModal>` al final del componente
5. Texto del botón:
   - No logueado: "Seleccionar"
   - Logueado: "Comprar"

**Problemas que resuelve**:
- **UX clara**: No logueado → auth. Logueado → checkout directo
- **Sin redirección innecesaria**: El usuario no sale de la landing hasta que paga

---

### FASE 5: Post-Pago — Confirmación

**Objetivo**: Mostrar al usuario que su pago fue exitoso (o fallido).

**Archivos**:
- `src/components/PurchaseSuccessBanner.tsx` (nuevo)
- `src/app/dashboard/pagos/page.tsx` (modificar)

**PurchaseSuccessBanner**:
```
- Banner verde con ícono check
- Texto: "¡Pago exitoso! Tu membresía ha sido activada."
- Botón "Ver mis pagos" → /dashboard/pagos
- Se cierra con botón X
- Aparece solo si searchParams.status === 'success'
```

**Modificación a `/dashboard/pagos`**:
1. Leer `searchParams.get('status')` (necesita `useSearchParams`)
2. Si `status === 'success'`: mostrar `<PurchaseSuccessBanner>`
3. Si `status === 'failed'`: mostrar banner de error
4. Banner se descarta al navegar away

**Problemas que resuelve**:
- **Feedback inmediato**: El usuario sabe que el pago funcionó
- **Sin confusión**: El redirect de Flow va a `/dashboard/pagos`, no a la landing
- **Estado limpio**: El banner se cierra y no persiste

---

### FASE 6: Dashboard — Integración con Pagos

**Objetivo**: Los pagos vía Flow aparecen en el historial del usuario.

**Archivo modificar**: `src/components/dashboard/PaymentRow.tsx`

**Cambios**:
- El componente ya muestra: concepto, monto, estado, método
- Agregar ícono de método de pago:
  - `flow` → ícono de crédito/tarjeta
  - `transferencia` → ícono de banco
  - `efectivo` → ícono de efectivo
- El `payment.status` ya se muestra con `StatusBadge`

**No se necesita**: cambios significativos. El componente ya funciona para todos los métodos.

---

### FASE 7: Admin — Visualización de Pagos Flow

**Objetivo**: El admin ve los pagos Flow en su panel.

**Archivo modificar**: `src/app/admin/membresias/page.tsx`

**Cambios menores**:
- En el DataTable de membresías, la columna de pagos ya muestra el método
- Los pagos con `method='flow'` aparecen naturalmente
- El admin puede seguir asignando manualmente (no cambia nada)

**No se necesita**: cambios significativos. El sistema dual ya funciona.

---

### FASE 8: Edge Cases y Seguridad

**Problemas cubiertos por las fases anteriores**:

| Problema | Solución | Fase |
|---|---|---|
| Doble clic en "Pagar" | Botón disabled durante petición | 3 |
| Usuario cierra navegador | Payment queda `pendiente`, membresía no se crea | 2 |
| Flow envía callback 2 veces | Idempotencia: verificar `payment.status` antes de crear | 2 |
| Flow tarda >15 segundos | Toda la lógica del callback es queries simples (<1s) | 2 |
| Plan eliminado después de orden | Usar datos del payment (amount, concept) | 2 |
| Beneficiario eliminado | Membresía no se crea, pago queda registrado | 2 |
| Precio cambia después de orden | Usar `membership_plans.price` al momento de la orden | 1 |
| Concurrent purchases | `commerce_order UNIQUE` + validación previa | 1 |
| Admin asigna + usuario paga | Múltiples membresías activas permitidas | — |
| Flow sandbox vs producción | Variable de entorno `FLOW_API_URL` | 0 |
| Credenciales expiradas | Error en create-order → mensaje al usuario | 2 |
| Callback URL incorrecta | Verificar en panel de Flow la URL configurada | 0 |
| Monto incorrecto | Siempre usar `membership_plans.price` | 1 |
| Email no verificado en Flow | Flow lo maneja internamente | — |
| Timeout de sesión durante checkout | El pago se procesa server-side, no depende de sesión del browser | 2 |
| Usuario no tiene beneficiario | El trigger auto-crea al registrarse, modal valida existencia | 3 |

---

## 5. Variables de Entorno Requeridas

```env
# Flow (sandbox)
FLOW_API_KEY=FK2C5AE64-8911-4D18-B250-E2575C93E7BC
FLOW_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
FLOW_API_URL=https://sandbox.flow.cl/api

# Base URL (sin trailing slash)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**En producción**:
```
FLOW_API_URL=https://www.flow.cl/api
NEXT_PUBLIC_BASE_URL=https://zonaelite.cl
```

---

## 6. Configuración en Panel de Flow

En el panel de Flow.cl (sandbox), configurar:

1. **URL de Confirmación (Callback)**: `https://tu-dominio.com/api/flow/confirmation`
   - Esta URL recibe el POST de Flow cuando el pago se procesa
   - Debe ser accesible públicamente (no localhost en producción)

2. **URL de Retorno**: `https://tu-dominio.com/dashboard/pagos`
   - AQUÍ se redirige al usuario después de pagar
   - Agregamos `?status=success` o `?status=failed`

3. **Medios de pago**: Habilitar los deseados (Webpay, transferencia, etc.)

---

## 7. Resumen de Archivos

### Nuevos (5 archivos)
| Archivo | Fase |
|---|---|
| `src/lib/flow.ts` | 1 |
| `src/app/api/flow/create-order/route.ts` | 2 |
| `src/app/api/flow/confirmation/route.ts` | 2 |
| `src/components/CheckoutModal.tsx` | 3 |
| `src/components/PurchaseSuccessBanner.tsx` | 5 |

### Modificados (4 archivos)
| Archivo | Fase |
|---|---|
| `src/components/Memberships.tsx` | 4 |
| `src/app/dashboard/pagos/page.tsx` | 5 |
| `.env.local` | 0 |
| SQL en Supabase | 0 |

### Sin cambios necesarios
- `src/components/admin/AssignMembershipModal.tsx` (asignación manual ya funciona)
- `src/components/dashboard/PaymentRow.tsx` (ya muestra todos los métodos)
- `src/app/admin/membresias/page.tsx` (CRUD ya funciona)
- `src/lib/supabase/dashboard.ts` (queries ya existen)

---

## 8. Orden de Implementación Recomendado

```
FASE 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
Config   Lib   API  Modal Landing Confirm Dash  Admin  Security
```

Cada fase es **independiente y testeable** antes de pasar a la siguiente.

---

## 9. Testing Checklist

### Fase 0
- [ ] SQL ejecutado sin errores en Supabase
- [ ] Variables de entorno configuradas
- [ ] Cuenta de sandbox creada en Flow

### Fase 1
- [ ] `signFlowParams()` genera firma correcta (comparar con ejemplo de Flow)
- [ ] `createFlowOrder()` retorna `{ url, token, flowOrder }`
- [ ] `verifyFlowPayment()` retorna estado correcto

### Fase 2
- [ ] POST `/api/flow/create-order` crea payment y retorna URL
- [ ] POST `/api/flow/confirmation` actualiza payment y crea membresía
- [ ] Doble callback no duplica membresía
- [ ] Callback con token inválido no crashea

### Fase 3
- [ ] Modal muestra planes correctos
- [ ] Selección de beneficiario funciona (yo + cargas)
- [ ] Botón disabled sin selección
- [ ] Redirige a Flow correctamente

### Fase 4
- [ ] Botón "Comprar" aparece solo si logueado
- [ ] Botón "Seleccionar" aparece si no logueado
- [ ] Modal se abre con datos correctos del plan

### Fase 5
- [ ] Banner de éxito aparece después del pago
- [ ] Banner se cierra correctamente
- [ ] Pago aparece en historial

### Fase 6
- [ ] Pagos Flow aparecen en dashboard del usuario
- [ ] Membresía aparece como activa
- [ ] Barra de progreso funciona

### Fase 7
- [ ] Admin ve pagos Flow en su panel
- [ ] Asignación manual sigue funcionando

### Fase 8
- [ ] Todos los edge cases cubiertos
- [ ] No hay leaks de secretos en frontend
- [ ] Build pasa sin errores

---

## 10. Preguntas para el Usuario

1. ~~¿Tienes credenciales de sandbox de Flow?~~ → Necesario para FASE 0.
2. **Medios de pago**: Solo Webpay (tarjeta) para el usuario online. Transferencia/efectivo solo para admin manual.
3. ~~¿Timeout de orden?~~ → Default: sin expiración.
4. ~~¿Notificación al admin cuando llega un pago Flow?~~ → Opcional.
5. ~~¿Confirmación por email al usuario?~~ → Opcional.
