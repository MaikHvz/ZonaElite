# Requisito: Categoría "Juvenil" y edición extendida de datos de usuarios

## Estado: Planificación

---

## 1. Explicación Profunda del Requisito

### Problema actual
El sistema solo distingue entre `"nino"` y `"adulto"` en `dependents.category` y `membership_plans.category`. No existe una categoría intermedia para adolescentes de 10 a 16 años, lo cual es relevante para una academia de artes marciales donde los juveniles tienen necesidades diferentes a los niños pequeños y a los adultos.

### Solución propuesta
Agregar una tercera categoría: `"juvenil"` con las siguientes reglas de edad:

| Categoría | Edad |
|-----------|------|
| `nino` | 0–9 años (menor de 10) |
| `juvenil` | 10–15 años (cumple 16 = adulto) |
| `adulto` | 16+ años |

**Nota sobre la lógica de edad**: 16 años y un día = adulto. Es decir, mientras la persona tenga 15 años o menos (inclusive el día que cumple 15) sigue siendo juvenil. Al cumplir 16 años pasa a adulto.

### Reglas de asignación
- **Al crear/editar una carga (dependiente)**: la categoría se asigna automáticamente según la fecha de nacimiento. El admin puede forzar la categoría manualmente si lo desea.
- **Al crear un usuario (titular)**: no aplica categoría (los titulares son siempre "adulto" por ser la cuenta padre).
- **Reasignación periódica**: cuando un juvenil cumple 16, su categoría debería cambiar a "adulto". Esto se puede manejar con un trigger o con lógica en la app (al cargar datos).

### Roles afectados
- **Admin**: puede crear/editar usuarios y cargas, ver categorías en el CRUD, filtrar por categoría.
- **Tutor/Alumno**: puede ver su categoría y la de sus cargas en el dashboard.

---

## 2. Alcance de Cambios

### 2.1 Base de Datos (Migración SQL)

#### A) `dependents.category` — expandir valores permitidos
- Agregar CHECK constraint: `CHECK (category IN ('nino', 'juvenil', 'adulto'))`
- Migrar datos existentes: recalcular categoría basada en `birth_date`:
  - `< 10 años` → `'nino'`
  - `10–15 años` → `'juvenil'`
  - `>= 16 años` → `'adulto'`

#### B) `membership_plans.category` — expandir valores permitidos
- Agregar CHECK constraint: `CHECK (category IN ('nino', 'juvenil', 'adulto'))`
- Seed: planes existentes se mantienen (no se migran automáticamente, el admin decide).

#### C) `schedules.category` — multi-selección
- Cambiar la columna de `text` a `text[]` (array de PostgreSQL) con DEFAULT `'{ninos,juveniles,adultos}'` (equivalente al antiguo "ambos").
- Eliminar el CHECK constraint anterior.
- Migration: convertir datos existentes:
  - `'ambos'` → `'{ninos,juveniles,adultos}'`
  - `'ninos'` → `'{ninos}'`
  - `'adultos'` → `'{adultos}'`
- La elegibilidad se evalúa con `category @> ARRAY['ninos']` (el array contiene al menos un valor).
- Esto permite combinaciones como `'{ninos,juveniles}'`, `'{juveniles,adultos}'`, etc.

#### D) Función SQL de auto-asignación (opcional pero recomendado)
```sql
CREATE OR REPLACE FUNCTION compute_category_from_birth(birth_date date)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN birth_date IS NULL THEN 'adulto'
    WHEN age(CURRENT_DATE, birth_date) < INTERVAL '10 years' THEN 'nino'
    WHEN age(CURRENT_DATE, birth_date) < INTERVAL '16 years' THEN 'juvenil'
    ELSE 'adulto'
  END;
$$;
```

### 2.2 Backend — APIs Admin

#### A) `src/app/api/admin/create-dependent/route.ts`
- Cambiar `VALID_CATEGORIES` de `["nino", "adulto"]` a `["nino", "juvenil", "adulto"]`
- Si no se envía `category`, auto-asignar según `birth_date` usando la lógica de edad.

