# Clases Personalizadas — Módulo Independiente

## Estado
- **Fecha:** 2026-08-02
- **Tipo:** Feature / Módulo desacoplado
- **Estado:** 🔵 **PLANIFICADO — documentado, NO implementado.** Solo existe esta documentación (requisito + flujo + análisis de impacto). No hay código ni SQL aplicado.

## Requisito
Permitir al **Admin** crear **planes de clases personalizadas** (sesiones 1 a 1 o grupos pequeños fuera del plan regular: por ejemplo "Clases personalizadas Kenpo", "Preparación física especial"). Un **Alumno** (o **Tutor** por su carga) puede **comprar un pack** de clases personalizadas pagando con Flow.cl, elegir **a qué carga va** (Yo o dependiente), y **consumir esas clases** a través del admin (consumo manual).

### Decisión arquitectónica (cerrada con el usuario)
- **Módulo 100% desacoplado** de membresías, tokens, inscripciones y check-in.
- **NO** se agrega `plan_type` a `membership_plans`/`memberships`.
- **NO** se atribuye consumo en `class_enrollments.membership_id` ni se toca `idx_memberships_one_active`, `get_remaining_tokens`, `enroll_class`, `checkin`.
- **NO** se migran compras previas: se parte de cero con tablas nuevas propias.

### Roles que interactúan
| Rol | Interacción |
|-----|-------------|
| Admin (role_id=1) | CRUD de planes personalizados; consumo manual de clases de un pack (marcar "agotada" al llegar al total); ver/cancelar packs. |
| Alumno (role_id=4) | Compra packs propios (beneficiario titular). Ve "Mis Clases Personalizadas". |
| Tutor | Compra packs y elige la carga (dependiente). Ve el estado del pack en su dashboard. |
| Instructor/Recepción | (Opcional futuro) consulta de packs del beneficiario; el consumo sigue siendo admin. |
| Visitante anónimo | Ve la sección "¿Necesitas Clases Personalizadas?" en la landing (debajo de las membresías) con todos los planes activos; "Seleccionar" redirige a `/auth`. |

---

