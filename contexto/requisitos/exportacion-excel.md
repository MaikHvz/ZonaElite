# Funcionalidad de Exportación a Excel

## 1. Explicación Profunda del Requisito
Se requiere la capacidad de descargar directamente en el navegador un archivo Excel estructurado (formato `.xlsx`) desde los paneles administrativos principales (Ventas, Usuarios, Asistencia, Horarios, etc.).

**Roles impactados:**
- **Admin/Staff:** Pueden extraer informes visuales o de base de datos para análisis externo o entrega a contabilidad, visualizando datos como ingresos totales, listas de alumnos con membresías activas, mallas de horarios en formato visual, etc.

**Reglas de negocio:**
- **Directo en cliente:** No se deben generar archivos transitorios en el servidor de Node.js ni guardar en bases de datos. Todo el procesamiento y descarga se hace del lado del cliente.
- **Selectores de tiempo:** Para paneles de volumen como Ventas, el usuario debe poder elegir si quiere la data del "Último Mes", "Año Actual" o "Histórico".
- **Formato y Alineación:** Las columnas del Excel generado deben estar ajustadas automáticamente a su contenido para una experiencia profesional (autofit de ancho).
- **Formatos Especiales:** Para Horarios, el Excel no debe ser una lista de filas transaccionales, sino una grilla visual tipo calendario (Lunes a Domingo).

## 2. Flujo de Implementación Propuesto

1. **Instalación de Dependencias**: Instalar `xlsx` (SheetJS) como motor de generación.
2. **Utilidad Global (`src/lib/excel.ts`)**: Crear la lógica que recibe arrays de objetos JSON y crea un `Workbook`, autocalculando el `!cols` (anchos) en base al length máximo de contenido por columna, y disparando `XLSX.writeFile()`.
3. **Módulo de Ventas (`admin/ventas/page.tsx`)**:
   - Crear un dropdown de exportación para (Último Mes, Este Año, Histórico).
   - Generar dos hojas: "Cartola" (Totales y métricas de lo filtrado) y "Transacciones" (Lista completa del filtro).
4. **Módulo de Usuarios (`admin/usuarios/page.tsx`)**:
   - Descarga del listado con cruce en tiempo real hacia las `memberships` activas.
5. **Módulo de Horarios (`admin/horarios/page.tsx`)**:
   - Función especial que mapea el array plano de clases hacia una matriz (Lunes, Martes, Miércoles...) en celdas de Excel.
6. **Módulo de Asistencia**:
   - Listado plano exportable.

## 3. Análisis de Impacto
- **Backend / DB:** El procesamiento se delega al cliente. En casos donde la data no esté precargada en el state (ej. usuarios cruzados con membresías), se disparará un fetch on-demand específico, pero el volumen se restringe con filtros. No se altera la integridad de los datos.
- **Bundle Size:** Se incrementa ligeramente por la librería `xlsx`, la cual es cargada `use client`.

## 4. Estado Actual
En progreso.
