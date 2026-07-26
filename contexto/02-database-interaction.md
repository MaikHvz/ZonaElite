# 02 - Interacción con la Base de Datos

## Tabla de Contenidos

1. [Arquitectura de Acceso a Datos](#1-arquitectura-de-acceso-a-datos)
2. [Funciones RPC (PostgreSQL)](#2-funciones-rpc-postgresql)
3. [Funciones Auxiliares de RLS](#3-funciones-auxiliares-de-rls)
4. [Interacciones por Módulo](#4-interacciones-por-módulo)
5. [Storage (S3) - Interacción con Archivos](#5-storage-s3---interacción-con-archivos)
6. [Tablas y Columnas Principales](#6-tablas-y-columnas-principales)
7. [Queries Más Complejas Explicadas](#7-queries-más-complejas-explicadas)
8. [Patrones de Error Handling](#8-patrones-de-error-handling)

---

## 1. Arquitectura de Acceso a Datos

### 1.1 Infraestructura

- **Base de datos**: PostgreSQL alojada en Supabase en `db.sfkkfcticgqdqvzthimz.supabase.co:5432/postgres`
- **Storage**: Supabase Storage (compatible S3), bucket `"public"` (lectura pública)
- **RLS**: 59 políticas de Row-Level Security habilitadas en todas las tablas

### 1.2 Clientes de Supabase

El sistema utiliza **dos clientes** con propósitos distintos:

#### Admin Client (solo server-side)

**Archivo**: `src/lib/supabase/admin.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient<any, "public", any>> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — add it to Vercel env vars"
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
```

**Uso**:
- API routes (`/api/flow/*`, `/api/admin/*`)
- Callbacks `after()` de Next.js (procesamiento background)
- Operaciones administrativas que requieren bypass de RLS
- **Nunca** se expone al cliente (browser)

#### Browser Client (client-side)

**Archivo**: `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

**Uso**:
- Componentes `"use client"` en el navegador
- Respetan RLS completamente
- Usado en páginas de dashboard, admin, páginas públicas

#### Server Client (server-side rendering)

**Archivo**: `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component — ignore */ }
        },
      },
    }
  );
}
```

**Uso**: API routes que necesitan verificar la sesión del usuario (`create-order`, `verify`).

### 1.3 Storage (S3-compatible)

**Bucket**: `"public"` (lectura pública, escritura autenticada)

**Carpetas**:

| Carpeta     | Uso                              |
|-------------|----------------------------------|
| `products/` | Imágenes de productos de la tienda |
| `events/`   | Imágenes de eventos              |
| `gallery/`  | Imágenes del carrusel de `/nosotros` |
| `blog/`     | Imágenes de portada de posts      |
| `settings/` | Logo de la academia               |

**Helper**: `src/lib/supabase/storage.ts`

```typescript
export async function uploadImage(file: File, folder: string): Promise<string> {
  // Validación: 5MB max, solo JPG/PNG/WebP/GIF
  // Genera UUID path: {folder}/{uuid}.{ext}
  // Retorna URL pública
}

export async function deleteImage(url: string): Promise<void> {
  // Parsea la URL para extraer el path
  // Elimina del bucket "public"
}

export function getImagePath(url: string): string | null {
  // Extrae el storage path desde la URL pública
}
```

### 1.4 Resumen de Acceso

| Cliente    | Ubicación      | RLS    | Servicio Role Key | Uso principal         |
|------------|----------------|--------|-------------------|----------------------|
| Admin      | Server (API)   | Bypass | Si                | Pagos,CRUD admin     |
| Browser    | Client (RSC)   | Activo | No                | Dashboard, public    |
| Server     | Server (RSC)   | Activo | No                | Auth verification    |

---

## 2. Funciones RPC (PostgreSQL)

### 2.1 `is_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_id = 1
  );
$$;
```

**Parámetros**: Ninguno (usa `auth.uid()` implicitamente)
**Retorna**: `true` si el usuario tiene `role_id = 1`
**Uso en RLS**: Políticas de acceso admin (CRUD en tablas administrativas)

### 2.2 `is_staff()`

```sql
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_id IN (1, 2, 3)
  );
$$;
```

**Parámetros**: Ninguno
**Retorna**: `true` si el usuario tiene `role_id` en (1, 2, 3) — admin, staff o profesor
**Uso en RLS**: Políticas que permiten acceso a staff completo

### 2.3 `owns_beneficiary(b_id UUID)`

```sql
CREATE OR REPLACE FUNCTION public.owns_beneficiary(b_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beneficiaries
    WHERE id = b_id AND (
      profile_id = auth.uid() OR
      dependent_id IN (
        SELECT id FROM public.dependents WHERE tutor_id = auth.uid()
      )
    )
  );
$$;
```

**Parámetros**: `b_id UUID` — ID del beneficiario a verificar
**Retorna**: `true` si el beneficiario pertenece al usuario actual (propio o carga)
**Uso en RLS**: Aislamiento de datos de usuario en asistencia, membresías, registros médicos

### 2.4 `handle_new_user()`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    4
  );
  RETURN NEW;
END;
$$;
```

**Trigger**: `AFTER INSERT ON auth.users`
**Efecto**: Al registrarse un usuario, crea automáticamente una fila en `profiles` con `role_id=4` (usuario normal)

### 2.5 `update_updated_at()`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

**Triggers aplicados**: `profiles`, `dependents`, `products`, `medical_records`

---

## 3. Funciones Auxiliares de RLS

Las 3 funciones definidas en la sección 2 se usan a través de **59 políticas RLS** en todas las tablas. El admin client (`getAdminClient()`) usa la `SERVICE_ROLE_KEY` que **bypassa todas las políticas RLS**, mientras que el browser client las respeta completamente.

### Patrones de Políticas

| Patrón                        | Tablas                                        | Descripción                              |
|-------------------------------|-----------------------------------------------|------------------------------------------|
| `SELECT USING (true)`         | roles, disciplines, schedules, products, events, membership_plans | Lectura pública para todos |
| `SELECT USING (id = auth.uid() OR is_admin())` | profiles | Lectura propio + admin |
| `SELECT USING (owns_beneficiary(...))` | beneficiaries, attendance, medical_records, body_metrics, consent_forms | Solo propietario o admin |
| `FOR ALL USING (is_admin())` | disciplines, schedules, products, events, membership_plans, notifications | Escritura solo admin |
| `INSERT WITH CHECK (is_admin())` | attendance, payments, class_enrollments | Insert solo admin |
| `status = 'publicado' OR is_admin()` | blog_posts | Público ve publicados, admin todo |

---

## 4. Interacciones por Módulo

### 4.1 Auth & Profiles

#### Registro (Signup)

1. Supabase Auth crea la fila en `auth.users`
2. El trigger `handle_new_user()` crea automáticamente:
   - Fila en `profiles` con `role_id=4`
3. Flujo en `src/lib/supabase/auth.ts`:

```typescript
export async function signUp(email: string, password: string, name: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}
```

#### Login

```typescript
export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}
```

El `SessionProvider` luego carga el perfil desde `profiles` para obtener `role_id`.

