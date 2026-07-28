# Requisitos Implementados (Escaneo Completo)

Este documento contiene un desglose exhaustivo de los requisitos de negocio y funcionales que están implementados y operativos en el sistema ZonaElite. Todos los módulos técnicos mencionados en `flujo-modulos.md` convergen para satisfacer estos requisitos.

---

## 1. Venta Cruzada de Planes (Matrícula + Mensualidad)
**Requisito**: Permitir que un alumno pague la mensualidad y, en la misma transacción, asocie un plan de inscripción base a la academia (matrícula).
- **Implementación**:
  - `CheckoutModal.tsx` contiene un `Switch` (Toggle) para "Incluir inscripción anual/semestral". Si se activa, envía un parámetro booleano al servidor.
  - `src/app/api/flow/create-order/route.ts` recibe el request, suma el precio del `membership_plan` con el del `enrollment_plan` y genera el concepto consolidado ("Membresía X + Inscripción Y").
  - Al confirmarse (`confirmation/route.ts`), la función `confirmAndCreateMembership()` en `src/lib/flow-helpers.ts` extrae ambos ítems. Llama a `extendEnrollment()` para crear/actualizar la inscripción del usuario, y luego asigna la membresía normalmente.

## 2. Prevención de Multi-Membresías "Zombie"
**Requisito**: Un alumno solo debe tener 1 membresía activa a la vez por lógica de negocio. Si compra una nueva antes de que la vieja expire, la vieja se cancela inmediatamente (es "pisada").
- **Implementación**:
  - Se eliminaron las lógicas de `.maybeSingle()` que generaban caídas de BD por error de múltiples resultados cuando había una cuenta corrupta.
  - En `flow-helpers.ts` y en `AssignMembershipModal.tsx`, se efectúa una **actualización masiva** o *Bulk Update* a la tabla `memberships`:
    ```typescript
    await supabase.from("memberships").update({ status: "cancelada" })
      .eq("beneficiary_id", targetBeneficiaryId).eq("status", "activa");
    ```
  - Esto asegura que el beneficiario entre al nuevo plan con un historial limpio y una única membresía activa, descartando cobros o tiempos superpuestos.

## 3. Control Exhaustivo de Tokens y Asistencia
**Requisito**: Soporte a membresías limitadas (ej. 8 o 12 clases por mes). Cuando el profesor marca presente o ausente, descuenta; cuando marca justificado, no descuenta.
- **Implementación**:
  - Toda la matemática recae en la función RPC de Supabase `get_remaining_tokens` (Ubicada en la BD, respaldada en `contexto/migrations/001_add_tokens_to_membership_plans.sql`).
  - Resta la suma de los conteos de `class_enrollments` en ese rango, y suma de vuelta los registros marcados con `status = 'justificado'` en la tabla `attendance`.
  - **Filtro del Mismo Día**: Si un alumno asiste a las 10:00 y renueva su membresía a las 11:00, la función valida `ce.enrolled_at >= v_created_at`. De este modo, no descuenta a la membresía nueva la clase que tomó con la membresía antigua, impidiendo fugas (empezar con "una clase menos").
  - **Uso Frontend**: `MembershipCard.tsx` obtiene este número y muestra gráficamente (barras) la proporción de tokens consumidos sobre el total.

## 4. Gestión de Cargas / Familiares Multicuenta
**Requisito**: Un padre puede inscribirse, pagar por él, pagar por sus dos hijos usando la misma tarjeta de crédito, y tener el control estadístico de cada uno por separado.
- **Implementación**:
  - El sistema de Auth enlaza a la tabla `profiles`. 
  - La tabla transaccional es `beneficiaries`. Cada `profile_id` (Padre) puede insertar en `dependents` los datos del hijo, lo que autogenera un `beneficiary_id` distinto.
  - Al realizar un pago en `CheckoutModal.tsx`, el usuario elige en un Dropdown a quién comprarle la membresía.
  - El perfil médico (`MedicalInfoCard.tsx`) aísla la tabla `medical_records` utilizando el `beneficiary_id`, de modo que el padre y el hijo no se mezclan.

## 5. Prevención de Bugs Horarios (Timezone GMT-4)
**Requisito**: Solucionar el "Salto de Fecha" que ocurría porque los servidores UTC cerraban el día chileno a las 20:00 hrs o 21:00 hrs según la estación, expirando membresías antes de tiempo.
- **Implementación**:
  - Eliminación de todas las referencias directas a `new Date().toISOString().split("T")[0]` en toda la lógica de servidor y cliente.
  - Centralización en `src/lib/dates.ts` usando la API `Intl.DateTimeFormat` configurada en `"es-CL"` y `"America/Santiago"`.
  - Las funciones `getChileToday()` y `addDaysChile(fecha, dias)` garantizan que si se renueva a las 23:59 hrs en Chile, en BD se inserte la fecha correcta correspondiente a Chile y no "mañana" (UTC).

