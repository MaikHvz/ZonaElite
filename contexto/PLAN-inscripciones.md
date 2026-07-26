# PLAN — Sistema de Inscripciones (Matrícula) a la Academia

> Documento de integración completo. Si se cancela el contexto, leer este archivo para retomar.

---

## 1. Requerimiento

### Concepto
**Inscripción a la academia** (matrícula) — pago con vencimiento configurable. Es **prerequisito** para comprar membresías e inscribirse en clases.

### Reglas de negocio
1. **Cada beneficiario** (usuario o carga) necesita su propia inscripción vigente
2. Se puede comprar **sola** o **bundled con membresía** (en el mismo pago Flow)
3. Si vence la inscripción → **no puede comprar nuevas membresías**, pero la membresía activa existente **sigue vigente**
4. El **admin puede asignar** inscripciones manualmente (pago en efectivo, cortesía, etc.)
5. **1 inscripción activa por beneficiario**. Comprar otra **extiende** desde la fecha de vencimiento actual
6. **Planes de inscripción** variables (6 meses, 1 año, etc.) — precio y duración configurables por el admin
7. Si el usuario tiene inscripción vigente y compra otra, el nuevo plazo se **suma** al tiempo restante

### Ejemplo de extensión
```
Inscripción actual vence: 2026-10-25 (faltan 2 meses)
Compra plan "1 Año" (365 días)
Nuevo vencimiento: 2027-10-25 (14 meses total)
```

---

## 2. Modelo de datos

### Tabla nueva: `enrollment_plans`

