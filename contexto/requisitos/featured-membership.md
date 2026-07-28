# Implementación Membresía Destacada (PRO)

## 1. Explicación Profunda del Requisito
Se requiere la capacidad de marcar una membresía como "Destacada" o "PRO" desde el panel de administración. Esta membresía debe resaltar en la landing page principal, ubicándose al centro de la lista de planes y luciendo un estilo visual prismático con un aura "adiamantada" (estilo League of Legends "Prismatic").

**Roles impactados**:
- **Admin**: Puede seleccionar cuál membresía será la destacada a través del modal de creación/edición de planes.
- **Usuario (Landing Page)**: Visualiza la membresía destacada con efectos visuales especiales que atraen la atención para fomentar su compra.

**Reglas de negocio**:
- Solo puede existir un (1) plan destacado a la vez. Si el administrador marca un nuevo plan como destacado, el anterior pierde automáticamente esta condición.

## 2. Flujo de Implementación Propuesto

1. **Base de datos (Supabase)**:
   - Se requiere agregar una nueva columna booleana `featured` a la tabla `membership_plans`.
   - Se debe crear un índice parcial único (`UNIQUE INDEX ... WHERE featured = TRUE`) para garantizar a nivel de base de datos que solo exista un plan destacado.

2. **Backend / API (Supabase Client)**:
   - En el panel de administración (`src/app/admin/membresias/page.tsx`), actualizar la función `handleSetFeatured`.
   - Antes de asignar el nuevo plan como destacado, se debe hacer un update masivo (`Bulk Update`) para setear `featured = false` en todos los planes actuales, asegurando la exclusividad.

3. **Frontend / UI**:
   - **Admin UI**: Añadir un botón rápido (ícono de estrella) en la tabla de planes y un switch estilo PRO en el modal de edición para gestionar este estado.
   - **Landing UI (`Memberships.tsx`)**: 
     - Reordenar los planes traídos de la base de datos para colocar el plan destacado en el centro (`index = 1` en un grid de 3 columnas).
     - Inyectar animaciones CSS clave (`@keyframes`) para el shift prismático y el pulso de aura de diamante.
     - Aplicar clases específicas y gradientes complejos a la tarjeta del plan destacado para diferenciarlo radicalmente de los demás.

## 3. Análisis de Impacto
- **Checkout Flow**: El flujo de compra y validación de tokens no se ve afectado. `featured` es puramente visual y para ordenamiento.
- **Zonas Horarias / Fechas**: Sin impacto, no se manejan fechas.
- **Base de Datos**: La alteración a `membership_plans` es retrocompatible debido a que el valor por defecto de `featured` es `FALSE`. La exclusividad se maneja atómicamente desde la lógica de la UI reforzada por el índice de la base de datos.

## 4. Estado Actual
Implementado y documentado en el sistema según las normativas vigentes.