#### Lectura de Perfil

**Archivo**: `src/lib/supabase/profile.ts`

```typescript
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as UserProfile | null;
}
```

#### Actualización de Perfil

**Archivo**: `src/lib/supabase/dashboard.ts` — `updateProfile()`

```typescript
export async function updateProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; birth_date?: string }
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  });
}
```

### 4.2 Membresías

#### Obtener Membresías del Usuario — `getUserMemberships(userId)`

**Archivo**: `src/lib/supabase/dashboard.ts:98-152`

Esta es una de las queries más complejas. Resuelve todos los beneficiarios del usuario (propios + dependientes) y luego consulta las membresías.

```typescript
export async function getUserMemberships(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    // Paso 1: Obtener beneficiario propio + beneficiarios de dependientes
    const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("dependents")
        .select("id, full_name, birth_date, category, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    // Paso 2: Recopilar todos los beneficiaryIds
    const beneficiaryIds = [
      ownBeneficiary.data?.id,
      ...(dependentsWithBeneficiary.data || []).map((d) => {
        const b = d.beneficiaries;
        if (!b) return undefined;
        return Array.isArray(b) ? b[0]?.id : b.id;
      }),
    ].filter(Boolean) as string[];

    if (beneficiaryIds.length === 0) {
      return {
        memberships: [] as MembershipData[],
        dependents: (dependentsWithBeneficiary.data || []) as DependentData[],
      };
    }

    // Paso 3: Consultar membresías con joins a plan, beneficiario y dependiente
    const { data: memberships } = await supabase
      .from("memberships")
      .select(`
        *,
        plan:membership_plans(id, name, price, duration_days, category, benefits),
        beneficiary:beneficiaries(
          id, profile_id, dependent_id,
          dependent:dependents(full_name, category)
        )
      `)
      .in("beneficiary_id", beneficiaryIds)
      .order("created_at", { ascending: false });

    return {
      memberships: (memberships || []) as MembershipData[],
      dependents: (dependentsWithBeneficiary.data || []) as DependentData[],
    };
  });
}
```

#### Asignación Manual de Membresía (Admin)

**Archivo**: `src/components/admin/AssignMembershipModal.tsx`

1. Seleccionar beneficiario
2. Seleccionar plan
3. Insertar en `memberships` con `status='activa'`
4. Insertar en `payments` con `method='transferencia'`, `status='pagado'`
5. Opcionalmente subir comprobante a `receipts/` en Storage

#### Compra vía Flow

Flujo completo descrito en la sección 4.3.

#### Deduplicación

10 minutos antes de crear, verifica existencia de membresía activa con mismo plan+beneficiario:

```typescript
const dedupWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const { data: existingMembership } = await supabase
  .from("memberships")
  .select("id")
  .eq("beneficiary_id", targetBeneficiaryId)
  .eq("plan_id", plan.id)
  .eq("status", "activa")
  .gte("created_at", dedupWindow)
  .maybeSingle();
```

### 4.3 Pagos (Integración Flow.cl)

#### Crear Orden — POST `/api/flow/create-order`

**Archivo**: `src/app/api/flow/create-order/route.ts`

```typescript
// 1. Verificar autenticación
const { data: { user } } = await supabase.auth.getUser();

// 2. Validar plan y beneficiario
const { data: plan } = await supabase
  .from("membership_plans")
  .select("id, name, price, duration_days, active")
  .eq("id", planId)
  .single();

// 3. Verificar propiedad del beneficiario
// (profile_id = user.id o dependent.tutor_id = user.id)

// 4. Reusar pago pendiente reciente (ventana 5 min)
const { data: existingPending } = await supabase
  .from("payments")
  .select("id, flow_token")
  .eq("user_id", user.id)
  .eq("status", "pendiente")
  .eq("method", "flow")
  .gte("created_at", fiveMinAgo)
  .maybeSingle();

// 5. Insertar pago pendiente
const { data: payment } = await supabase
  .from("payments")
  .insert({
    user_id: user.id,
    beneficiary_id: beneficiary.id,
    commerce_order: crypto.randomUUID(),
    concept: `Membresía ${plan.name}`,
    amount: plan.price,
    method: "flow",
    status: "pendiente",
  })
  .select("id")
  .single();

// 6. Llamar a la API de Flow con HMAC-SHA256
const flowResponse = await createFlowOrder({
  commerceOrder,
  subject: `Membresía ${plan.name} - ZONAELITE`,
  amount: plan.price,
  email: user.email || "",
  metadata: { paymentId: payment.id, planId: plan.id, beneficiaryId: beneficiary.id },
});

// 7. Guardar token de Flow en el pago
await supabase
  .from("payments")
  .update({ flow_token: flowResponse.token, flow_order: flowResponse.flowOrder })
  .eq("id", payment.id);
```

#### Confirmación Callback — POST `/api/flow/confirmation`

**Archivo**: `src/app/api/flow/confirmation/route.ts`

Utiliza `after()` de Next.js para procesamiento background:

```typescript
export async function POST(request: Request) {
  // Extraer token del body (JSON o form-urlencoded)
  const token = /* ... */;
  after(() => processInBackground(token)); // Background processing
  return new Response("OK", { status: 200 }); // Responder inmediatamente
}

async function processInBackground(token: string) {
  // 1. Buscar pago por flow_token (admin client bypasses RLS)
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, commerce_order, status, concept, flow_token, flow_order, beneficiary_id, membership_id")
    .eq("flow_token", token)
    .maybeSingle();

  // 2. Verificar con la API de Flow
  const verification = await verifyFlowPayment(token);
  if (verification.status !== 2) return; // Solo status 2 = aprobado

  // 3. Marcar pago como pagado
  await supabase
    .from("payments")
    .update({ status: "pagado", paid_at: new Date().toISOString(), flow_order })
    .eq("id", payment.id);

  // 4. Crear membresía (createMembershipDebug)
  await createMembershipDebug(supabase, payment);
}
```

#### Flujo de creación de membresía (`confirmAndCreateMembership`)

**Archivo**: `src/lib/flow-helpers.ts:21-135`

```typescript
export async function confirmAndCreateMembership(supabase, paymentId, userId) {
  // 1. Obtener pago completo
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, concept, membership_id, beneficiary_id")
    .eq("id", paymentId).single();

  // 2. Si ya tiene membresía, retornar
  if (payment.membership_id) return { success: true, membershipId: payment.membership_id };

  // 3. Extraer nombre del plan desde el concepto: "Membresía PlanName"
  const planName = extractPlanName(payment.concept);
  // Regex: /^Membres[íi]a\s+(.+)$/i

  // 4. Buscar plan por nombre
  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName).single();

  // 5. Resolver beneficiario (del pago o buscar propio)
  let targetBeneficiaryId = payment.beneficiary_id;
  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary } = await supabase
      .from("beneficiaries").select("id")
      .eq("profile_id", userId).maybeSingle();
    if (ownBeneficiary) targetBeneficiaryId = ownBeneficiary.id;
  }

  // 6. Deduplicación: ventana de 10 minutos
  const dedupWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("beneficiary_id", targetBeneficiaryId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .gte("created_at", dedupWindow)
    .maybeSingle();

  if (existingMembership) {
    // Linkear pago a membresía existente
    await supabase.from("payments").update({ membership_id: existingMembership.id }).eq("id", paymentId);
    return { success: true, membershipId: existingMembership.id };
  }

  // 7. Calcular fechas
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

  // 8. Crear membresía
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
    .select("id").single();

  // 9. Linkear pago a la nueva membresía
  await supabase.from("payments").update({ membership_id: membership.id }).eq("id", paymentId);
}
```