#### B) `src/app/api/admin/update-dependent/route.ts`
- Mismo cambio en `VALID_CATEGORIES`
- Recalcular categoría si se actualiza `birth_date` (a menos que el admin la haya forzado explícitamente).

#### C) `src/app/api/admin/create-user/route.ts`
- Opcional: aceptar `birth_date` y `category` en el body para crear el perfil con estos datos al momento de crear el usuario.
- Si se envía `birth_date` pero no `category`, auto-asignar.

### 2.3 Frontend — Componentes

#### A) `CreateDependentModal.tsx` (Admin)
- Agregar `"juvenil"` al selector de categoría.
- Auto-asignar categoría al cambiar `birth_date` (con override manual).
- Auto-calcula la edad y muestra la categoría sugerida.

#### B) `AddDependentModal.tsx` y `EditDependentModal.tsx` (Dashboard tutor)
- Mismos cambios que el modal admin: 3 opciones, auto-asignación.

#### C) `page.tsx` (admin/usuarios)
- Actualizar labels de categoría: `"nino" → "Niño"`, `"juvenil" → "Juvenil"`, `"adulto" → "Adulto"`.
- Agregar filtro de categoría en la tabla (si se desea).
- Export Excel: actualizar conteos por categoría.

#### D) `EnrollModal.tsx` — Lógica de elegibilidad
- **Cambio crítico**: `schedule.category` ahora es un array. La elegibilidad se evalúa verificando si el array contiene la categoría del plan/dependiente.
- Lógica actualizada:
  ```typescript
  // schedule.category es ahora un array: string[]
  const isEligible = schedule.category.includes(planCategory);
  // planCategory = "nino" | "juvenil" | "adulto"
  ```
- Si el array está vacío o no incluye la categoría → no elegible.
- Si incluye → elegible. No hay más lógica "ambos" (el equivalente es tener los 3 valores en el array).

#### E) `admin/horarios/page.tsx`
- Reemplazar el dropdown de categoría por **checkboxes multi-selección**: Niños, Juveniles, Adultos.
- Guardar como array en `schedules.category`.
- Mostrar badges de las categorías seleccionadas en la tabla.

#### F) `admin/membresias/page.tsx`
- Agregar `"juvenil"` como opción de categoría en el formulario de planes.

#### G) `dashboard/DependentCard.tsx`
- Agregar estilo visual para `"juvenil"` (ej: color amber/orange).

#### H) `VerFichaModal.tsx` (Admin)
- Agregar label "Juvenil" para la nueva categoría.

#### I) `asistencia/page.tsx` (Admin)
- Agregar label y color para "juvenil".

#### J) `CheckoutModal.tsx` y `PersonalizedCheckoutModal.tsx`
- Agregar label "Juvenil" para la categoría.

#### K) `MembershipCard.tsx`
- Actualizar lógica de label "(carga)".

### 2.4 Tests
- Actualizar `scripts/test-flows.mjs` para cubrir la categoría "juvenil".

### 2.5 Documentación
- Actualizar `contexto/BRAIN.md` con los nuevos valores de enum.
- Actualizar `documentacion/squema-sql-actualizado.sql`.
- Agregar changelog entry en `contexto/migrations/`.
- Actualizar `documentacion/requisitos-implementados.md` y `flujo-modulos.md`.

---

## 3. Decisiones (Respondidas)

1. **Elegibilidad**: Los juveniles SOLO pueden inscribirse en clases marcadas como `"juveniles"`. Si un horario es `"ninos"` o `"adultos"`, un juvenil NO es elegible.
2. **Membresías**: SÍ se agrega `"juvenil"` como categoría en `membership_plans` para que el admin pueda crear planes diferenciados (ej: "Membresía Juvenil" con precio especial).
3. **Reasignación**: Se recalcula al cargar los datos del dependiente (no trigger SQL). Si tiene 16+ años, se muestra como `"adulto"` aunque en BD siga como `"juvenil"`.
4. **Crear usuario**: SÍ, se agregan campos opcionales `birth_date`, `phone` y `rut` al formulario de crear usuario desde admin. Si se ingresa `birth_date`, se auto-calcula la categoría del beneficiario propio.
