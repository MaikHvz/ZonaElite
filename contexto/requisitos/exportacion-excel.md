# Funcionalidad de Exportación a Excel

## 1. Explicación Profunda del Requisito
Se requiere la capacidad de descargar directamente en el navegador un archivo Excel estructurado (formato `.xlsx`) desde los paneles administrativos principales (Ventas, Usuarios, Asistencia, Horarios, etc.).

**Roles impactados:**
- **Admin/Staff:** Pueden extraer informes visuales o de base de datos para análisis externo o entrega a contabilidad, visualizando datos como ingresos totales, listas de alumnos con membresías activas, mallas de horarios en formato visual, etc.

**Reglas de negocio:**
- **Directo en cliente:** No se deben generar archivos transitorios en el servidor de Node.js ni guardar en bases de datos. Todo el procesamiento y descarga se hace del lado del cliente.
- **Selectores de tiempo:** Para paneles de volumen como Ventas y Usuarios, el usuario debe poder elegir si quiere la data del "Último Mes", "Año Actual" o "Histórico".
- **Formato y Alineación:** Las columnas del Excel generado deben estar ajustadas automáticamente a su contenido para una experiencia profesional (autofit de ancho).
- **Formatos Especiales:** 
  - **Horarios:** El Excel no debe ser una lista de filas transaccionales, sino una grilla visual tipo calendario (Lunes a Domingo como columnas, horas como filas).
  - **Usuarios:** Debe incluir fecha de nacimiento diferenciada de la fecha de registro/ingreso, estado de membresía activa (`memberships`), estado de inscripción de academia (`academy_enrollments`), y una hoja especial con tablas estructuradas para renderizado inmediato de gráficos de torta y barras comparativas.

## 2. Flujo de Implementación Propuesto

1. **Instalación de Dependencias**: Instalar `xlsx` (SheetJS) como motor de generación.
2. **Utilidad Global (`src/lib/excel.ts`)**: Crear la lógica que recibe arrays de objetos JSON o matrices de arreglos y crea un `Workbook`, autocalculando el `!cols` (anchos) en base al length máximo de contenido por columna, y disparando `XLSX.writeFile()`.
3. **Módulo de Ventas (`admin/ventas/page.tsx`)**:
   - Selector de tiempo (Mes, Año, Histórico).
   - Generar dos hojas: "Cartola" (Totales y métricas por medio de pago) y "Transacciones" (Lista completa del filtro).
4. **Módulo de Usuarios (`admin/usuarios/page.tsx`)**:
   - Mapeo de perfiles y cargas/dependientes con cruce a `beneficiaries`, `memberships` y `academy_enrollments`.
   - Diferenciación explícita entre `Fecha Nacimiento` (`birth_date`) y `Fecha Registro Ingreso` (`created_at`).
   - Generación de 3 hojas: "Resumen Ejecutivo", "Usuarios Detalle", y "Tablas para Gráficos" (grilla para gráficos de torta por tipo de usuario y barras de estado de planes).
5. **Módulo de Horarios (`admin/horarios/page.tsx`)**:
   - Función especial que mapea la lista de bloques de horario hacia una matriz visual (Lunes a Domingo).
6. **Módulo de Asistencia (`admin/asistencia/page.tsx`)**:
   - Mapeo de registros de asistencia con métricas de tasa de asistencia, presentes, ausentes y justificados.

## 3. Análisis de Impacto
- **Backend / DB:** El procesamiento se delega al cliente. En casos donde la data no esté precargada en el state (ej. usuarios cruzados con membresías e inscripciones), se dispara una consulta `supabase.from()` en tiempo de ejecución. No altera datos ni bloquea procesos.
- **Fechas / Zonas Horarias:** Manejado con `toLocaleDateString("es-CL")` y cadenas ISO explícitas para evitar desfases.

## 4. Estado de Implementación
**Completado y Sincronizado**. Todos los 4 paneles cuentan con sus exportaciones de Excel operativas y ajustadas.