#### Verificar — GET `/api/flow/verify`

**Archivo**: `src/app/api/flow/verify/route.ts`

```typescript
// 1. Verificar autenticación
const { data: { user } } = await supabase.auth.getUser();

// 2. Buscar pago por token + user (admin client)
const payment = await findPaymentByTokenAndUser(admin, token, user.id);

// 3. Si ya está pagado, retornar
if (payment.status === "pagado") return NextResponse.json({ status: "pagado" });

// 4. Verificar con Flow API
const verification = await verifyFlowPayment(token);

if (verification.status === 2) { // Aprobado
  await markPaymentAsPaid(admin, payment.id, token, verification.flowOrder);
  await confirmAndCreateMembership(admin, payment.id, user.id);
  return NextResponse.json({ status: "pagado" });
}

if (verification.status === 4) { // Cancelado
  await admin.from("payments").update({ status: "cancelado" }).eq("id", payment.id);
  return NextResponse.json({ status: "cancelado" });
}
```

#### Forzar Confirmación — POST `/api/flow/force-confirm`

**Archivo**: `src/app/api/flow/force-confirm/route.ts`

Ruta de recuperación manual para pagos stuck. Flujo:
1. Buscar pago por token (admin client)
2. Si ya está pagado pero sin membresía → crear membresía
3. Si no está pagado → verificar con Flow API → si aprobado, confirmar y crear membresía

### 4.4 Horarios y Clases

#### Admin CRUD — `/admin/horarios`

**Archivo**: `src/app/admin/horarios/page.tsx`

Operaciones CRUD estándar en la tabla `schedules`:

```typescript
// Carga con joins
const [sRes, dRes, pRes, plRes] = await Promise.all([
  supabase.from("schedules")
    .select("*, disciplines(name, color_hex), profiles(full_name), class_plans(plan_id, membership_plans(name))")
    .order("day_of_week"),
  supabase.from("disciplines").select("id, name, color_hex, active").order("name"),
  supabase.from("profiles").select("id, full_name").order("full_name"),
  supabase.from("membership_plans").select("id, name, active").eq("active", true).order("name"),
]);

// Crear
const { data } = await supabase.from("schedules").insert(payload).select("id").single();

// Actualizar
await supabase.from("schedules").update(payload).eq("id", editing.id);

// Eliminar (cascade a class_plans, class_sessions, etc.)
await supabase.from("schedules").delete().eq("id", deleteTarget.id);
```

**Restricciones de plan**: Tabla `class_plans` (junction):
```typescript
// Limpiar planes anteriores del schedule
await supabase.from("class_plans").delete().eq("schedule_id", scheduleId);

// Insertar nuevos
if (selectedPlans.length > 0) {
  await supabase.from("class_plans").insert(
    selectedPlans.map((plan_id) => ({ schedule_id: scheduleId, plan_id }))
  );
}
```

#### Generación de Sesiones — POST `/api/admin/generate-sessions`

**Archivo**: `src/app/api/admin/generate-sessions/route.ts`

```typescript
const WEEKS_AHEAD = 4;

// 1. Obtener todos los horarios activos
const { data: activeSchedules } = await supabase
  .from("schedules")
  .select("id, day_of_week")
  .eq("active", true);

// 2. Generar fechas para las próximas 4 semanas
const sessionsToInsert: { schedule_id: string; session_date: string }[] = [];

for (const schedule of activeSchedules) {
  const current = new Date(today);
  while (current <= endDate) {
    if (current.getDay() === schedule.day_of_week) {
      sessionsToInsert.push({
        schedule_id: schedule.id,
        session_date: current.toISOString().split("T")[0],
      });
    }
    current.setDate(current.getDate() + 1);
  }
}

// 3. Insertar con ON CONFLICT para idempotencia
const { data } = await supabase
  .from("class_sessions")
  .upsert(sessionsToInsert, {
    onConflict: "schedule_id,session_date",
    ignoreDuplicates: true,
  })
  .select();
```

#### Calendario Público — `/horarios`

**Archivo**: `src/app/horarios/page.tsx`

```typescript
// 1. Cargar horarios activos con joins
const { data: schedules } = await supabase
  .from("schedules")
  .select("*, disciplines(name, color_hex, icon), profiles(full_name), class_plans(plan_id)")
  .eq("active", true)
  .order("start_time");

// 2. Para cada horario, contar inscripciones
for (const s of schedules) {
  const { count } = await supabase
    .from("class_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", s.id);

  // 3. Construir grilla: time → day → cell
  enriched[time][day] = {
    schedule: s,
    enrolled: count || 0,
    userEnrolled: false,
  };
}
```

### 4.5 Asistencia

#### Asistencia de Admin — `/admin/asistencia`

**Archivo**: `src/app/admin/asistencia/page.tsx` + `src/lib/supabase/dashboard.ts`

**Paso 1: Obtener sesiones próximas** — `getUpcomingSessions()`

```typescript
export async function getUpcomingSessions() {
  return safeQuery(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("class_sessions")
      .select(`
        *,
        schedule:schedules(
          id, day_of_week, start_time, end_time,
          discipline:disciplines(name),
          professor:profiles(full_name)
        )
      `)
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(30);

    return (data || []) as ClassSessionData[];
  });
}
```

**Paso 2: Obtener asistencia de sesión** — `getAttendanceForSession(sessionId)`

```typescript
export async function getAttendanceForSession(sessionId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    // 2a. Obtener asistencia existente
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .eq("session_id", sessionId);

    const attendanceByBeneficiary = new Map(
      (attendanceData || []).map((a) => [a.beneficiary_id, a])
    );

    // 2b. Obtener el schedule_id de la sesión
    const { data: session } = await supabase
      .from("class_sessions")
      .select("schedule_id")
      .eq("id", sessionId).single();

    // 2c. Obtener beneficiarios inscritos (por sesión O por schedule)
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("beneficiary_id")
      .or(`session_id.eq.${sessionId},schedule_id.eq.${session.schedule_id}`);

    const enrolledIds = [...new Set((enrollments || []).map((e) => e.beneficiary_id))];

    // 2d. Obtener datos de beneficiarios con membresía activa
    const { data: members } = await supabase
      .from("memberships")
      .select(`
        beneficiary_id,
        beneficiary:beneficiaries(
          id,
          dependent:dependents(full_name, category),
          profile:profiles(full_name)
        )
      `)
      .eq("status", "activa")
      .lte("start_date", today)
      .gte("end_date", today)
      .in("beneficiary_id", enrolledIds);

    // 2e. Construir mapa de beneficiarios con su estado de asistencia
    // ... (fallback para beneficiarios sin membresía activa)

    return {
      beneficiaries: Array.from(beneficiaryMap.values())
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    };
  });
}
```