## Contexto técnico (puntos de anclaje verificados)
- **Pasarela Flow**: los 3 routes de pago ramifican el concepto con `/membres[íi]a/i` (`confirmation/route.ts:153`, `verify/route.ts:104`, `force-confirm/route.ts:40`). Un concepto `Clase Personalizada X` **no** matchea ese regex hoy → hoy ese pago quedaría pagado sin asignar nada. La rama nueva es **aditiva**.
- `create-order/route.ts`: recibe `{planId, beneficiaryId, includeEnrollment, enrollmentPlanId}`, arma `totalAmount`/`conceptParts`, hace **dedup de pendientes (5 min)** y genera `commerceOrder = crypto.randomUUID()`. El insert a `payments` se hace con admin client (service role → bypass RLS). Este es el patrón a extender con `personalizedPlanId`.
- `confirmAndCreateMembership` (`src/lib/flow-helpers.ts`): dedup 10 min, cancela activas, crea membresía con `addDaysChile`. **No se toca.**
- `notifyUserPaymentStatus(admin, payment, outcome)` (`src/lib/flow-helpers.ts`): notificaciones best-effort con dedup por `Ref: <payment.id>`. Se reutiliza para notificar el pack asignado.
- Fechas: **siempre** `getChileToday()` / `addDaysChile()` de `src/lib/dates.ts` (regla #16 del BRAIN).
- RLS: el admin client bypassa; el browser client respeta. `owns_beneficiary(id)` (squema ~línea 57) y `is_admin()` (~línea 31) ya existen.

---

## Flujo de implementación

### A. Base de datos (Fase 0) — 2 tablas nuevas, sin tocar nada existente

```sql
CREATE TABLE IF NOT EXISTS public.personalized_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  total_classes integer NOT NULL,          -- clases que incluye el pack
  validity_days integer NOT NULL,          -- vigencia del pack
  features jsonb,                          -- características agregables (texto libre)
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personalized_packs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.personalized_plans(id),
  purchased_by uuid NOT NULL,              -- user que pagó (tutor o alumno)
  payment_id uuid REFERENCES public.payments(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_classes integer NOT NULL,
  used_classes integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'activa' NOT NULL CHECK (status IN ('activa','agotada','vencida','cancelada')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT personalized_packs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_personalized_packs_beneficiary ON public.personalized_packs(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_personalized_plans_active ON public.personalized_plans(active);

ALTER TABLE public.personalized_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_plans_select_all" ON public.personalized_plans FOR SELECT USING (true);
CREATE POLICY "personalized_plans_admin_write" ON public.personalized_plans FOR ALL USING (public.is_admin());

ALTER TABLE public.personalized_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personalized_packs_select_own_or_admin" ON public.personalized_packs FOR SELECT USING (
  purchased_by = auth.uid() OR public.owns_beneficiary(beneficiary_id) OR public.is_admin()
);
CREATE POLICY "personalized_packs_admin_write" ON public.personalized_packs FOR ALL USING (public.is_admin());
```

- **Sin índice único sobre packs activos**: un beneficiario puede tener N packs en paralelo (compra múltiple sin cancelarse entre sí). La duración es por pack (`validity_days`), no comparte ventana con membresías.
- El consumo manual actualiza `used_classes` y pasa a `'agotada'` cuando `used_classes >= total_classes`. Estado `'vencida'` se deriva comparando `end_date` con `getChileToday()`.

### B. Backend de pago (Fase 1)
1. **`create-order/route.ts`**: aceptar `personalizedPlanId` (excluyente de `planId`).
   - Fetch de `personalized_plans` (admin client).
   - `totalAmount = price`; concepto `Clase Personalizada ${plan.name}`.
   - Mantener dedup de pendientes, `commerceOrder` único y verificación B-007 intactos.
   - Insert en `payments` con `concept`, `amount`, `beneficiary_id` (para notificar a quién va).
2. **`src/lib/flow-helpers.ts`**: nuevo helper **`confirmPersonalizedPack(admin, paymentId, userId)`**:
   - Busca el pago; si ya tiene pack asignado → retorna (idempotente).
   - Extrae el nombre del plan del concepto (`Clase Personalizada <name>`) → busca plan en `personalized_plans` (ilike).
   - Resuelve beneficiario (del pago o por user) — mismo patrón que `confirmAndCreateMembership`.
   - Inserta `personalized_packs` con `start_date = getChileToday()` y `end_date = addDaysChile(today, plan.validity_days)`.
   - `payment_id` link → `personalized_packs` (sin `membership_id` en `payments`).
3. **Rama nueva en los 3 routes** (tras `markPaymentAsPaid`, junto a la rama de membresía):
   - `confirmation/route.ts` (tras línea 153), `verify/route.ts` (tras línea 104), `force-confirm/route.ts` (tras línea 40).
   - `const hasPersonalizedConcept = /^Clase Personalizad[ao]/i.test(fullPayment.concept || "");`
   - Si matchea → `confirmPersonalizedPack`; en éxito `assignedSomething = true` (dispara `notifyUserPaymentStatus(approved)`).
   - Si falla → `console.error` + `notifyPaymentWithoutMembership` (mismo patrón de manejo de errores; no lanza).
   - La rama de rechazados/cancelados de verify NO cambia.
4. `CheckoutModal.tsx` NO se toca: el usuario compra personalizadas desde el nuevo `PersonalizedCheckoutModal`.

### C. Panel Admin (Fase 2) — `admin/membresias/page.tsx` con sub-tabs
- Sub-tabs: **Planes | Membresías | Personalizadas**.
- Tab **Planes**: dos botones separados — "Crear Plan Membresía" (CRUD actual) y "Crear Plan Personalizado" (nuevo: nombre, precio, clases que trae, días de duración, características/features agregables). `emptyPlan` (línea 20) y `handleSave` (85-103) se extienden con un modo `tipo = 'membresia' | 'personalizado'`.
- Tab **Personalizadas**: listado de packs con filtros (estado/beneficiario), acciones:
  - **Consumir clase** → `used_classes + 1`; al llegar a `total_classes` → `'agotada'`.
  - **Cancelar** → `'cancelada'`.
- No afecta a `AssignMembershipModal`, `MembershipReceipt`, ni a la lógica actual de planes.

### D. Dashboard del usuario (Fase 3)
- `MembershipCard.tsx`: chip informativo **"X clases personalizadas disponibles"** cuando el beneficiario tiene un pack activo/agotado.
- `dashboard/membresias/page.tsx`: nueva sección **"Mis Clases Personalizadas"** (cards resumen por beneficiario: Yo + cargas) con:
  - Plan, clases usadas/total, vigencia (`end_date`), estado (activa/agotada/vencida/cancelada), a qué carga va.
  - Botón **Comprar** → `PersonalizedCheckoutModal`.
- `PersonalizedCheckoutModal.tsx` (nuevo componente, patrón `CheckoutModal`): selector de **beneficiario (a qué carga va)** + plan + monto; `doCreateOrder` con `{ personalizedPlanId, beneficiaryId }`; manejo `401`, timeout, `already_paid`; `PaymentSuccessModal`/`PaymentErrorModal` en `/dashboard/pagos` reutilizados (el pago entra al listado normal con concepto `Clase Personalizada X`).
- `DashboardNav` y `dashboard/membresias` nav existentes NO cambian (no hay página nueva).

### E. Landing pública — sección "¿Necesitas Clases Personalizadas?"
- **Ubicación:** inmediatamente **debajo de la sección de membresías normales** en `src/app/page.tsx` (tras `<Memberships />`), dentro del Módulo Público.
- **Componente nuevo:** `src/components/PersonalizedPlans.tsx` (separado de `Memberships.tsx` para mantener el desacople; `Memberships.tsx` NO se toca).
- **Contenido:**
  - Título **"¿Necesitas Clases Personalizadas?"** siguiendo la línea de diseño actual: pill label (`font-label-sm` uppercase con borde `primary/20`), headline `font-headline-lg` uppercase con `<span className="text-primary">`, subtítulo `font-body-lg text-on-surface-variant` max-w-2xl. Misma sección wrapper: `py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto`.
  - Fetch de `personalized_plans` con `.eq("active", true).order("price")` (RLS `select_all` → lectura pública OK, igual que `membership_plans`).
  - Si `active` hay 0 planes → `return null` (igual que `Memberships.tsx:65`).
  - Grilla `grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-start` con cards al estilo de las **cards regulares** de membresía (`bg-surface-container-low border border-on-surface/5 hover:border-on-surface/10 hover:shadow...`), mostrando: nombre del plan, precio, **total de clases incluidas** y **días de vigencia**, lista de `features` (jsonb) con iconos `check_circle text-primary/60`, y CTA.
  - CTA: si `user` → botón "Comprar ahora" que abre `PersonalizedCheckoutModal` (con selector de carga); si no → `Link href="/auth"` "Seleccionar" (mismo patrón que `Memberships.tsx:314-329`).
  - Cero cruce con `membership_plans`: la sección personalizada lee solo `personalized_plans`.
- **Verificación:** `npm run build` y revisión visual de que la sección queda bajo las membresías siguiendo la línea de diseño.

### F. Tests (Fase 4)
- Sección nueva en `scripts/test-flows.mjs`: contrato del esquema (2 tablas, RLS, índice), concepto no-matcheo (un pago `Clase Personalizada X` NO crea membresía ni cancela activas), `confirmPersonalizedPack` idempotente, 2 packs en paralelo sin cancelarse, consumo manual → agotada, notificación `approved`.
- Suite completa en verde (216 actuales + nueva sección) y `npm run build` sin errores.

---

## Análisis de impacto (Fase 2 del SOP) — cruce verificado contra el código existente

| Punto existente | ¿Se toca? | Razón |
|-----------------|-----------|-------|
| `confirmAndCreateMembership` (flow-helpers) | ❌ No | La rama nueva usa `confirmPersonalizedPack`; el branch de membresía solo se activa con concepto `/membres[íi]a/i`, que un concepto `Clase Personalizada X` nunca matchea. |
| Dedup 10 min + cancel-all de activas (flow-helpers:83-105) | ❌ No | El pack personalizado no cancela ni toca membresías. |
| `checkin/route.ts` (100-107, 244-251) | ❌ No | Personalizadas no pasan por check-in QR; consumo manual admin. |
| `get_remaining_tokens` / `enroll_class` RPC | ❌ No | Cero cruce de tokens; no se atribuye a `class_enrollments`. |
| `idx_memberships_one_active` | ❌ No | No hay múltiples membresías activas; los packs viven en otra tabla. |
| `.maybeSingle()` de membresías (CheckoutModal:143-154, EnrollModal:128-135, AssignMembershipModal:125-133, admin/asistencia:487-493,538-544) | ❌ No | Nada añade membresías activas. |
| Métricas admin (admin/page.tsx:35, MembershipBreakdown:20, MonthlyComparison:36-39, export admin/usuarios:72-90) | ❌ No | No dependen de `personalized_*`. |
| `payments` (concept, amount, commerceOrder, dedup) | ✅ Solo aditivo | Nueva rama de concepto + `personalizedPlanId` en create-order; verificación B-007 intacta. |
| RLS existente de `payments` (637-639) | ❌ No | El insert sigue por admin client (service role). |
| `Memberships.tsx` y sección de membresías de la landing | ❌ No | La landing personalizada es un componente nuevo `PersonalizedPlans.tsx` renderizado debajo; lee solo `personalized_plans`. |
| Zonas horarias (`getChileToday`/`addDaysChile`) | ✅ Usar | Vigencia del pack con helpers Chile-aware; nunca `toISOString().split("T")[0]`. |

**Conclusión del análisis:** el flujo de membresías y la pasarela de pagos **no colapsan**. La rama personalizada es aditiva (nuevo regex, nuevo helper, tabla nueva) y no altera ninguno de los contratos probados por la suite (216 tests A-O).

## Restricciones
- NO tocar `CheckoutModal.tsx`, `EnrollModal.tsx`, `AssignMembershipModal.tsx`, `flow.ts`, `dates.ts`.
- NO migrar compras previas de "personalizada" hechas como membresías: quedan como están.
- Consumo manual solo admin; sin QR, sin integración con asistencia.
- Notificaciones best-effort (nunca rompen el pago), mismo patrón que `notifyPaymentWithoutMembership`.

## Verificación (cuando se implemente)
- Suite `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs` — 216 actuales + sección P nueva, en verde.
- `npm run build` sin errores.
- Probar en sandbox Flow: compra pack → callback → pack activo con fechas correctas; 2 packs en paralelo; consumo manual → agotada; notificación al usuario.