## 6. Panel Administrativo a Medida
**Requisito**: Un sistema integral para manejar usuarios, roles, creación y listado de horarios y la gestión del contenido público. Todo con permisos estructurados.
- **Implementación**:
  - Seguridad provista por `AdminGuard.tsx` para interceptar a todo aquel que no sea `role_id=1` (Administrador) o staff.
  - **Módulo de Asistencia**: Interfaz (`AttendanceOverview.tsx` y `AsistenciaRow.tsx`) para la asistencia manual o mediante un auto-generador de sesiones basado en la tabla semanal `schedules`.
  - **Asignación Manual**: Componente `AssignMembershipModal.tsx` capaz de insertar un pago manual ignorando Flow.cl, aplicando la lógica correcta de cancelación y fechas chilenas. Emisión de comprobantes internos a PDF con `MembershipReceipt.tsx`.
  - **Gráficos Dinámicos**: Dashboard (`/admin/page.tsx`) alimentado con la librería **Recharts**, filtrando pagos completados (`status = 'pagado'`) para crear comparativas mensuales automáticas.

## 7. Escalabilidad y Componentes de Landing Dinámicos
**Requisito**: El frontend debe ser altamente estético (UI Dark, Material) y estar totalmente enlazado a lo transaccional, no siendo solo visual.
- **Implementación**:
  - `Memberships.tsx` hace solicitudes asíncronas para obtener los `membership_plans` desde BD y renderizarlos en tarjetas tridimensionales (Glassmorphism).
  - Las animaciones con `FadeUpObserver.tsx` no bloquean el Render Cycle porque se cargan estrictamente con la API de "Intersection Observer" una vez la UI está lista en cliente.
  - Motor de Blog e interfaz de Torneos/Ceremonias integrado directamente en el Next.js App Router (rutas estáticas paramétricas `/blog/[slug]`), listo para ser posicionado en buscadores con Meta Datos (`sitemap.ts` y `robots.ts` presentes en raíz).

## 8. Membresía Destacada (PRO)
**Requisito**: Desde el panel de administración, se debe poder marcar un plan de membresía como destacado (PRO), el cual debe tener exclusividad absoluta (solo 1 destacado a la vez) y presentarse en la landing con un diseño prismático especial centrado en la cuadrícula.
- **Implementación**:
  - Se agregó la columna `featured` (BOOLEAN) a la tabla `membership_plans` en Supabase, resguardada con un `UNIQUE INDEX ... WHERE (featured = TRUE)`.
  - El modal de edición del Admin Panel (`admin/membresias/page.tsx`) gestiona el estado a través de la función `handleSetFeatured`, que ejecuta un "bulk update" desmarcando todos los previos antes de marcar el nuevo.
  - La UI en la landing page (`Memberships.tsx`) reorganiza el arreglo de planes para situar el `featuredPlan` en el índice central del grid. Inyecta keyframes en línea (`@keyframes prismatic-shift`, `diamond-pulse`) aplicando sombras, gradientes (League of Legends Prismatic) y un badge "⬡ PRO" sobre el componente.

## 9. Exportación a Excel Avanzada en Paneles Administrativos
**Requisito**: Permitir la descarga de reportes Excel (.xlsx) directamente desde el navegador en los paneles de Ventas, Usuarios, Horarios y Asistencia con filtros temporales y formatos visuales/estadísticos.
- **Implementación**:
  - **Motor Global (`src/lib/excel.ts`)**: Implementa `SheetJS` (xlsx) con autofit inteligente (`!cols`) para formatear texto y arreglos matriciales.
  - **Panel de Ventas (`admin/ventas/page.tsx`)**: Genera "Cartola" de ingresos totales, desglose por método de pago y listado detallado filtrable por Mes, Año e Histórico.
  - **Panel de Usuarios (`admin/usuarios/page.tsx`)**: Cruza la información de perfiles y cargas (`dependents`) con `memberships` y `academy_enrollments`. Diferencia explícitamente la `Fecha Nacimiento` (`birth_date`) de la `Fecha Registro Ingreso` (`created_at`). Genera además la hoja "Tablas para Gráficos" con matrices estructuradas listas para renderizar gráficos de torta y barras en Excel.
  - **Panel de Horarios (`admin/horarios/page.tsx`)**: Mapea la grilla semanal (Lunes a Domingo) en una matriz visual horizontal con bloques horarios.
  - **Panel de Asistencia (`admin/asistencia/page.tsx`)**: Genera el reporte mensual con tasa de asistencia, presentes, ausentes y justificados.