**Paso 3: Marcar asistencia** — `markAttendance()`

```typescript
export async function markAttendance(
  sessionId: string,
  beneficiaryId: string,
  status: "presente" | "ausente" | "justificado",
  markedBy: string
) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("attendance")
      .upsert(
        {
          session_id: sessionId,
          beneficiary_id: beneficiaryId,
          status,
          marked_by: markedBy,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "session_id,beneficiary_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  });
}
```

**Inscripción desde admin** — INSERT en `class_enrollments`:
```typescript
const { error } = await supabase.from("class_enrollments").insert({
  session_id: enrollSessionId,
  beneficiary_id: beneficiaryId,
});
// Error code 23505 = unique violation (ya inscrito)
```

#### Historial de Asistencia del Usuario — `/dashboard/asistencia`

**Archivo**: `src/lib/supabase/dashboard.ts:581-648`

```typescript
export async function getUserAttendance(userId: string, limit = 50) {
  return safeQuery(async () => {
    const supabase = createClient();

    // 1. Obtener beneficiario propio + dependientes
    const [ownBeneficiary, dependentsWithBeneficiary] = await Promise.all([
      supabase.from("beneficiaries")
        .select("id, profile:profiles(full_name)")
        .eq("profile_id", userId).maybeSingle(),
      supabase.from("dependents")
        .select("full_name, beneficiaries(id)")
        .eq("tutor_id", userId),
    ]);

    // 2. Construir lista de IDs con nombres
    const beneficiaryIds: { id: string; name: string }[] = [];
    // ... (mapeo de own + dependents)

    // 3. Consultar asistencia con joins
    const { data } = await supabase
      .from("attendance")
      .select(`
        *,
        session:class_sessions(
          session_date,
          schedule:schedules(
            start_time, end_time,
            discipline:disciplines(name)
          )
        )
      `)
      .in("beneficiary_id", beneficiaryIds.map((b) => b.id))
      .order("marked_at", { ascending: false })
      .limit(limit);

    // 4. Agregar beneficiary_name desde el mapa local
    const records = (data || []).map((r) => ({
      ...r,
      beneficiary_name: nameMap.get(r.beneficiary_id) || "Desconocido",
    }));

    return { records };
  });
}
```

### 4.6 Inscripciones a Clases

#### EnrollModal — `/components/EnrollModal.tsx`

Validación en tiempo real para cada beneficiario:

```typescript
// Para cada beneficiario, se verifican 4 condiciones:

// 1. Coincidencia de categoría
if (schedule.category === "ninos" && planCategory !== "nino") {
  eligible = false;
  ineligibleReason = "Clase solo para niños";
}

// 2. Membresía activa
const { data: membership } = await supabase
  .from("memberships")
  .select("id, plan_id, membership_plans(name, category)")
  .eq("beneficiary_id", benId)
  .eq("status", "activa")
  .gte("end_date", today)
  .maybeSingle();
const membershipValid = !!membership;

// 3. Compatibilidad de plan (si class_plans tiene entries)
const classPlanIds = schedule.class_plans.map((cp) => cp.plan_id);
const planAllowed = classPlanIds.length === 0 || (planId && classPlanIds.includes(planId));

// 4. Ya inscrito
const { count } = await supabase
  .from("class_enrollments")
  .select("*", { count: "exact", head: true })
  .eq("schedule_id", schedule.id)
  .eq("beneficiary_id", benId);
const alreadyEnrolled = (count || 0) > 0;
```

**Inscripción (submit)**:
```typescript
const insertions = ids.map((bid) =>
  supabase.from("class_enrollments").insert({
    schedule_id: schedule.id,
    beneficiary_id: bid,
  })
);
const results = await Promise.all(insertions);
// Error code 23505 = unique violation (ya inscrito)
```

### 4.7 Productos

#### Admin CRUD — `/admin/productos`

**Archivo**: `src/app/admin/productos/page.tsx`

```typescript
// Carga con imágenes
const { data } = await supabase
  .from("products")
  .select("*, product_images(id, url, position)")
  .order("created_at", { ascending: false });

// Crear producto
const { data: newProduct } = await supabase
  .from("products").insert(form).select("id").single();

// Insertar imágenes (hasta 3)
if (newProduct) {
  const inserts = images
    .map((url, position) => url ? { product_id: newProduct.id, url, position } : null)
    .filter(Boolean);
  if (inserts.length > 0) await supabase.from("product_images").insert(inserts);
}

// Eliminar (cascade manual: imágenes primero, luego producto)
await supabase.from("product_images").delete().eq("product_id", deleteTarget.id);
await supabase.from("products").delete().eq("id", deleteTarget.id);
```

#### Catálogo Público — `/productos`

```typescript
supabase
  .from("products")
  .select("id, name, category, description, price, stock, product_images(url, position)")
  .eq("active", true)
  .order("name")
```

#### Detalle — `/productos/[id]`

```typescript
supabase
  .from("products")
  .select("*, product_images(id, url, position)")
  .eq("id", id)
  .eq("active", true)
  .single()
```

### 4.8 Eventos

#### Admin CRUD — `/admin/eventos`

Operaciones CRUD estándar en tabla `events` con campos: `type`, `title`, `description`, `image`, `location_name`, `location_url`, `event_date`, `extra`.

#### Listado Público — `/eventos`

```typescript
supabase
  .from("events")
  .select("*")
  .in("type", ["torneo", "graduacion"])
  .order("event_date", { ascending: true })
```

Filtros por tipo en el cliente: `torneo`, `graduacion`, `seminario`, `clase_especial`.

#### Detalle — `/eventos/[id]`

```typescript
supabase
  .from("events")
  .select("*")
  .eq("id", id)
  .single()
```

El campo `location_url` se convierte a iframe de Google Maps con `extractGoogleMapsEmbed()`.

### 4.9 Blog

#### Admin CRUD — `/admin/blog`

**Archivo**: `src/app/admin/blog/page.tsx`

Estados: `borrador`, `programado`, `publicado`

```typescript
// Crear (con author_id)
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("blog_posts").insert({
  ...payload,
  author_id: user?.id,
});

// Actualizar
await supabase.from("blog_posts").update(payload).eq("id", editing.id);
```

#### Feed Público — `/blog`

```typescript
supabase
  .from("blog_posts")
  .select("*, profiles:author_id(full_name, photo_url)")
  .eq("status", "publicado")
  .order("published_at", { ascending: false })
```

### 4.10 Notificaciones

#### Admin CRUD — `/admin/notificaciones`

**Tipos**: `aviso`, `recordatorio`, `comunicado`, `correo_masivo`
**Destinatarios**: `todos`, `segmento`

```typescript
// Carga con autor
const { data } = await supabase
  .from("notifications")
  .select("*, profiles:sent_by(full_name)")
  .order("created_at", { ascending: false });

// Crear
await supabase.from("notifications").insert({
  ...form,
  sent_by: profile?.id,
  sent_at: new Date().toISOString(),
});
```

