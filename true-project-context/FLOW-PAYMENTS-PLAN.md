# Plan de Implementación — Pagos con Flow y Asignación de Beneficiarios

> **Archivo**: `true-project-context/FLOW-PAYMENTS-PLAN.md`  
> **Estado**: Propuesta de diseño e integración  
> **Objetivo**: Integrar la pasarela de pagos Flow para la compra de membresías online, resolviendo el problema de las transacciones pendientes (HTTP 308) y permitiendo asignar la membresía adquirida al titular o a una de sus cargas (dependientes).

---

## 1. Diagnóstico de Problemas Actuales

### 1.1. Error HTTP 308 en la Confirmación de Flow
**Causa raíz**: Flow realiza una petición POST de confirmación a la URL de callback provista (`urlConfirmation`). Si la URL usa `http://` en lugar de `https://`, Vercel/Next.js redirigen la petición con un estado HTTP 308 Permanent Redirect. Flow no sigue redirecciones POST y reporta error inmediato, dejando el pago en estado "pendiente" en nuestra base de datos.
- **Ejemplo**: `http://zona-elite-six.vercel.app/api/flow/confirmation` -> Redirect 308 -> Falla.
- **Solución**: Asegurar que la variable de entorno `NEXT_PUBLIC_BASE_URL` en Vercel esté configurada con `https://` y actualizar los fallbacks locales en el código.

### 1.2. Error de Asignación por Beneficiarios Faltantes
**Causa raíz**: El trigger de base de datos `trg_profiles_create_beneficiary` crea el registro en la tabla `beneficiaries` de forma automática al registrar un nuevo perfil. Sin embargo, los perfiles creados antes de la activación de este trigger no cuentan con dicho registro, provocando que la consulta de beneficiario retorne vacía y la creación de la membresía aborte en silencio.
- **Solución**: Ejecutar un script de migración correctiva para crear beneficiarios faltantes de perfiles históricos y asegurar un fallback seguro en el backend.

### 1.3. Asignación Rígida al Titular
**Causa raíz**: La lógica actual de confirmación (`confirmation/route.ts` y `verify/route.ts`) asume que el beneficiario siempre es el usuario que realiza la compra (`ownBeneficiary`). No tiene soporte para asignar la membresía a dependientes (cargas).
- **Solución**: Guardar el `beneficiary_id` directamente en la tabla de pagos (`payments`) al iniciar la orden y usarlo en el callback para crear la membresía.

---

## 2. Cambios Propuestos en la Base de Datos

Para que la base de datos sea robusta e independiente de factores externos, asociaremos el pago directamente con el beneficiario destino en la tabla `payments`.

```sql
-- 1. Agregar columna beneficiary_id a la tabla payments
ALTER TABLE public.payments 
ADD COLUMN beneficiary_id uuid REFERENCES public.beneficiaries(id) ON DELETE SET NULL;

-- 2. Script correctivo para crear beneficiarios faltantes en perfiles históricos
INSERT INTO public.beneficiaries (profile_id)
SELECT id FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.beneficiaries b WHERE b.profile_id = p.id
);
```

---

## 3. Ajuste en el SDK de Flow (`src/lib/flow.ts`)

La API de Flow no tiene un parámetro llamado `metadata`. El parámetro oficial para enviar datos adicionales es `optional` (cadena de texto o JSON string).

```typescript
// Modificación en createFlowOrder en src/lib/flow.ts
export async function createFlowOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const signParams: Record<string, string> = {
    apiKey: config.apiKey,
    commerceOrder: params.commerceOrder,
    subject: params.subject,
    currency: "CLP",
    amount: String(params.amount),
    email: params.email,
    urlConfirmation: params.urlConfirmation,
    urlReturn: params.urlReturn,
  };

  // CAMBIO: Mapear metadata al parámetro oficial 'optional' de Flow
  if (params.metadata) {
    signParams.optional = JSON.stringify(params.metadata);
  }

  const s = signFlowParams(signParams);
  const body = { ...signParams, s };
  
  // POST request...
}
```

---

## 4. Flujo de Compra y Asignación (Modo Alumno)

```
[Usuario en Web] -> Elige Plan -> Selecciona Beneficiario (Él o Carga)
        │
        ▼
[POST /api/flow/create-order] 
  - Crea pago en `payments` con `status='pendiente'` y el `beneficiary_id` seleccionado.
  - Genera orden en Flow pasando `metadata` en el campo `optional`.
        │
        ▼
[Redirección a Flow] -> Usuario Paga con Transbank/Webpay
        │
        ├── (A) Notificación Back-to-Back [POST /api/flow/confirmation]
        │         │
        │         ▼
        │       Verifica estado del pago en Flow.
        │       Si pagado: 
        │         1. Obtiene `beneficiary_id` del registro `payments` local (o del `optional` de Flow).
        │         2. Crea membresía en `memberships` para ese beneficiario.
        │         3. Cambia `payments.status` a 'pagado' y asocia `membership_id`.
        │
        └── (B) Retorno del Usuario [GET /dashboard/pagos?token=...]
                  │
                  ▼
                Pantalla de espera / Verificación local (POST /api/flow/verify)
                Si el webhook (A) no ha corrido, verifica y procesa el pago de forma síncrona.
```