```sql
CREATE TABLE public.enrollment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabla nueva: `academy_enrollments`

```sql
CREATE TABLE public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrollment_plan_id UUID NOT NULL REFERENCES public.enrollment_plans(id),
  payment_id UUID REFERENCES public.payments(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','vencida','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Policies

```sql
-- Admin: acceso total
CREATE POLICY "admin_all_enrollment_plans" ON public.enrollment_plans
  FOR ALL USING (public.is_admin());

CREATE POLICY "admin_all_academy_enrollments" ON public.academy_enrollments
  FOR ALL USING (public.is_admin());

-- Staff: lectura
CREATE POLICY "staff_read_enrollment_plans" ON public.enrollment_plans
  FOR SELECT USING (public.is_staff());

CREATE POLICY "staff_read_academy_enrollments" ON public.academy_enrollments
  FOR SELECT USING (public.is_staff());

-- Usuarios: ven sus propias inscripciones (y de sus cargas)
CREATE POLICY "user_read_own_enrollments" ON public.academy_enrollments
  FOR SELECT USING (
    public.owns_beneficiary(beneficiary_id)
  );

-- Usuarios: pueden insertar (para pagos Flow)
CREATE POLICY "user_insert_enrollment_flow" ON public.academy_enrollments
  FOR INSERT WITH CHECK (
    public.owns_beneficiary(beneficiary_id)
  );
```

### Seed data

```sql
INSERT INTO public.enrollment_plans (name, price, duration_days, active, sort_order)
VALUES
  ('6 Meses', 15000, 180, true, 1),
  ('1 Año', 25000, 365, true, 2);
```

---

## 3. Flujos de usuario

### 3.1 Checkout con membresía (flow modificado)

```
Usuario selecciona plan membresía
  → CheckoutModal abre
  → Para beneficiario seleccionado, se consulta:
    1. ¿Tiene inscripción activa? (academy_enrollments WHERE beneficiary_id AND status='activa' AND end_date >= hoy)
    2. ¿Qué planes de inscripción hay? (enrollment_plans WHERE active=true)
  → Si NO tiene inscripción activa:
    - Mostrar sección "Agregar inscripción a la academia"
    - Dropdown con planes disponibles (6 Meses, 1 Año, etc.)
    - Checkbox para activar/desactivar
    - Al seleccionar: "Extiende tu inscripción hasta {fechaCalculada}"
  → Si SÍ tiene inscripción activa:
    - Badge verde "Inscripción vigente hasta {fecha}"
    - Sin opción de agregar
  → Resumen de pago:
    - Línea "Membresía {plan}" — ${price}
    - Línea "Inscripción {plan}" — ${price} (si aplica)
    - Total
  → POST /api/flow/create-order con { planId, beneficiaryId, includeEnrollment, enrollmentPlanId }
```

### 3.2 Compra standalone de inscripción

```
Dashboard o /dashboard/membresias → botón "Comprar Inscripción"
  → CheckoutModal en modo "enrollment-only"
  → Sin selección de plan de membresía
  → Solo selección de plan de inscripción
  → POST /api/flow/create-order con { planId: null, beneficiaryId, includeEnrollment: true, enrollmentPlanId }
```

### 3.3 Asignación manual (admin)

```
/admin/inscripciones → tab "Inscripciones" → "Asignar inscripción"
  → Modal: buscar usuario → seleccionar beneficiario → seleccionar plan → método de pago → monto → comprobante
  → INSERT academy_enrollments con start=today, end=today+duration
  → INSERT payments con method='transferencia'|'efectivo', status='pagado'
```

### 3.4 Inscripción a clases (EnrollModal)

```
Actual:  category ✓ → membership ✓ → planAllowed ✓ → alreadyEnrolled ✓ → eligible
Nuevo:   category ✓ → ENROLLMENT ✓ → membership ✓ → planAllowed ✓ → alreadyEnrolled ✓ → eligible

Si no tiene inscripción activa:
  eligible = false
  ineligibleReason = "Sin inscripción a la academia"
  Mostrar enlace "Comprar inscripción" → abre flujo de pago
```

---

## 4. Cambios por archivo

### Archivos a CREAR

| Archivo | Descripción |
|---------|-------------|
| `project-context/sql-academy-enrollments.sql` | Migración SQL completa |
| `src/app/admin/inscripciones/page.tsx` | CRUD admin: planes + inscripciones asignadas |

### Archivos a MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `src/app/admin/layout.tsx` | Agregar link "Inscripciones" en AdminSidebar |
| `src/components/CheckoutModal.tsx` | Dropdown planes inscripción, sección bundled, resumen con 2 líneas |
| `src/app/api/flow/create-order/route.ts` | Aceptar `includeEnrollment` + `enrollmentPlanId`, calcular monto total |
| `src/lib/flow-helpers.ts` | En `confirmAndCreateMembership`: crear/extend enrollment si metadata lo indica |
| `src/components/EnrollModal.tsx` | Agregar gate de inscripción (check antes de membership) |
| `src/app/dashboard/page.tsx` | Badge estado inscripción |
| `src/app/dashboard/membresias/page.tsx` | Estado inscripción + botón comprar |
| `contexto/schema-complete.sql` | Agregar tablas nuevas |
| `contexto/BRAIN.md` | Documentar sistema de inscripciones |
| `contexto/01-project-context-flow.md` | Actualizar flujos |
| `contexto/02-database-interaction.md` | Agregar queries de inscripciones |

---

## 5. Lógica de negocio detallada

### Extensión de inscripción

```
function extendEnrollment(beneficiaryId, newPlan):
  current = query("academy_enrollments WHERE beneficiary_id=? AND status='activa' ORDER BY end_date DESC LIMIT 1")
  
  if current:
    base_date = max(current.end_date, today)
    new_end = base_date + newPlan.duration_days
    update(current.id, { end_date: new_end, enrollment_plan_id: newPlan.id, payment_id })
  else:
    insert({
      beneficiary_id: beneficiaryId,
      enrollment_plan_id: newPlan.id,
      payment_id,
      start_date: today,
      end_date: today + newPlan.duration_days,
      status: 'activa'
    })
```

### Validación en create-order

```
if includeEnrollment:
  plan = query("enrollment_plans WHERE id=? AND active=true")
  if !plan: error "Plan de inscripción no válido"
  
  beneficiary = query("beneficiaries WHERE id=?")
  validate ownership
  
  total_amount = (plan.price if plan) + enrollmentPlan.price
  concept = buildConcept(plan, enrollmentPlan)
```

### Concepto en Flow

```
if plan && enrollmentPlan: "Inscripción {enrollmentPlan.name} + Membresía {plan.name}"
if solo enrollmentPlan: "Inscripción {enrollmentPlan.name}"
if solo plan: "Membresía {plan.name}"
```

---

## 6. Checklist de implementación

### Fase 1: Base de datos
- [x] Crear tabla `enrollment_plans`
- [x] Crear tabla `academy_enrollments`
- [x] Crear RLS policies (admin, staff, user read, user insert flow)
- [x] Crear indexes (beneficiary_id, status, end_date)
- [x] Insertar seed data (2 planes por defecto)
- [ ] Verificar con Supabase Dashboard

### Fase 2: Admin CRUD
- [x] Crear `/admin/inscripciones/page.tsx`
- [x] Tab "Planes": CRUD de enrollment_plans
- [x] Tab "Inscripciones": tabla de academy_enrollments con filtros
- [x] Modal "Asignar inscripción": búsqueda usuario → beneficiario → plan → pago
- [x] Agregar link en AdminSidebar (`src/app/admin/layout.tsx`)
- [ ] Test: crear plan, asignar inscripción manual, verificar en BD

### Fase 3: Checkout Flow (bundled)
- [x] Consultar planes inscripción + estado inscripción del beneficiario en CheckoutModal
- [x] Agregar sección "Agregar inscripción" con dropdown de planes
- [x] Mostrar "Vigente hasta {fecha}" si ya tiene inscripción activa
- [x] Actualizar resumen de pago (2 líneas + total)
- [x] Modificar `create-order/route.ts`: aceptar includeEnrollment + enrollmentPlanId
- [x] Calcular monto total = plan.price + enrollmentPlan.price
- [x] Actualizar concepto Flow para incluir inscripción
- [x] Actualizar `flow-helpers.ts`: crear/extend enrollment en confirmation
- [ ] Test: comprar membresía + inscripción bundled, verificar en BD

### Fase 4: EnrollModal (gate)
- [x] Agregar query de inscripción activa por beneficiario
- [x] Agregar check de inscripción antes de membership check
- [x] Mostrar "Sin inscripción a la academia" + enlace
- [ ] Test: intentar agendar sin inscripción → bloqueado

### Fase 5: Dashboard
- [x] Agregar badge/card de estado inscripción en dashboard principal
- [x] Agregar estado inscripción en /dashboard/membresias
- [x] Botón "Comprar Inscripción" / "Renovar" según estado
- [ ] Test: verificar badges según estado

### Fase 6: Compra standalone
- [x] CheckoutModal en modo "enrollment-only" (sin plan de membresía)
- [x] Botón trigger en dashboard/membresias
- [x] create-order: aceptar planId=null con includeEnrollment=true
- [ ] Test: comprar solo inscripción, verificar en BD

### Fase 7: Contexto y documentación
- [x] Actualizar `contexto/schema-complete.sql`
- [x] Actualizar `contexto/BRAIN.md`
- [x] Actualizar `contexto/01-project-context-flow.md`
- [x] Actualizar `contexto/02-database-interaction.md`
- [x] Marcar este plan como completado

---

## 7. Dependencias

```
Fase 1 (BD) ──→ Fase 2 (Admin) ──→ Fase 3 (Checkout)
                                  ──→ Fase 4 (EnrollModal)
                                  ──→ Fase 5 (Dashboard)
                                  ──→ Fase 6 (Standalone)
```

Fase 1 es bloqueante para todo. Fases 3-6 pueden ejecutarse en paralelo después de Fase 2.

---

## 8. Notas de implementación

- **RLS**: La política de INSERT para usuarios Flow es necesaria porque el confirmation callback usa el admin client (bypass RLS), pero el enrollment se crea desde el callback. En realidad el callback usa admin client, así que la política de INSERT de usuario es solo para compras standalone directas desde el browser.
- **Supabase PostgREST**: No soporta ordering by nested FK. Usar queries separadas si se necesita ordenar.
- **Concepto Flow**: El `extractPlanName` en flow-helpers extrae el nombre del plan del concepto con regex `"^Membres[íi]a\s+(.+)$"`. Ahora el concepto puede empezar con "Inscripción" — hay que actualizar la regex para manejar ambos casos.
- **Dedup membership**: La ventana de 10 minutos en flow-helpers debe mantenerse para membresías. Para inscripciones, no aplica dedup (la lógica es extender, no crear duplicada).
- **after()**: El procesamiento de enrollment en confirmation debe ir dentro del mismo `after()` block que la membresía, no en un after separado.