#### Vista del Usuario — `/dashboard/notifications`

```typescript
// Paginación
const { data, count } = await supabase
  .from("notifications")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to);
```

### 4.11 Galería

#### Gestión Admin — `/admin/configuracion`

**Archivo**: `src/app/admin/configuracion/page.tsx`

```typescript
// Cargar imágenes
supabase
  .from("gallery_images")
  .select("*")
  .order("position")

// Agregar imagen
await supabase
  .from("gallery_images")
  .insert({ url, alt: newImageAlt, position: gallery.length, active: true })
  .select().single();

// Reordenar (swap positions)
const updates = newGallery.map((img, i) =>
  supabase.from("gallery_images").update({ position: i }).eq("id", img.id)
);
await Promise.all(updates);

// Toggle visibilidad
await supabase.from("gallery_images").update({ active }).eq("id", id);

// Eliminar
await supabase.from("gallery_images").delete().eq("id", id);
```

#### Display Público — `GalleryCarousel` en `/nosotros`

```typescript
supabase
  .from("gallery_images")
  .select("id, url, alt")
  .eq("active", true)
  .order("position")
```

Auto-play cada 5 segundos, navegación manual con flechas.

### 4.12 Registros Médicos

#### Obtener — `getMedicalRecord(beneficiaryId)`

**Archivo**: `src/lib/supabase/dashboard.ts:325-335`

```typescript
export async function getMedicalRecord(beneficiaryId: string) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("medical_records")
      .select("*")
      .eq("beneficiary_id", beneficiaryId)
      .maybeSingle();
    return data as MedicalRecord | null;
  });
}
```

#### Guardar — `upsertMedicalRecord(beneficiaryId, data)`

**Archivo**: `src/lib/supabase/dashboard.ts:337-361`

```typescript
export async function upsertMedicalRecord(beneficiaryId: string, record) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("medical_records")
      .upsert(
        { beneficiary_id: beneficiaryId, ...record },
        { onConflict: "beneficiary_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as MedicalRecord;
  });
}
```

**Campos**: `enfermedades`, `lesiones`, `medicamentos`, `alergias`, `contacto_emergencia_nombre`, `contacto_emergencia_telefono`

#### Uso en `/dashboard/cargas/[id]/medico`

Resuelve el `beneficiary_id` a través de `dependents` → `beneficiaries`, luego llama a `getMedicalRecord` / `upsertMedicalRecord`.

### 4.13 Configuración de Academia

**Tabla**: `academy_settings` (fila única)

#### Lectura

```typescript
supabase
  .from("academy_settings")
  .select("*")
  .limit(1)
  .single()
```

#### Actualización

```typescript
await supabase
  .from("academy_settings")
  .update({
    name: settings.name,
    logo_url: settings.logo_url,
    address: settings.address,
    whatsapp: settings.whatsapp,
    social_links: settings.social_links,
  })
  .eq("id", settings.id);
```

**Campos**: `name`, `logo_url`, `address`, `whatsapp`, `social_links` (JSONB: instagram, facebook, tiktok, youtube)

---

## 5. Storage (S3) - Interacción con Archivos

### Configuración

- **Bucket**: `"public"` (lectura pública)
- **Helper**: `src/lib/supabase/storage.ts`
- **Componente**: `ImageUpload` (admin)

### Funciones

| Función        | Descripción                                          |
|----------------|------------------------------------------------------|
| `uploadImage`  | Valida (5MB max, JPG/PNG/WebP/GIF), genera UUID path, sube, retorna URL pública |
| `deleteImage`  | Parsea URL para extraer path, elimina del bucket     |
| `getImagePath` | Extrae storage path desde URL pública                |

### Flujo de Upload

```
File → validateFile() → extFromMime() → crypto.randomUUID()
  → upload to {folder}/{uuid}.{ext} → getPublicUrl() → return URL
```

### Uso por Componente

| Módulo              | Folder        | Uso                                |
|---------------------|---------------|------------------------------------|
| Productos admin     | `products/`   | Imágenes de productos (max 3)     |
| Eventos admin       | `events/`     | Imagen del evento                  |
| Blog admin          | `blog/`       | Imagen de portada                  |
| Galería admin       | `gallery/`    | Imágenes del carrusel             |
| Configuración admin | `settings/`   | Logo de la academia                |
| Perfil usuario      | `profiles/`   | Foto de perfil (ImageUpload)      |
| Membresías admin    | `receipts/`   | Comprobantes de transferencia     |

---

## 6. Tablas y Columnas Principales

### `roles`

| Columna | Tipo    | Descripción                    |
|---------|---------|--------------------------------|
| id      | integer | PK                             |
| name    | text    | Nombre del rol                 |

**RLS**: 2 policies (SELECT público, ALL admin)

### `profiles`

| Columna     | Tipo        | Descripción                    |
|-------------|-------------|--------------------------------|
| id          | uuid        | PK, FK → auth.users            |
| role_id     | integer     | FK → roles (default: 4)        |
| full_name   | text        | Nombre completo                |
| email       | text        | Correo electrónico             |
| phone       | text        | Teléfono (nullable)            |
| birth_date  | date        | Fecha de nacimiento (nullable) |
| photo_url   | text        | URL foto (nullable)            |
| active      | boolean     | Activo (default: true)         |
| created_at  | timestamptz | Fecha creación                 |
| updated_at  | timestamptz | Última actualización (trigger) |

**RLS**: 3 policies (SELECT/UPDATE propio+admin, ALL admin)
**FK**: `role_id → roles(id)`
**Índices**: `email`, `role_id`

### `academy_settings`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| name          | text        | Nombre academia                |
| logo_url      | text        | Logo (nullable)                |
| address       | text        | Dirección (nullable)           |
| whatsapp      | text        | WhatsApp (nullable)            |
| social_links  | jsonb       | Links de redes sociales        |
| integrations  | jsonb       | Integraciones (nullable)       |
| updated_at    | timestamptz | Última actualización           |

**RLS**: 2 policies (SELECT público, ALL admin)

### `disciplines`

| Columna   | Tipo    | Descripción                    |
|-----------|---------|--------------------------------|
| id        | uuid    | PK                             |
| name      | text    | Nombre de la disciplina        |
| color_hex | text    | Color hex (default: '#000000') |
| description | text  | Descripción (nullable)         |
| active    | boolean | Activo (default: true)         |
| icon      | text    | Icono Material (default: 'sports_martial_arts') |

**RLS**: 2 policies (SELECT público, ALL admin)
**FK**: Ninguna

### `schedules`

| Columna      | Tipo        | Descripción                         |
|--------------|-------------|-------------------------------------|
| id           | uuid        | PK                                  |
| discipline_id | uuid       | FK → disciplines                    |
| professor_id | uuid        | FK → profiles                       |
| room         | text        | Sala (nullable)                     |
| day_of_week  | integer     | 0=Domingo ... 6=Sábado             |
| start_time   | time        | Hora inicio                         |
| end_time     | time        | Hora fin                            |
| capacity     | integer     | Cupos (default: 20)                 |
| category     | text        | 'ninos'/'adultos'/'ambos'           |
| active       | boolean     | Activo (default: true)              |
| description  | text        | Descripción (nullable)              |
| created_at   | timestamptz | Fecha creación                      |