---

## 5. Modificaciones de Código

### 5.1. Actualización de `/api/flow/create-order/route.ts`
Modificar la inserción del pago para registrar el beneficiario de destino:

```typescript
    // Guardar el beneficiario en el pago local
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        beneficiary_id: beneficiaryId, // Nueva columna
        commerce_order: commerceOrder,
        concept: `Membresía ${plan.name}`,
        amount: plan.price,
        method: "flow",
        status: "pendiente",
      })
      .select("id")
      .single();
```

Y asegurar que `urlConfirmation` y `urlReturn` apunten siempre a la URL correcta usando HTTPS:
```typescript
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zona-elite-six.vercel.app";
```

### 5.2. Actualización de `createMembership` en `/api/flow/confirmation/route.ts` y `/api/flow/verify/route.ts`

Hacer que la función busque el beneficiario guardado en el pago local o en la metadata de Flow en vez de asumir siempre el titular:

```typescript
async function createMembership(
  supabase: any,
  paymentId: string,
  userId: string,
  flowMetadata?: any
) {
  // 1. Obtener datos del pago
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, concept, membership_id, beneficiary_id")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.membership_id) return;

  // 2. Extraer plan
  const metadataMatch = payment.concept?.match(/^Membresía\s+(.+)$/);
  const planName = metadataMatch ? metadataMatch[1].trim() : null;
  if (!planName) return;

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName)
    .single();
  if (!plan) return;

  // 3. Determinar Beneficiario
  let targetBeneficiaryId = payment.beneficiary_id;

  // Fallback 1: Si no está en el pago local, buscar en metadata de Flow
  if (!targetBeneficiaryId && flowMetadata) {
    try {
      const meta = typeof flowMetadata === "string" ? JSON.parse(flowMetadata) : flowMetadata;
      targetBeneficiaryId = meta.beneficiaryId || meta.beneficiary_id;
    } catch (e) {
      console.error("Error al parsear metadata de Flow:", e);
    }
  }

  // Fallback 2: Si todo falla, asignar al titular de la cuenta
  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    targetBeneficiaryId = ownBeneficiary?.id;
  }

  if (!targetBeneficiaryId) {
    console.error("No se pudo determinar el beneficiario para el pago:", paymentId);
    return;
  }

  // 4. Prevenir duplicaciones de membresía
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) {
    await supabase
      .from("payments")
      .update({ membership_id: existing.id })
      .eq("id", paymentId);
    return;
  }

  // 5. Crear membresía activa
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: membership } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: targetBeneficiaryId,
      plan_id: plan.id,
      purchased_by: userId,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  if (membership) {
    await supabase
      .from("payments")
      .update({ membership_id: membership.id })
      .eq("id", paymentId);
  }
}
```

---

## 6. Integración en la Interfaz de Usuario (Dashboard Alumno)

### 6.1. Botón "Comprar Membresía" con Selector de Beneficiario
En la landing page (`/` o en `/dashboard/membresias` si no tiene plan activo), el usuario hace clic en "Comprar Plan".

1. **Abrir Modal de Checkout**:
   El modal muestra el resumen del plan (Nombre, Precio) y le pregunta para quién es la membresía:
   - **Opción A**: Para mí (`user.full_name`)
   - **Opción B**: Para una de mis cargas (Lista desplegable cargada de `dependents`)

2. **Crear Orden de Pago**:
   Al hacer clic en "Ir a Pagar", el cliente envía al backend:
   ```json
   {
     "planId": "fbe92238-52ac-487b-9228-a9fbc5cba22c",
     "beneficiaryId": "1d9bfd15-cf3e-4234-8b85-d9e2b9e9803f"
   }
   ```
   *Nota*: El cliente debe obtener primero el `beneficiary_id` del dependiente o del perfil. Si es una carga, hace un fetch rápido al puente `beneficiaries` usando la relación del dependiente.

3. **Redirección**:
   Recibe la URL de Flow y redirige al usuario para pagar.

---

## 7. Plan de Pruebas y Verificación

### 7.1. Verificación Técnica
1. **Prueba de Redirección (308 Fix)**:
   Asegurar que la URL generada en Flow apunte a `https://zona-elite-six.vercel.app/api/flow/confirmation` (HTTPS) y retorne `HTTP 200 OK` directamente.
2. **Prueba de Integridad de Beneficiario**:
   Realizar una compra de prueba en el Sandbox de Flow:
   - Caso A: Comprar para el usuario titular -> Verificar en BD que la membresía tenga el `beneficiary_id` del titular.
   - Caso B: Comprar para un dependiente/carga -> Verificar en BD que la membresía tenga el `beneficiary_id` del dependiente.
3. **Prueba de Historial**:
   Verificar que el pago y la membresía aparezcan en la sección `/dashboard/pagos` y `/dashboard/membresias` del alumno correspondiente de forma inmediata tras el redireccionamiento.
