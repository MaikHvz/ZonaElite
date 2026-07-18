# Plan de Implementación — Dashboard del Usuario (Alumno)

> **Archivo**: `true-project-context/USER-DASHBOARD-PLAN.md`  
> **Estado**: Propuesta de diseño e implementación  
> **Objetivo**: Rediseñar `/dashboard` y `/perfil` para que el usuario (alumno) vea toda su información relevante: membresías, pagos, cargas (dependientes), asistencia, notificaciones y horarios.

---

## 1. Diagnóstico Actual

### Estado de `/dashboard` (actual)
- Solo muestra un saludo "Bienvenido, {nombre}" y 3 cards con links estáticos (Horarios, Mi Perfil, Sobre Nosotros)
- **No muestra datos reales** del usuario: ni membresías, ni pagos, ni cargas, ni asistencia
- Es básicamente una página placeholder

### Estado de `/perfil` (actual)
- Muestra datos básicos: nombre, email, teléfono, estado de verificación, fecha de registro
- Botón de cerrar sesión
- **No permite editar** la información personal
- No muestra cargas/dependientes

### Problema
El usuario que inicia sesión no tiene visibilidad de su estado en la academia: no sabe si su membresía está activa, cuándo vence, qué pagos ha realizado, quiénes son sus cargas inscritas, ni su historial de asistencia.

---

## 2. Arquitectura de Rutas Propuesta

### Dashboard con navegación por tabs/secciones

Mantener rutas propias del dashboard con sub-navegación interna:

| Ruta | Contenido |
|---|---|
| `/dashboard` | Vista general: resumen de membresías, alertas, accesos rápidos, preview notificaciones |
| `/dashboard/membresias` | Detalle de todas las membresías (propias y de cargas) |
| `/dashboard/pagos` | Historial completo de pagos |
| `/dashboard/cargas` | Gestión de dependientes/cargas (lectura) |
| `/dashboard/notificaciones` | Historial de notificaciones recibidas |
| `/dashboard/asistencia` | Historial de asistencia (futuro — Módulo 4) |
| `/perfil` | Información personal editable + cambio de contraseña |

### Layout del Dashboard

Crear `src/app/dashboard/layout.tsx` con tabs de navegación propias del usuario. A diferencia del admin (que tiene sidebar), el dashboard del alumno usa **tabs horizontales** integradas al diseño de la landing.

---

## 3. Diseño Visual — Línea de Diseño ZonaElite