**RLS**: 2 policies (SELECT público, ALL admin)
**FK**: `discipline_id → disciplines(id)`, `professor_id → profiles(id)`
**Índices**: `discipline_id`, `day_of_week`
**CHECK**: `category IN ('ninos', 'adultos', 'ambos')`

### `class_sessions`

| Columna     | Tipo        | Descripción                    |
|-------------|-------------|--------------------------------|
| id          | uuid        | PK                             |
| schedule_id | uuid        | FK → schedules                 |
| session_date | date       | Fecha de la sesión             |
| created_at  | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT público, ALL admin)
**FK**: `schedule_id → schedules(id)`
**Índices**: `schedule_id`, `session_date`
**UNIQUE**: `(schedule_id, session_date)` — usado en ON CONFLICT

### `class_plans`

| Columna     | Tipo | Descripción            |
|-------------|------|------------------------|
| id          | uuid | PK                     |
| schedule_id | uuid | FK → schedules         |
| plan_id     | uuid | FK → membership_plans  |

**RLS**: 2 policies (SELECT público, ALL admin)
**FK**: `schedule_id → schedules(id)`, `plan_id → membership_plans(id)`

### `class_enrollments`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| session_id    | uuid        | FK → class_sessions (nullable) |
| beneficiary_id | uuid       | FK → beneficiaries             |
| enrolled_at   | timestamptz | Fecha inscripción              |
| schedule_id   | uuid        | FK → schedules (nullable)      |

**RLS**: 3 policies (SELECT own+admin, INSERT/DELETE admin)
**FK**: `session_id → class_sessions(id)`, `beneficiary_id → beneficiaries(id)`, `schedule_id → schedules(id)`
**UNIQUE**: `(beneficiary_id, session_id)`, `(beneficiary_id, schedule_id)`
**Índices**: `session_id`, `beneficiary_id`, `schedule_id`

### `dependents`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| tutor_id   | uuid        | FK → profiles (padre/tutor)    |
| full_name  | text        | Nombre completo                |
| rut        | text        | RUT (nullable)                 |
| birth_date | date        | Fecha de nacimiento            |
| category   | text        | 'nino' o 'adulto'              |
| created_at | timestamptz | Fecha creación                 |
| updated_at | timestamptz | Última actualización (trigger) |

**RLS**: 4 policies (SELECT/INSERT/UPDATE/DELETE own+admin)
**FK**: `tutor_id → profiles(id)`
**Índices**: `tutor_id`

### `beneficiaries`

| Columna      | Tipo        | Descripción                    |
|--------------|-------------|--------------------------------|
| id           | uuid        | PK                             |
| profile_id   | uuid        | FK → profiles (nullable)       |
| dependent_id | uuid        | FK → dependents (nullable)     |
| created_at   | timestamptz | Fecha creación                 |

**RLS**: 1 policy (SELECT own+admin via `owns_beneficiary`)
**FK**: `profile_id → profiles(id)`, `dependent_id → dependents(id)`
**Índices**: `profile_id`, `dependent_id`

### `attendance`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| session_id    | uuid        | FK → class_sessions            |
| beneficiary_id | uuid       | FK → beneficiaries             |
| status        | text        | 'presente'/'ausente'/'justificado' |
| marked_by     | uuid        | FK → profiles (nullable)       |
| marked_at     | timestamptz | Fecha/hora marcación           |

**RLS**: 3 policies (SELECT own+admin, INSERT/UPDATE admin)
**FK**: `session_id → class_sessions(id)`, `beneficiary_id → beneficiaries(id)`, `marked_by → profiles(id)`
**UNIQUE**: `(session_id, beneficiary_id)` — usado en onConflict
**Índices**: `session_id`, `beneficiary_id`

### `membership_plans`

| Columna      | Tipo        | Descripción                    |
|--------------|-------------|--------------------------------|
| id           | uuid        | PK                             |
| name         | text        | Nombre del plan                |
| price        | numeric     | Precio                         |
| duration_days | integer    | Duración en días               |
| category     | text        | 'adulto' o 'nino'              |
| benefits     | jsonb       | Lista de beneficios            |
| active       | boolean     | Activo (default: true)         |
| created_at   | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT público, ALL admin)

### `memberships`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| beneficiary_id | uuid       | FK → beneficiaries             |
| plan_id       | uuid        | FK → membership_plans          |
| purchased_by  | uuid        | FK → profiles (comprador)      |
| start_date    | date        | Fecha inicio                   |
| end_date      | date        | Fecha vencimiento              |
| status        | text        | 'activa'/'vencida'/'cancelada'/'suspendida' |
| created_at    | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT own+admin, ALL admin)
**FK**: `beneficiary_id → beneficiaries(id)`, `plan_id → membership_plans(id)`, `purchased_by → profiles(id)`
**Índices**: `beneficiary_id`, `plan_id`, `status`

### `products`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| name       | text        | Nombre del producto            |
| category   | text        | Categoría (nullable)           |
| description | text       | Descripción (nullable)         |
| price      | numeric     | Precio                         |
| stock      | integer     | Stock (default: 0)             |
| active     | boolean     | Activo (default: true)         |
| created_at | timestamptz | Fecha creación                 |
| updated_at | timestamptz | Última actualización (trigger) |

**RLS**: 2 policies (SELECT público, ALL admin)

### `product_images`

| Columna    | Tipo | Descripción            |
|------------|------|------------------------|
| id         | uuid | PK                     |
| product_id | uuid | FK → products          |
| url        | text | URL de la imagen       |
| position   | integer | Orden (default: 0)  |

**RLS**: 2 policies (SELECT público, ALL admin)
**FK**: `product_id → products(id)`

### `product_orders`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| user_id    | uuid        | FK → profiles                  |
| status     | text        | 'borrador'/'pagado'/'enviado'/'entregado'/'cancelado' |
| total      | numeric     | Total (default: 0)             |
| created_at | timestamptz | Fecha creación                 |

**RLS**: 3 policies (SELECT/INSERT own, UPDATE admin)
**FK**: `user_id → profiles(id)`
**Índices**: `user_id`

### `order_items`

| Columna    | Tipo    | Descripción            |
|------------|---------|------------------------|
| id         | uuid    | PK                     |
| order_id   | uuid    | FK → product_orders    |
| product_id | uuid    | FK → products          |
| quantity   | integer | Cantidad               |
| unit_price | numeric | Precio unitario        |

**RLS**: 2 policies (SELECT/INSERT own+admin)
**FK**: `order_id → product_orders(id)`, `product_id → products(id)`
**Índices**: `order_id`

### `payments`

