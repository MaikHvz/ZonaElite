# Plan de Incorporación — Check-in de Asistencia vía QR

## Estado General: 100% — Completo

---

## Etapa 1: Cambios en Base de Datos — 100%

**Archivos modificados:**
- `contexto/schema-complete.sql`

**Cambios realizados:**
1. Campo `status text DEFAULT 'cerrada' NOT NULL` agregado a `class_sessions` con CHECK constraint
2. Campo `source text DEFAULT 'horarios' NOT NULL` agregado a `class_enrollments` con CHECK constraint
3. Campo `qr_alert_duration integer DEFAULT 4 NOT NULL` agregado a `academy_settings`
4. Índice `idx_class_sessions_status` creado

**Estado:** [x] Completo

---

## Etapa 2: Actualizar RLS Policies — 100%

**Archivos modificados:**
- `contexto/schema-complete.sql`

**Cambios realizados:**
1. `attendance`: Nueva política `attendance_insert_own_beneficiary` — permite INSERT a usuarios autenticados para sus propios beneficiarios
2. `class_enrollments`: Nueva política `class_enrollments_insert_qr_walkin` — permite walk-ins por QR sin verificación de membresía/inscripción

**Estado:** [x] Completo

---

## Etapa 3: API de Check-in — 100%

**Archivos creados:**
- `src/app/api/checkin/route.ts`

**Lógica implementada:**
1. POST con `{ session_id, beneficiary_ids: string[] }`
2. Verificación de sesión activa (rechaza 403 si está cerrada)
3. Para cada beneficiario: verificación de ownership, walk-in enrollment si no existe, upsert attendance, verificación de membresía
4. Respuesta individual por beneficiario con `membership_status`

**Estado:** [x] Completo

---

## Etapa 4: Página de Check-in — 100%

**Archivos creados:**
- `src/app/checkin/[sessionId]/page.tsx`

**Lógica implementada:**
1. Redirección a `/auth` si no autenticado
2. Carga de beneficiarios (self + dependents)
3. Selección individual o múltiple con checkboxes
4. Resultados individuales por beneficiario con estado de membresía
5. Manejo de sesión cerrada/no encontrada

**Estado:** [x] Completo

---

## Etapa 5: Generación QR en Admin Asistencia — 100%

**Archivos modificados:**
- `src/app/admin/asistencia/page.tsx`
- `package.json` (instalado `qrcode.react`)

**Lógica implementada:**
1. Botón "Abrir sesión de asistencia QR" que activa la sesión
2. QR generado con `qrcode.react` mostrando URL `/checkin/{sessionId}`
3. Suscripción Realtime a `attendance` INSERT para la sesión
4. Alertas en cola para beneficiarios con membresía vencida
5. Duración configurable desde `academy_settings.qr_alert_duration`
6. Badge "QR activo" en sessions expandidas
7. Botón "Finalizar asistencia" con modal de confirmación

**Estado:** [x] Completo

---

## Etapa 6: Resumen Post-Cierre — 100%

**Integrado en:**
- `src/app/admin/asistencia/page.tsx`

**Lógica implementada:**
1. Vista de resumen que muestra solo asistencias por QR (`source = 'qr'`)
2. Lista de nombres con check verde
3. Botón "Reabrir sesión" para volver a estado activa
4. Persiste hasta que el staff decida avanzar

**Estado:** [x] Completo

---

## Etapa 7: Config Admin + Pulido — 100%

**Archivos modificados:**
- `src/app/admin/configuracion/page.tsx`

**Cambios realizados:**
1. Campo numérico "Duración del aviso QR (segundos)" con `inputMode="numeric"`
2. TypeScript compila sin errores (0 errores)

**Estado:** [x] Completo

---

## Dependencias entre etapas

```
Etapa 1 (Schema) ✓
  └→ Etapa 2 (RLS) ✓
       └→ Etapa 3 (API check-in) ✓
            ├→ Etapa 4 (Página check-in) ✓
            └→ Etapa 5 (QR admin + Realtime) ✓
                 └→ Etapa 6 (Resumen post-cierre) ✓
                      └→ Etapa 7 (Config + pulido) ✓
```

---

## Archivos creados/modificados

| Archivo | Acción |
|---------|--------|
| `contexto/schema-complete.sql` | Modificado (schema + RLS) |
| `src/app/api/checkin/route.ts` | Creado |
| `src/app/checkin/[sessionId]/page.tsx` | Creado |
| `src/app/admin/asistencia/page.tsx` | Reescrito (QR + Realtime + Resumen) |
| `src/app/admin/configuracion/page.tsx` | Modificado (campo QR) |
| `contexto/requisitos/plan-checkin-qr.md` | Creado |

## Pendiente (requiere acción manual)

1. **Ejecutar migración SQL** en Supabase para aplicar los cambios de schema y RLS
2. **Habilitar Realtime** en Supabase Dashboard → Database → Replication → tabla `attendance`
3. Probar flujo completo en el navegador