### Principios de diseño a seguir
- **Fondo**: `--color-background` (#131313)
- **Cards**: `--color-surface-container` (#201f1f) con `border: 1px solid rgba(229,226,225,0.05)`
- **Bordes hover**: `border-primary/30` en transición
- **Tipografía**: Anton (títulos), Hanken Grotesk (body), JetBrains Mono (labels/badges)
- **Acentos**: `--color-primary` (#ffb4ac) y `--color-primary-container` (#ff544c)
- **Glass panels**: `.glass-panel` para secciones destacadas
- **Animaciones**: `.fade-up` para entrada de secciones
- **Iconos**: Material Symbols Outlined

### No seguir patrón Admin
El dashboard del usuario NO debe parecer un panel de administración. Debe sentirse como una extensión de la landing page: oscuro, premium, con el mismo lenguaje visual de cards con bordes sutiles, gradientes y tipografía Anton.

---

## 4. Maquetación por Sección

### 4.1. Dashboard Principal (`/dashboard`)

```
┌────────────────────────────────────────────────────────────────┐
│  Navbar (ya existente, global)                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  BIENVENIDO, {NOMBRE}                                     │  │
│  │  Tu zona de entrenamiento                                 │  │
│  │  [Tabs: Resumen | Membresías | Pagos | Cargas]           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ALERTA ──────────────────────────────────────────────┐    │
│  │  ⚠ Tu membresía "Plan Adulto" vence en 5 días          │    │
│  │  [Renovar]                                               │    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ STAT CARDS (2-3 columnas) ───────────────────────────┐    │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐          │    │
│  │ │ 🎫          │ │ 💳          │ │ 👥          │          │    │
│  │ │ Membresías  │ │ Pagos      │ │ Cargas     │          │    │
│  │ │ 2 activas   │ │ $45.000    │ │ 1          │          │    │
│  │ └────────────┘ └────────────┘ └────────────┘          │    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ MIS MEMBRESÍAS (preview) ────────────────────────────┐    │
│  │ ┌──────────────────────────────────────────┐            │    │
│  │ │ Plan Kenpo Adulto         ACTIVA ✅       │            │    │
│  │ │ Beneficiario: Yo                          │            │    │
│  │ │ 15 jul 2026 → 15 ago 2026                │            │    │
│  │ │ ████████████████████░░  78% transcurrido  │            │    │
│  │ └──────────────────────────────────────────┘            │    │
│  │ ┌──────────────────────────────────────────┐            │    │
│  │ │ Plan Kids                ACTIVA ✅        │            │    │
│  │ │ Beneficiario: Lucas (carga)              │            │    │
│  │ │ 01 jul 2026 → 01 ago 2026                │            │    │
│  │ │ ███████████████░░░░░░░  52% transcurrido  │            │    │
│  │ └──────────────────────────────────────────┘            │    │
│  │                     [Ver todas →]                       │    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ÚLTIMOS PAGOS (preview) ─────────────────────────────┐    │
│  │  📅 15 jul 2026 │ Plan Kenpo Adulto │ $35.000 │ Pagado ✅│    │
│  │  📅 01 jul 2026 │ Plan Kids          │ $25.000 │ Pagado ✅│    │
│  │                     [Ver historial →]                    │    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ACCESOS RÁPIDOS ─────────────────────────────────────┐    │
│  │ [📅 Horarios] [👤 Mi Perfil] [📦 Tienda] [📢 Eventos]│    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ ÚLTIMAS NOTIFICACIONES (preview) ────────────────────┐    │
│  │  📢 Recordatorio: Clase especial sábado 19 jul         │    │
│  │  📋 Comunicado: Nuevos horarios de verano               │    │
│  │                     [Ver todas →]                        │    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Footer (ya existente, global)                                  │
└────────────────────────────────────────────────────────────────┘
```

### 4.2. Membresías (`/dashboard/membresias`)

```
┌──────────────────────────────────────────────────────────────┐
│  MIS MEMBRESÍAS                                               │
│                                                                │
│  ┌─ Filtros ─────────────────────────────────────────────┐  │
│  │ [Todas] [Activas] [Vencidas] [Canceladas]              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ── Mis membresías ──────────────────────────────────────── │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Plan Kenpo Adulto                                     │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │ Estado:     ACTIVA                              │    │    │
│  │  │ Plan:       Kenpo Adulto ($35.000)             │    │    │
│  │  │ Inicio:     15 julio 2026                      │    │    │
│  │  │ Vence:      15 agosto 2026                     │    │    │
│  │  │ Días rest.: 29 días                            │    │    │
│  │  │ ████████████████░░░░░  78%                     │    │    │
│  │  └────────────────────────────────────────────────┘    │    │
│  │  Beneficios: ✅ Acceso ilimitado ✅ Equipo incluido    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ── Membresías de mis cargas ────────────────────────────── │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Plan Kids — Lucas Pérez (carga)                      │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │ Estado:     ACTIVA                              │    │    │
│  │  │ Plan:       Kids ($25.000)                     │    │    │
│  │  │ Inicio:     01 julio 2026                      │    │    │
│  │  │ Vence:      01 agosto 2026                     │    │    │
│  │  │ Días rest.: 15 días                            │    │    │
│  │  │ ████████████░░░░░░░░  52%                      │    │    │
│  │  └────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌─ Sin membresía activa? ───────────────────────────────┐  │
│  │  ¿Quieres inscribirte? Revisa nuestros planes         │  │
│  │  [Ver planes de membresía →]                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.3. Pagos (`/dashboard/pagos`)

```
┌──────────────────────────────────────────────────────────────┐
│  MIS PAGOS                                                    │
│                                                                │
│  ┌─ Resumen ─────────────────────────────────────────────┐  │
│  │ Total pagado: $120.000  │  Pagos este mes: $35.000     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Historial ───────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ┌────────┬────────────────┬─────────┬────────────┐   │  │
│  │  │ Fecha  │ Concepto       │ Monto   │ Estado     │   │  │
│  │  ├────────┼────────────────┼─────────┼────────────┤   │  │
│  │  │ 15 jul │ Plan Kenpo     │ $35.000 │ ✅ Pagado  │   │  │
│  │  │ 01 jul │ Plan Kids      │ $25.000 │ ✅ Pagado  │   │  │
│  │  │ 15 jun │ Plan Kenpo     │ $35.000 │ ✅ Pagado  │   │  │
│  │  │ 01 jun │ Plan Kids      │ $25.000 │ ✅ Pagado  │   │  │
│  │  └────────┴────────────────┴─────────┴────────────┘   │  │
│  │                                                        │  │
│  │  [← Anterior]                    [Siguiente →]        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Comprobantes ────────────────────────────────────────┐  │
│  │  Los comprobantes de pago están disponibles para       │  │
│  │  descargar en cada registro de pago con recibo.        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.4. Cargas / Dependientes (`/dashboard/cargas`)

```
┌──────────────────────────────────────────────────────────────┐
│  MIS CARGAS                                                   │
│                                                                │
│  Personas que has inscrito como tus dependientes.             │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  👤 Lucas Pérez                                       │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │ Categoría:  Niño                                │    │    │
│  │  │ Nacimiento: 12 marzo 2018 (8 años)             │    │    │
│  │  │ RUT:        21.543.876-K                       │    │    │
│  │  │ Membresía:  Plan Kids (activa, vence 01 ago)   │    │    │
│  │  └────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  👤 Sofía Pérez                                       │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │ Categoría:  Niño                                │    │    │
│  │  │ Nacimiento: 05 enero 2020 (6 años)             │    │    │
│  │  │ RUT:        22.876.543-1                       │    │    │
│  │  │ Membresía:  Sin membresía activa ⚠️            │    │    │
│  │  └────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ℹ️ Para agregar o modificar cargas, contacta a la academia. │
└──────────────────────────────────────────────────────────────┘
```

### 4.5. Notificaciones (`/dashboard/notificaciones`)

```
┌──────────────────────────────────────────────────────────────┐
│  MIS NOTIFICACIONES                                           │
│                                                                │
│  ┌─ Filtros ─────────────────────────────────────────────┐  │
│  │ [Todas] [Avisos] [Recordatorios] [Comunicados]         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  📋 Comunicado                                         │    │
│  │  Nuevos horarios de verano                             │    │
│  │  Se han actualizado los horarios para la temporada...  │    │
│  │  15 jul 2026                                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  📢 Recordatorio                                       │    │
│  │  Clase especial de Kenpo                               │    │
│  │  Este sábado 19 de julio habrá una clase especial...   │    │
│  │  14 jul 2026                                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌─ Sin notificaciones ─────────────────────────────────┐    │
│  │  No tienes notificaciones nuevas                      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 4.6. Perfil Editable (`/perfil`)

```
┌──────────────────────────────────────────────────────────────┐
│  MI PERFIL                                                    │
│                                                                │
│  ┌─ Avatar + Info ───────────────────────────────────────┐  │
│  │  [🔴]  NOMBRE COMPLETO                                │  │
│  │        email@ejemplo.com                               │  │
│  │        Miembro desde julio 2026                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Información Personal ────────────────────────────────┐  │
│  │                                                        │  │
│  │  Nombre:      [__________________________] ✏️          │  │
│  │  Teléfono:    [__________________________] ✏️          │  │
│  │  Nacimiento:  [__________________________] ✏️          │  │
│  │                                                        │  │
│  │  [Guardar cambios]                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Seguridad ───────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Email:       email@ejemplo.com  ✅ Verificado         │  │
│  │  Contraseña:  ••••••••••  [Cambiar contraseña]        │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  [🔴 Cerrar Sesión]                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Estructura de Archivos

### Nuevos archivos a crear

```
src/
├── app/
│   └── dashboard/
│       ├── layout.tsx           ← [NEW] Layout con navegación interna
│       ├── page.tsx             ← [MODIFY] Resumen principal rediseñado
│       ├── membresias/
│       │   └── page.tsx         ← [NEW] Mis membresías completo
│       ├── pagos/
│       │   └── page.tsx         ← [NEW] Historial de pagos
│       ├── cargas/
│       │   └── page.tsx         ← [NEW] Mis dependientes
│       └── notificaciones/
│           └── page.tsx         ← [NEW] Historial de notificaciones
├── components/
│   └── dashboard/               ← [NEW] Carpeta de componentes del usuario
│       ├── DashboardNav.tsx     ← [NEW] Navegación tabs/links del dashboard
│       ├── MembershipCard.tsx   ← [NEW] Card de membresía con barra de progreso
│       ├── PaymentRow.tsx       ← [NEW] Fila de pago en historial
│       ├── DependentCard.tsx    ← [NEW] Card de dependiente
│       ├── AlertBanner.tsx      ← [NEW] Banner de alertas (vencimiento, etc.)
│       ├── QuickStats.tsx       ← [NEW] Cards de estadísticas rápidas
│       ├── NotificationItem.tsx ← [NEW] Fila de notificación
│       └── DashboardSkeleton.tsx← [NEW] Loading skeletons para cada sección
├── lib/
│   └── supabase/
│       └── dashboard.ts         ← [NEW] Queries de datos del usuario
└── perfil/
    └── page.tsx                 ← [MODIFY] Perfil editable
```

### Archivos existentes a modificar

| Archivo | Cambio |
|---|---|
| `src/app/dashboard/page.tsx` | Reescribir completo: de placeholder a resumen real |
| `src/app/perfil/page.tsx` | Agregar edición de campos + cambio de contraseña |
| `src/components/Navbar.tsx` | Agregar link "Mi Panel" al menú cuando hay sesión |

---

## 6. Queries a Supabase (`src/lib/supabase/dashboard.ts`)

### Wrapper de manejo de errores

```typescript
import { createClient } from "@/lib/supabase/client";

type SupabaseResult<T> = { data: T | null; error: string | null };

async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>
): Promise<SupabaseResult<T>> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.error("Supabase query error:", error);
      return { data: null, error: "Error al cargar datos. Intenta de nuevo." };
    }
    return { data, error: null };
  } catch (e) {
    console.error("Supabase connection error:", e);
    return { data: null, error: "Error de conexión. Verifica tu internet." };
  }
}
```

### Obtener membresías del usuario (simplificada)

```typescript
// Membresías propias + de sus cargas
// Usa purchased_by para simplificar (evita 3-step join)
export async function getUserMemberships(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    // 1. Obtener todos los beneficiary_ids del usuario y sus cargas
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

    const beneficiaryIds = [
      ownBeneficiary.data?.id,
      ...(dependentsWithBeneficiary.data || []).map(d => d.beneficiaries?.[0]?.id)
    ].filter(Boolean);

    if (beneficiaryIds.length === 0) {
      return { memberships: [], dependents: dependentsWithBeneficiary.data || [] };
    }

    // 2. Obtener membresías en una sola query
    const { data: memberships } = await supabase
      .from("memberships")
      .select(`
        *,
        plan:membership_plans(*),
        beneficiary:beneficiaries(
          id,
          profile_id,
          dependent_id,
          dependent:dependents(full_name, category)
        )
      `)
      .in("beneficiary_id", beneficiaryIds)
      .order("created_at", { ascending: false });

    return {
      memberships: memberships || [],
      dependents: dependentsWithBeneficiary.data || []
    };
  });
}
```

### Obtener pagos del usuario

```typescript
export async function getUserPayments(userId: string, page = 0, pageSize = 20) {
  return safeQuery(async () => {
    const supabase = createClient();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from("payments")
      .select(`
        *,
        membership:memberships(
          plan:membership_plans(name)
        )
      `, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    return { payments: data || [], total: count || 0 };
  });
}
```

### Obtener dependientes del usuario

```typescript
export async function getUserDependents(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("dependents")
      .select(`
        *,
        beneficiaries(
          id,
          memberships(
            status,
            end_date,
            plan:membership_plans(name, price)
          )
        )
      `)
      .eq("tutor_id", userId)
      .order("full_name");

    return data || [];
  });
}
```

### Obtener notificaciones del usuario

```typescript
export async function getUserNotifications(page = 0, pageSize = 20) {
  return safeQuery(async () => {
    const supabase = createClient();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    return { notifications: data || [], total: count || 0 };
  });
}
```

### Datos del resumen (dashboard principal) — CORREGIDO

```typescript
export async function getDashboardSummary(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();

    // Queries paralelas
    const [membershipsRes, paymentsRes, dependentsRes, thisMonthRes] = await Promise.all([
      // Membresías propias + cargas
      getUserMemberships(userId),
      // Últimos 3 pagos
      supabase
        .from("payments")
        .select("*, membership:memberships(plan:membership_plans(name))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3),
      // Cantidad de dependientes
      supabase
        .from("dependents")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", userId),
      // Pagos de este mes (para el stat card)
      supabase
        .from("payments")
        .select("amount")
        .eq("user_id", userId)
        .eq("status", "pagado")
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const activeMemberships = (membershipsRes.data?.memberships || [])
      .filter(m => m.status === "activa");

    // CORREGIDO: Calcular total pagado de este mes (no histórico completo)
    const paidThisMonth = (thisMonthRes.data || [])
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      activeMemberships,
      allMemberships: membershipsRes.data?.memberships || [],
      recentPayments: paymentsRes.data || [],
      dependentsCount: dependentsRes.count || 0,
      paidThisMonth,
    };
  });
}
```

### Obtener perfil para edición

```typescript
export async function getProfileForEdit(userId: string) {
  return safeQuery(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, birth_date")
      .eq("id", userId)
      .single();
    return data;
  });
}

export async function updateProfile(userId: string, updates: {
  full_name?: string;
  phone?: string;
  birth_date?: string;
}) {
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

---

## 7. Componentes Detallados

### 7.1. DashboardNav

Navegación horizontal con tabs, estilo landing (no sidebar de admin).

```
[Resumen] [Membresías] [Pagos] [Cargas]
```

- Posición: debajo del título, pegado al contenido
- Estilo: links con border-bottom activo en `--color-primary`
- Mobile: scroll horizontal con `overflow-x-auto`
- Componente client-side con `usePathname()`

### 7.2. MembershipCard

Card con información de la membresía y barra de progreso temporal.

- Fondo: `bg-surface-container`
- Borde: `border border-on-surface/5`
- Badge de estado: usando `StatusBadge` existente (reutilizar de admin)
- Barra de progreso: gradiente `#ff544c → #d32f2f` proporcional a días transcurridos
- Si vence en ≤7 días: borde amarillo/warning
- Si está vencida: borde rojo, opacidad reducida

### 7.3. AlertBanner

Banner de alertas contextuales:

- **Membresía por vencer** (≤7 días): fondo amarillo/warning sutil
- **Sin membresía activa**: fondo con CTA para ver planes
- **Membresía vencida**: fondo rojo sutil con renovación

Estilo: `glass-panel` con borde coloreado a la izquierda (border-left 4px).

### 7.4. QuickStats

3 cards de estadísticas:

| Card | Icono | Dato | Fuente |
|---|---|---|---|
| Membresías activas | `card_membership` | Cantidad (propias + cargas) | `activeMemberships.length` |
| Pagos este mes | `payments` | Suma del mes actual formateada CLP | `paidThisMonth` |
| Cargas | `group` | Cantidad de dependientes | `dependentsCount` |

Estilo: reutilizar patrón visual de `StatsCard` del admin pero adaptado.

### 7.7. NotificationItem

Fila de notificación para la lista:

- Icono según tipo: `notifications` (aviso), `event` (recordatorio), `campaign` (comunicado), `mail` (correo_masivo)
- Título (bold)
- Contenido truncado (2 líneas con `line-clamp-2`)
- Fecha formateada en español
- Borde sutil inferior entre items
- Mobile: contenido completo sin truncar

### 7.8. DashboardSkeleton

Loading skeletons para cada sección del dashboard:

| Sección | Skeleton |
|---|---|
| QuickStats | 3 rectángulos animados (pulse) de 120x80px |
| MembershipCard | 2 rectángulos de card (300x120px) con líneas simuladas |
| PaymentRow | 3 rectángulos de fila (100% x 48px) |
| NotificationItem | 2 rectángulos de notificación (100% x 64px) |

Estilo: `animate-pulse` con fondo `bg-surface-container` y bordes redondeados iguales a los componentes reales.

### 7.5. PaymentRow

Fila de pago para la tabla/lista:

- Fecha (formateada en español)
- Concepto (nombre del plan o "Compra de producto")
- Monto (formateado CLP)
- Método (icono + texto)
- Estado (badge coloreado)
- Botón descargar comprobante (si `receipt_url` existe)

### 7.6. DependentCard

Card de dependiente:

- Avatar con inicial del nombre
- Nombre completo
- Categoría (niño/adulto) con badge
- Fecha de nacimiento + edad calculada
- RUT (si existe)
- Estado de membresía actual (activa/sin membresía)

---

## 8. RLS — Seguridad (ya implementada)

Las políticas RLS existentes ya cubren el acceso del usuario:

| Tabla | Política | Acceso |
|---|---|---|
| `profiles` | `profiles_select_own_or_admin` | El usuario lee su propio perfil |
| `dependents` | `dependents_owner_or_admin` | El tutor ve/edita sus cargas |
| `beneficiaries` | `beneficiaries_owner_or_admin` | `owns_beneficiary()` verifica propiedad |
| `memberships` | `memberships_owner_or_admin` | `owns_beneficiary()` + `purchased_by` |
| `payments` | `payments_owner_or_staff` | `user_id = auth.uid()` |
| `membership_plans` | `membership_plans_public_read` | Lectura pública |
| `notifications` | `notifications_admin_only` | ⚠️ Solo admin lee/escribe |

**Nota sobre notificaciones**: La política actual `notifications_admin_only` bloquea el acceso del usuario a las notificaciones. Para que el dashboard pueda mostrar notificaciones, se necesita agregar una política adicional:
```sql
-- Agregar política para que los usuarios vean notificaciones target='todos'
CREATE POLICY "notifications_user_read_todos" ON public.notifications
  FOR SELECT USING (target = 'todos' OR public.is_admin());
```

**No se necesitan otros cambios en RLS.**

---

## 9. Flujo del Usuario

```
Usuario inicia sesión
    │
    ▼
Middleware verifica sesión → SessionProvider carga profile
    │
    ▼
Redirect a /dashboard (o aterriza en /)
    │
    ▼
/dashboard ─── Carga getDashboardSummary(user.id)
    │
    ├── Muestra AlertBanner si membresía por vencer o sin membresía
    ├── Muestra QuickStats (membresías activas, pagos del mes, cargas)
    ├── Muestra preview de membresías activas (MembershipCard)
    ├── Muestra últimos 3 pagos (PaymentRow)
    ├── Muestra últimas 2 notificaciones (NotificationItem)
    └── Muestra accesos rápidos
    │
    ├──→ /dashboard/membresias ─── Todas las membresías con filtros
    ├──→ /dashboard/pagos ──────── Historial completo paginado
    ├──→ /dashboard/cargas ─────── Lista de dependientes (lectura)
    ├──→ /dashboard/notificaciones ── Historial de notificaciones
    └──→ /perfil ───────────────── Editar info personal
```

---

## 10. Prioridades de Implementación

### Fase 1 — Core (implementar primero)
1. `src/lib/supabase/dashboard.ts` — Todas las queries + safeQuery wrapper
2. `src/components/dashboard/DashboardNav.tsx` — Navegación
3. `src/app/dashboard/layout.tsx` — Layout con nav
4. `src/app/dashboard/page.tsx` — Resumen principal (reescribir)
5. `src/components/dashboard/MembershipCard.tsx` — Card de membresía
6. `src/components/dashboard/QuickStats.tsx` — Stats rápidas
7. `src/components/dashboard/AlertBanner.tsx` — Alertas
8. `src/components/dashboard/DashboardSkeleton.tsx` — Loading states

### Fase 2 — Secciones
9. `src/app/dashboard/membresias/page.tsx` — Vista completa de membresías
10. `src/app/dashboard/pagos/page.tsx` — Historial de pagos
11. `src/components/dashboard/PaymentRow.tsx` — Fila de pago
12. `src/app/dashboard/cargas/page.tsx` — Dependientes (lectura)
13. `src/components/dashboard/DependentCard.tsx` — Card dependiente

### Fase 3 — Notificaciones + Perfil
14. `src/app/dashboard/notificaciones/page.tsx` — Historial de notificaciones
15. `src/components/dashboard/NotificationItem.tsx` — Fila de notificación
16. `src/app/perfil/page.tsx` — Rediseño con edición de campos + cambio contraseña

### Fase 4 — Polish
17. Agregar link "Mi Panel" en Navbar cuando hay sesión
18. Animaciones fade-up en secciones
19. Responsive mobile
20. Empty states para cada sección
21. Error states con retry
22. Verificar RLS de notifications (agregar política de lectura para target='todos')

---

## 11. Tokens de Diseño Específicos para Dashboard

### Cards de membresía

```css
/* Barra de progreso */
.membership-progress {
  height: 6px;
  border-radius: 3px;
  background: rgba(229, 226, 225, 0.1);
}

.membership-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #ff544c, #d32f2f);
  transition: width 0.6s ease-out;
}

/* Warning state (vence pronto) */
.membership-warning {
  border-color: rgba(251, 191, 36, 0.3);
}

/* Expired state */
.membership-expired {
  opacity: 0.6;
  border-color: rgba(239, 68, 68, 0.3);
}
```

### Alert Banner

```css
.alert-banner {
  background: rgba(32, 31, 31, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(229, 226, 225, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
}

.alert-banner--warning {
  border-left: 4px solid #fbbf24;
}

.alert-banner--danger {
  border-left: 4px solid #ef4444;
}

.alert-banner--info {
  border-left: 4px solid #ffb4ac;
}
```

### Dashboard Nav Tabs

```css
.dashboard-tab {
  font-family: var(--font-body-md);
  font-size: 14px;
  color: var(--color-on-surface-variant);
  padding: 12px 16px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.dashboard-tab:hover {
  color: var(--color-on-surface);
}

.dashboard-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

---

## 12. Consideraciones Técnicas

### React 19 + Next.js 16
- Usar `inputMode="numeric"` en inputs numéricos (bug conocido de React 19)
- Dashboard pages como Client Components (`"use client"`) porque necesitan `useSession()`
- Layout puede ser Server Component si no necesita hooks

### Supabase Client
- Usar `createClient()` de `src/lib/supabase/client.ts` (browser)
- Las queries se ejecutan client-side con el token del usuario
- RLS filtra automáticamente por `auth.uid()`

### Paginación
- Pagos: paginación con `range(offset, offset + limit)` — 20 por página
- Notificaciones: paginación con `range(offset, offset + limit)` — 20 por página
- Membresías: sin paginación necesaria (pocos registros por usuario)

### Manejo de Errores
Todas las queries deben usar el wrapper `safeQuery()` que:
1. Captura errores de Supabase (RLS, red, etc.)
2. Retorna `{ data, error }` donde `error` es un string legible
3. Loguea el error completo en consola para debugging

En los componentes:
```typescript
const [data, setData] = useState<T[]>([]);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  queryFn(userId).then(({ data, error }) => {
    if (error) setError(error);
    else setData(data || []);
    setLoading(false);
  });
}, [userId]);

if (loading) return <DashboardSkeleton section="memberships" />;
if (error) return <ErrorBanner message={error} onRetry={() => refetch()} />;
if (data.length === 0) return <EmptyState ... />;
```

### Loading States
Cada sección debe tener su propio skeleton independiente:
- No mostrar un solo spinner global para todo el dashboard
- Cada card/section carga de forma independiente
- Usar `animate-pulse` con dimensiones exactas del componente real

### Performance
- Usar `Promise.all` para queries paralelas en el resumen
- Considerar `useMemo` para cálculos de progreso de membresía
- Loading skeletons para cada sección independiente
- No re-fetch al navegar entre tabs (cachear datos en el layout)

---

## 13. Empty States

Cada sección necesita un estado vacío elegante:

| Sección | Mensaje | CTA | Icono |
|---|---|---|---|
| Sin membresías | "Aún no tienes una membresía activa" | [Ver planes de membresía →] | `card_membership` |
| Sin pagos | "No hay pagos registrados" | — | `receipt_long` |
| Sin cargas | "No tienes dependientes registrados" | "Contacta a la academia para inscribir cargas" | `group` |
| Sin notificaciones | "No tienes notificaciones nuevas" | — | `notifications_none` |
| Membresía vencida | "Tu membresía ha vencido" | [Contactar para renovar →] | `warning` |
| Error de carga | "Error al cargar datos" | [Reintentar] | `error_outline` |

---

## 14. Relación con Módulos Futuros

| Módulo Futuro | Impacto en Dashboard del Usuario |
|---|---|
| **Módulo 3 — Flow** | Se agrega botón "Pagar" directamente desde el dashboard para renovar/comprar membresías |
| **Módulo 4 — Asistencia** | Se agrega tab "Asistencia" con historial de clases asistidas y porcentaje mensual |
| **Módulo 4 — Ficha Médica** | Se agrega sección en `/perfil` o en `/dashboard/cargas` con información médica de cada beneficiario |
| **Galería** | Sin impacto directo en dashboard |

---

## 15. Preparación para Módulo 4 — Ficha Médica

Aunque el Módulo 4 está pendiente, el dashboard debe estar preparado para integrarlo sin reescrituras mayores.

### Cambios necesarios en Fase 4 (futuro)

1. **DependentCard** — Agregar botón "Ver ficha médica" que redirija a `/dashboard/cargas/[id]/medico`
2. **Nueva ruta** — `/dashboard/cargas/[id]/medico` con información médica del beneficiario
3. **Queries adicionales** en `dashboard.ts`:
   ```typescript
   export async function getMedicalRecord(beneficiaryId: string) {
     return safeQuery(async () => {
       const supabase = createClient();
       const { data } = await supabase
         .from("medical_records")
         .select("*")
         .eq("beneficiary_id", beneficiaryId)
         .maybeSingle();
       return data;
     });
   }
   ```
4. **RLS existente** ya cubre: `medical_records_owner_or_staff` con `owns_beneficiary()`
5. **Nuevos componentes**:
   - `MedicalInfoCard.tsx` — Muestra alergias, medicamentos, condiciones
   - `EmergencyContactCard.tsx` — Contacto de emergencia

### Estructura de archivos (futuro)
```
src/app/dashboard/cargas/
├── page.tsx                    ← Lista de dependientes (existente)
└── [id]/
    └── medico/
        └── page.tsx            ← [NEW] Ficha médica del dependiente
```