| Columna        | Tipo        | Descripción                    |
|----------------|-------------|--------------------------------|
| id             | uuid        | PK                             |
| user_id        | uuid        | FK → profiles                  |
| membership_id  | uuid        | FK → memberships (nullable)    |
| order_id       | uuid        | FK → product_orders (nullable) |
| concept        | text        | Concepto del pago              |
| amount         | numeric     | Monto                          |
| method         | text        | Método de pago                 |
| status         | text        | 'pendiente'/'pagado'/'fallido'/'reembolsado' |
| receipt_url    | text        | URL comprobante (nullable)     |
| paid_at        | timestamptz | Fecha de pago (nullable)       |
| created_at     | timestamptz | Fecha creación                 |
| commerce_order | text        | Orden de comercio (nullable)   |
| flow_token     | text        | Token de Flow (nullable)       |
| flow_order     | bigint      | Orden de Flow (nullable)       |
| beneficiary_id | uuid        | FK → beneficiaries (nullable)  |

**RLS**: 3 policies (SELECT own, INSERT/UPDATE admin)
**FK**: `user_id → profiles(id)`, `membership_id → memberships(id)`, `order_id → product_orders(id)`, `beneficiary_id → beneficiaries(id)`
**Índices**: `user_id`, `status`, `flow_token`

### `events`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| type          | text        | Tipo de evento                 |
| title         | text        | Título                         |
| description   | text        | Descripción (nullable)         |
| image         | text        | URL imagen (nullable)          |
| location_name | text        | Nombre ubicación (nullable)    |
| location_lat  | numeric     | Latitud (nullable)             |
| location_lng  | numeric     | Longitud (nullable)            |
| event_date    | date        | Fecha del evento               |
| extra         | jsonb       | Datos extra (nullable)         |
| created_at    | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT público, ALL admin)
**Índices**: `event_date`

### `blog_posts`

| Columna      | Tipo        | Descripción                    |
|--------------|-------------|--------------------------------|
| id           | uuid        | PK                             |
| title        | text        | Título                         |
| slug         | text        | Slug URL-riendly               |
| content      | text        | Contenido                      |
| cover_image  | text        | URL imagen portada (nullable)  |
| gallery      | jsonb       | URLs de galería (nullable)     |
| author_id    | uuid        | FK → profiles                  |
| status       | text        | 'borrador'/'publicado'/'programado' |
| published_at | timestamptz | Fecha publicación (nullable)   |
| scheduled_at | timestamptz | Programado para (nullable)     |
| created_at   | timestamptz | Fecha creación                 |
| updated_at   | timestamptz | Última actualización (trigger) |

**RLS**: 2 policies (SELECT publicado+admin, ALL admin)
**FK**: `author_id → profiles(id)`
**Índices**: `slug`, `status`

### `notifications`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| type       | text        | Tipo de notificación           |
| subject    | text        | Asunto                         |
| content    | text        | Contenido                      |
| target     | text        | 'todos'/'segmento'             |
| sent_by    | uuid        | FK → profiles                  |
| sent_at    | timestamptz | Fecha envío (nullable)         |
| created_at | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT todos+admin, ALL admin)
**FK**: `sent_by → profiles(id)`
**Índices**: `target`

### `audit_logs`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| user_id    | uuid        | FK → profiles (nullable)       |
| action     | text        | Acción realizada               |
| entity     | text        | Entidad afectada               |
| entity_id  | uuid        | ID de la entidad (nullable)    |
| metadata   | jsonb       | Datos adicionales (nullable)   |
| created_at | timestamptz | Fecha del log                  |

**RLS**: 1 policy (SELECT admin)
**FK**: `user_id → profiles(id)`
**Índices**: `user_id`, `entity`

### `gallery_images`

| Columna    | Tipo        | Descripción                    |
|------------|-------------|--------------------------------|
| id         | uuid        | PK                             |
| url        | text        | URL de la imagen               |
| alt        | text        | Texto alternativo (default: '') |
| position   | integer     | Orden (default: 0)             |
| active     | boolean     | Visible (default: true)        |
| created_at | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT público, ALL admin)
**Índices**: `position`, `active`

### `consent_forms`

| Columna       | Tipo        | Descripción                    |
|---------------|-------------|--------------------------------|
| id            | uuid        | PK                             |
| beneficiary_id | uuid       | FK → beneficiaries             |
| data          | jsonb       | Datos del consentimiento       |
| pdf_url       | text        | URL del PDF (nullable)         |
| signed_at     | timestamptz | Fecha firma                    |
| created_at    | timestamptz | Fecha creación                 |

**RLS**: 2 policies (SELECT/INSERT own+admin)
**FK**: `beneficiary_id → beneficiaries(id)`
**Índices**: `beneficiary_id`

### `body_metrics`

| Columna        | Tipo        | Descripción                    |
|----------------|-------------|--------------------------------|
| id             | uuid        | PK                             |
| beneficiary_id | uuid        | FK → beneficiaries             |
| recorded_at    | date        | Fecha registro (default: hoy)  |
| weight_kg      | numeric     | Peso en kg (nullable)          |
| height_cm      | numeric     | Altura en cm (nullable)        |
| bmi            | numeric     | IMC (nullable)                 |
| muscle_mass_pct | numeric    | % masa muscular (nullable)     |
| body_fat_pct   | numeric     | % grasa corporal (nullable)    |
| created_at     | timestamptz | Fecha creación                 |

**RLS**: 3 policies (SELECT own+admin, INSERT/UPDATE admin)
**FK**: `beneficiary_id → beneficiaries(id)`
**Índices**: `beneficiary_id`

### `medical_records`

| Columna                    | Tipo        | Descripción                    |
|----------------------------|-------------|--------------------------------|
| id                         | uuid        | PK                             |
| beneficiary_id             | uuid        | FK → beneficiarios             |
| enfermedades               | text        | Enfermedades (nullable)        |
| lesiones                   | text        | Lesiones (nullable)            |
| medicamentos               | text        | Medicamentos (nullable)        |
| alergias                   | text        | Alergias (nullable)            |
| contacto_emergencia_nombre | text        | Contacto emergencia (nullable) |
| contacto_emergencia_telefono | text      | Tel emergencia (nullable)      |
| updated_at                 | timestamptz | Última actualización (trigger) |

**RLS**: 3 policies (SELECT own+admin, INSERT/UPDATE admin)
**FK**: `beneficiary_id → beneficiaries(id)`
**Índices**: `beneficiary_id`
**UNIQUE implícito**: `(beneficiary_id)` — usado en onConflict

---

## 7. Queries Más Complejas Explicadas

### 7.1 `getUserMemberships` — Resolución multi-paso de beneficiarios

**Ubicación**: `src/lib/supabase/dashboard.ts:98-152`

**Problema**: Un usuario puede tener membresías para sí mismo Y para sus cargas (dependientes). Cada carga tiene su propio `beneficiary_id` a través de la tabla intermedia `beneficiaries`.

**Flujo**:
1. `Promise.all` paralelo: query a `beneficiaries` (propios) + `dependents` (cargas con beneficiarios anidados)
2. Recopilar todos los `beneficiaryIds` en un solo array, manejando el caso de que `beneficiaries` puede ser objeto único o array
3. Query a `memberships` con `IN` sobre todos los IDs, con joins anidados a `membership_plans` → `beneficiaries` → `dependents`

