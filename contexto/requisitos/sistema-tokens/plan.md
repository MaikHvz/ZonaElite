# Plan de Implementación — Sistema de Tokens por Membresía

## Resumen

| Concepto | Decisión |
|----------|----------|
| **Consumo** | Al inscribirse (horarios, admin, QR) |
| **Devolución** | Solo al marcar "justificado" |
| **Deuda** | Admin puede forzar inscripción con 0 tokens → deuda visible internamente |
| **Notificaciones** | In-app (tabla `notifications`) al titular cuando se devuelva token |
| **QR sin membresía** | Bloqueado + popup redirigiendo a membresías |
| **Cálculo** | `remaining = plan.tokens - (enrollments - justifications) en periodo` |

---

## Fase 1: Base de Datos

**Archivo:** `contexto/schema-complete.sql`

| Cambio | Descripción |
|--------|-------------|
| `membership_plans.tokens` | `INTEGER NULL` — NULL = ilimitado |
| Índices | `idx_class_enrollments_beneficiary`, `idx_attendance_beneficiary_status` |
| Sin columna de deuda | Se calcula dinámicamente: `remaining < 0` = deuda |

---

## Fase 2: Helpers

**Archivo:** `src/lib/supabase/dashboard.ts`

**`getRemainingTokens(beneficiaryId, membershipId)`**
```
1. Obtener plan.tokens (si NULL → ilimitado)
2. Contar enrollments en periodo (session_date BETWEEN start_date AND end_date)
3. Contar justificaciones en periodo
4. remaining = tokens - (enrollments - justifications)
5. Si remaining < 0 → es deuda
```

**`getEnrollmentDebt(beneficiaryId, membershipId)`**
```
1. Obtener plan.tokens
2. Calcular remaining (misma fórmula)
3. Si remaining >= 0 → sin deuda
4. Si remaining < 0 → obtener últimas N inscripciones para mostrar detalles
   (disciplina, fecha, hora, instructor)
```

---

## Fase 3: Admin — CRUD Planes con Tokens

**Archivo:** `src/app/admin/membresias/page.tsx`

| Cambio | Descripción |
|--------|-------------|
| Formulario crear/editar | Campo "Tokens por periodo" (número entero o checkbox "Ilimitado") |
| Tabla planes | Columna "Tokens" con valor o "Ilimitado" |

---

## Fase 4: Inscripción desde /horarios

**Archivo:** `src/components/EnrollModal.tsx`

| Cambio | Descripción |
|--------|-------------|
| Badge tokens | Mostrar "Tokens: X disponibles" por beneficiario |
| Validación | Si `remaining <= 0` → deshabilitar inscripción, razón "Sin tokens disponibles" |
| Al inscribir | Consumir token (automático por fórmula) |

---

## Fase 5: QR Walk-in

**Archivo:** `src/app/api/checkin/route.ts` + `src/app/checkin/[sessionId]/page.tsx`

| Escenario | Comportamiento |
|-----------|----------------|
| Tiene membresía + tokens | Consumir token, inscribir, marcar presente |
| Tiene membresía, sin tokens | **Bloqueado** — retornar error "Sin tokens disponibles" |
| Sin membresía | **Bloqueado** — popup "Debes comprar una membresía" + redirigir a `/dashboard/membresias` |

**Popup a crear:**
```
"Para asistir a clases necesitas:
1. Estar matriculado en la academia
2. Tener una membresía activa

[Comprar membresía]"
```

---

## Fase 6: Inscripción desde Admin

**Archivo:** `src/app/admin/asistencia/page.tsx`

| Cambio | Descripción |
|--------|-------------|
| Badge tokens | Mostrar en resultados de búsqueda |
| Con tokens | Inscribir normalmente, consume token |
| Sin tokens (remaining = 0) | **Permitir** — mostrar advertencia "Esto generará una deuda de 1 clase" |
| Con deuda (remaining < 0) | **Permitir** — mostrar deuda acumulada |

---

## Fase 7: Asignar Membresía (1 activa por beneficiario)

**Archivo:** `src/components/admin/AssignMembershipModal.tsx`

| Cambio | Descripción |
|--------|-------------|
| Validación | Verificar si ya existe membresía activa |
| Si existe | Modal de confirmación: "Ya tiene [Plan X — vence DD/MM]. ¿Sobrescribir?" |
| Al confirmar | Desactivar anterior (`status = 'cancelada'`), crear nueva |

---

## Fase 8: Flow Helpers (1 activa por beneficiario)

**Archivo:** `src/lib/flow-helpers.ts`

