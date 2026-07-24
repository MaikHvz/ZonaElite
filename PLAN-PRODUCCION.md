# Plan de Fixes para Producción — ZonaElite

**Fecha:** 2026-07-22
**Stack:** Next.js 16.2.10, React 19, TypeScript 5, Tailwind v4, Supabase, Recharts

---

## Fix #1: Eliminar rutas de debug/force-confirm (CRÍTICO — filtración de datos)

**Archivos:** `src/app/api/flow/debug/route.ts`, `src/app/api/flow/force-confirm/route.ts`

**Problema:** Ambas rutas son accesibles públicamente sin autenticación:
- `/api/flow/debug` (GET) expone: prefijo de API key de Flow, URL de Supabase, presencia de service role key, los últimos 5 pagos con tokens, y verifica pagos con Flow API
- `/api/flow/force-confirm` (POST) permite a cualquiera marcar un pago como `pagado` con solo proveer el token
- No existe middleware.ts en la raíz — no hay protección de rutas a nivel global

**Acción:**
1. **Eliminar** `src/app/api/flow/debug/route.ts` (directorio completo)
2. **Eliminar** `src/app/api/flow/force-confirm/route.ts` (directorio completo)

---

## Fix #2: Fallback "proceed anyway" en confirmation/route.ts (CRÍTICO — pago fraudulento)

**Archivo:** `src/app/api/flow/confirmation/route.ts:113-116`

**Problema:** Si `verifyFlowPayment()` lanza excepción (timeout, error de red, etc.), el catch lo ignora y el código continúa marcando el pago como `pagado` + creando membresía.

**Acción:**
1. En el `catch` del bloque `[4/7]`, hacer `return` para detener el procesamiento
2. El pago se queda como `pendiente` (requiere verificación manual)
3. Reemplazar `createMembershipDebug` (líneas 148-258) por `confirmAndCreateMembership` de `flow-helpers.ts` (elimina código duplicado)

---

## Fix #3: user_id incorrecto en pago manual (AssignMembershipModal.tsx)

**Archivo:** `src/components/admin/AssignMembershipModal.tsx:139-140`

**Problema:** `user_id: user?.id` usa el ID del admin logueado, no del beneficiario/alumno.

**Acción:**
1. Cambiar `user_id: user?.id` por `user_id: selectedProfile.id`
2. Agregar `beneficiary_id: form.beneficiaryId` al insert del pago (falta actualmente)

---

## Fix #4: URL inválida para pago pendiente reutilizado (create-order/route.ts)

**Archivo:** `src/app/api/flow/create-order/route.ts:127-131`

**Problema:** `url: existingPending.flow_token` devuelve el token, no la URL de redirección a Flow.

**Acción:**
1. Importar `getFlowConfig()` desde `@/lib/flow`
2. Construir URL: `apiUrl.replace('/api', '/payment') + '?token=' + existingPending.flow_token`
3. Cambiar línea 128

---

## Fix #5: Query rota de beneficiarios (AssignMembershipModal.tsx)

**Archivo:** `src/components/admin/AssignMembershipModal.tsx:87-92`

**Problema:** La query `.or()` con subquery puede fallar en Supabase PostgREST.

**Acción:**
1. Separar en dos queries secuenciales:
   - Query 1: `beneficiaries` where `profile_id = p.id`
   - Query 2: `beneficiaries` where `dependent_id IN (dependents del tutor)`
2. Combinar resultados, deduplicar por `id`

---

## Fix #6: Agregar manejo de errores a CRUDs del admin (toast notifications)

**Archivos (10 páginas sin try/catch):**
- `admin/usuarios/page.tsx`
- `admin/tipos-clase/page.tsx`
- `admin/horarios/page.tsx`
- `admin/productos/page.tsx`
- `admin/notificaciones/page.tsx`
- `admin/eventos/page.tsx`
- `admin/membresias/page.tsx`
- `admin/blog/page.tsx`
- `admin/configuracion/page.tsx`
- `admin/asistencia/page.tsx` (parcial)

**Acción:**
1. Crear `src/components/admin/Toast.tsx` — componente notificación flotante
2. Crear `src/lib/admin-helpers.ts` — función `handleSupabaseError(error, actionName)` que retorna mensaje legible
3. En cada página: envolver `handleSave` y `handleDelete` en try/catch, verificar `.error` de cada llamada Supabase, mostrar toast

---

## Fix #7: Limpiar scratch/ del repo

**Archivos:** `scratch/check-last-payment.js`, `scratch/confirm-last-payment.js`, `scratch/test-confirmation-logic-2.js`

**Acción:**
1. Eliminar directorio `scratch/` completo
2. Agregar `scratch/` al `.gitignore`

---

## Bonus: Limpiar console.log de debug en flow routes

**Archivos:**
- `src/app/api/flow/confirmation/route.ts` — 43 console.log/warn/error (muchos son logs numerados de debug)
- `src/lib/flow.ts` — log que imprime token en verifyFlowPayment
- `src/lib/flow-helpers.ts` — console.log de éxito

**Acción:**
1. Mantener solo `console.error` para fallos reales
2. Eliminar `console.log` informativos de confirmation route ([1/7]...[7/7])
3. Eliminar log de token en flow.ts línea 180
4. Eliminar console.log de éxito en flow-helpers.ts

---

## Orden de ejecución

| Paso | Fix | Riesgo | Estado |
|------|-----|--------|--------|
| 0 | Crear PLAN-PRODUCCION.md | — | COMPLETADO |
| 1 | #7 Eliminar scratch/ | Bajo | COMPLETADO |
| 2 | #1 Eliminar debug routes | Bajo | COMPLETADO |
| 3 | #2 Confirmation fallback | Alto | COMPLETADO |
| 4 | #4 URL pago reutilizado | Medio | COMPLETADO |
| 5 | #3 user_id manual payment | Medio | COMPLETADO |
| 6 | #5 Query beneficiarios | Medio | COMPLETADO |
| 7 | #6 Error handling CRUDs | Bajo | COMPLETADO |
| 8 | Bonus: limpiar logs | Bajo | COMPLETADO |
| 9 | Verificar TypeScript compilation | — | COMPLETADO (0 errores) |

**Total: ~18 archivos modificados/creados, 5 eliminados**