**Nota técnica**: El cast `as unknown as { id: string }[] | { id: string } | null` es necesario porque Supabase PostgREST puede retornar un objeto solo o un array dependiendo de la cardinalidad de la relación.

### 7.2 `getAttendanceForSession` — Filtrado por inscripciones

**Ubicación**: `src/lib/supabase/dashboard.ts:421-519`

**Problema**: Determinar qué beneficiarios mostrar para una sesión específica, considerando que pueden estar inscritos por sesión individual O por schedule general.

**Flujo**:
1. Cargar asistencia existente → mapa por `beneficiary_id`
2. Obtener `schedule_id` de la sesión
3. Query con `.or()` en `class_enrollments`: `session_id.eq.{sessionId},schedule_id.eq.{scheduleId}`
4. Deduplicar IDs de beneficiarios con `Set`
5. Cargar membresías activas de esos beneficiarios (con joins a `beneficiaries` → `dependents`/`profiles`)
6. Fallback: para beneficiarios sin membresía activa, cargar directo desde `beneficiaries`
7. Construir lista final ordenada alfabéticamente

### 7.3 `getUserAttendance` — Historial propio + dependientes

**Ubicación**: `src/lib/supabase/dashboard.ts:581-648`

**Flujo**:
1. Misma resolución de beneficiarios que `getUserMemberships`
2. Construir `{ id, name }[]` con mapeo de nombres (propios vs dependientes)
3. Query a `attendance` con `IN` sobre todos los IDs, con joins: `class_sessions` → `schedules` → `disciplines`
4. Agregar `beneficiary_name` desde el mapa local (no se resuelve con query adicional)

### 7.4 Construcción del Grilla de Horarios

**Ubicación**: `src/app/horarios/page.tsx`

**Problema**: Convertir una lista plana de horarios en una grilla visual de tiempo × día.

**Flujo**:
1. Cargar todos los `schedules` activos con joins a `disciplines`, `profiles`, `class_plans`
2. Para cada schedule, contar inscripciones con count exact
3. Construir `Record<time, Record<day, ScheduleCell>>`
4. Extraer todos los tiempos únicos → ordenar → usar como filas
5. Días 1-6 (Lun-Sáb) como columnas
6. Cada celda contiene: schedule info, count de inscritos, flag de si el usuario está inscrito

### 7.5 Generación Idempotente de Sesiones

**Ubicación**: `src/app/api/admin/generate-sessions/route.ts`

**Problema**: Generar sesiones de clase para las próximas 4 semanas sin duplicar las existentes.

**Solución**:
1. Query de horarios activos
2. Para cada horario, calcular fechas que coincidan con `day_of_week` (usando `getDay()`)
3. Batch insert con `upsert` + `onConflict: "schedule_id,session_date"` + `ignoreDuplicates: true`
4. Retorna count de sesiones efectivamente creadas

### 7.6 Confirmación de Pago Flow → Membresía con Dedup

**Ubicación**: `src/app/api/flow/confirmation/route.ts` + `src/lib/flow-helpers.ts`

**Problema**: Flow puede enviar el callback múltiples veces. La membresía solo debe crearse una vez.

**Flujo** (en `confirmAndCreateMembership`):
1. Verificar si el pago ya tiene `membership_id` → si sí, retornar existente
2. Extraer nombre del plan del campo `concept` con regex: `^Membres[íi]a\s+(.+)$`
3. Buscar plan por nombre con `ilike`
4. Resolver beneficiario (del pago o buscar propio)
5. **Dedup**: buscar membresía activa con mismo `beneficiary_id` + `plan_id` en ventana de 10 minutos
6. Si existe → linkear pago a membresía existente
7. Si no → crear nueva membresía con fechas calculadas (`start_date = hoy`, `end_date = hoy + duration_days`)
8. Linkear pago a la nueva membresía

---

## 8. Patrones de Error Handling

### 8.1 `safeQuery()` Wrapper

**Archivo**: `src/lib/supabase/dashboard.ts:3-15`

```typescript
type SupabaseResult<T> = { data: T | null; error: string | null };

async function safeQuery<T>(
  queryFn: () => Promise<T>
): Promise<SupabaseResult<T>> {
  try {
    const data = await queryFn();
    return { data, error: null };
  } catch (e) {
    console.error("Supabase query error:", e);
    return { data: null, error: "Error al cargar datos. Intenta de nuevo." };
  }
}
```

Todas las funciones de dashboard (`getUserMemberships`, `getUserPayments`, `getUserAttendance`, `getMedicalRecord`, etc.) usan este wrapper para capturar errores de Supabase y retorna mensajes amigables al usuario.

### 8.2 `maybeSingle()` vs `single()`

| Método        | Uso                                              | Error si 0 resultados |
|---------------|--------------------------------------------------|-----------------------|
| `single()`    | Espera exactamente 1 resultado                   | Error (PGRST116)      |
| `maybeSingle()` | Espera 0 o 1 resultado (retorna null si 0)     | No error              |

**Uso en el código**:
- `maybeSingle()`: queries donde el resultado puede no existir (beneficiary own, membership, payment)
- `single()`: queries donde se garantiza la existencia (profile por auth.uid, schedule por id)

### 8.3 Manejo de Errores por Nivel

| Nivel              | Estrategia                                                  |
|--------------------|-------------------------------------------------------------|
| API Routes         | `console.error` + response JSON con `{ error: "mensaje" }`  |
| Dashboard queries  | `safeQuery()` retorna `{ data, error }`                     |
| Componentes        | Toast notifications para feedback visual                    |
| Auth               | `friendlyError()` traduce errores de Supabase a mensajes en español |
| Flow callbacks     | `after()` + try/catch en cada paso con logs detallados      |

### 8.4 Errores de Auth Amigables

**Archivo**: `src/lib/supabase/auth.ts:4-20`

```typescript
function friendlyError(error: AuthError | unknown): string {
  const msg = error.message ?? String(error);

  if (msg.includes("Invalid login")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "Cuenta no confirmada. Revisa tu correo.";
  if (msg.includes("User already registered")) return "Este correo ya está registrado.";
  if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("Unable to validate email address")) return "Ingresa un correo válido.";
  if (msg.includes("signup_disabled")) return "El registro está deshabilitado temporalmente.";
  if (msg.includes("over_request_rate_limit")) return "Demasiadas solicitudes. Intenta en unos minutos.";
  if (msg.includes("database")) return "Error de base de datos. Contacta al administrador.";

  return msg || "Ha ocurrido un error. Intenta nuevamente.";
}
```

### 8.5 Manejo de Unique Violations (PostgreSQL code 23505)

En inscripciones a clases, se usa el código de error de PostgreSQL para detectar duplicados:

```typescript
if (error.code === "23505") {
  showToast("Ya está inscrito en esta sesión", "error");
}
```

### 8.6 Logging Detallado en Flow

Los callbacks de Flow usan prefijos consistentes para logging:

```typescript
const FLOW_LOG_PREFIX = "[flow]";
const L = `${FLOW_LOG_PREFIX}/confirmation`;  // [flow]/confirmation
```

Cada paso se numera: `[1/7]`, `[2/7]`, etc., facilitando el troubleshooting en logs de Vercel.