| Cambio | Descripción |
|--------|-------------|
| `confirmAndCreateMembership()` | Verificar membresía activa existente |
| Si existe | Desactivar antes de crear nueva |

---

## Fase 9: Dashboard Usuario

**Archivos:** `MembershipCard.tsx`, `dashboard/page.tsx`, `dashboard/membresias/page.tsx`

| Cambio | Descripción |
|--------|-------------|
| MembershipCard | Badge "X tokens disponibles" o "Clases ilimitadas" |
| Dashboard | Mostrar tokens en resumen de membresía |
| Página membresías | Detalle de tokens por membresía |

---

## Fase 10: Notificaciones In-App

**Archivos:** Crear `src/app/api/notifications/route.ts` + modificar asistencia page

| Cambio | Descripción |
|--------|-------------|
| Al marcar justificado | Insertar en `notifications` para el titular de la cuenta |
| Formato | "Se devolvió 1 token por clase justificada el [fecha] — [disciplina]" |
| Destinatario | `profile_id` del titular (no beneficiario/carga) |
| UI notificaciones | Badge en navbar o dashboard (ya existe tabla `notifications`) |

---

## Fase 11: Panel Admin — Vista de Deuda

**Archivo:** `src/app/admin/asistencia/page.tsx` + `admin/membresias/page.tsx`

| Cambio | Descripción |
|--------|-------------|
| Lista asistencia | Mostrar badge con remaining por beneficiario |
| Si deuda | Badge rojo "-2 deudas" con detalle |
| Detalle dedeuda | Click expande: fecha clase, disciplina, a quién corresponde |
| Membresías | Columna "Deuda" en tabla de membresías |

---

## Orden de Implementación

| # | Fase | Dependencias | Tiempo |
|---|------|--------------|--------|
| 1 | Migración SQL | Ninguna | 15 min |
| 2 | Helpers | Fase 1 | 30 min |
| 3 | CRUD planes admin | Fase 1 | 20 min |
| 4 | EnrollModal | Fase 2 | 30 min |
| 5 | QR walk-in | Fase 2 | 25 min |
| 6 | Admin inscribir | Fase 2 | 20 min |
| 7 | Asignar membresía | Fase 1 | 25 min |
| 8 | Flow helpers | Fase 1 | 15 min |
| 9 | Dashboard usuario | Fase 2 | 20 min |
| 10 | Notificaciones | Fase 2 | 25 min |
| 11 | Panel admin deuda | Fase 2 | 20 min |
| **Total** | | | **~4 horas** |

---

## Archivos Afectados (13)

| Archivo | Cambios |
|---------|---------|
| `contexto/schema-complete.sql` | +tokens, +índices |
| `src/lib/supabase/dashboard.ts` | +getRemainingTokens, +getEnrollmentDebt, +tipos |
| `src/components/EnrollModal.tsx` | +validación tokens, +badge |
| `src/app/api/checkin/route.ts` | +validación membresía/tokens |
| `src/app/checkin/[sessionId]/page.tsx` | +popup sin membresía |
| `src/app/admin/asistencia/page.tsx` | +inscribir con deuda, +badges tokens |
| `src/app/admin/membresias/page.tsx` | +campo tokens en CRUD planes, +columna deuda |
| `src/components/admin/AssignMembershipModal.tsx` | +validación 1 activa |
| `src/lib/flow-helpers.ts` | +validación 1 activa |
| `src/components/dashboard/MembershipCard.tsx` | +badge tokens |
| `src/app/dashboard/page.tsx` | +mostrar tokens |
| `src/app/dashboard/membresias/page.tsx` | +detalle tokens |
| `src/app/api/notifications/route.ts` | Nuevo endpoint notificaciones |

---

## Escenarios de Prueba

1. **Plan ilimitado (tokens = NULL):** Inscribir sin límite, mostrar "Clases ilimitadas"
2. **Plan limitado (tokens = 5):** Inscribir 5 veces → remaining = 0, bloquear inscripción
3. **Devolución:** Marcar justificado → remaining incrementa en 1
4. **Deuda admin:** Admin inscribe con 0 tokens → deuda visible con detalles
5. **QR sin membresía:** Bloqueado, popup de redirección
6. **QR con membresía sin tokens:** Bloqueado, error "Sin tokens"
7. **QR con membresía + tokens:** Consume token, inscribe, marca presente
8. **Sobrescribir membresía:** Beneficiario con activa → confirmar → desactivar anterior
9. **Notificación:** Marcar justificado → notificación in-app al titular
10. **1 solo titular:** Cargas no tienen cuenta, notificaciones van al titular
