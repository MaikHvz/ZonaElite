/**
 * ZonaElite – Motor de Excel Profesional
 * Motor basado en ExcelJS con soporte completo de estilos:
 * - Cabeceras coloreadas, fuentes en negrita
 * - Filas alternadas para legibilidad
 * - Logo de empresa en cada reporte
 * - Columnas auto-ajustadas
 * - Celdas combinadas para secciones
 */
import ExcelJS from "exceljs";

// ============================================================
// PALETA DE COLORES CORPORATIVA
// ============================================================
const COLORS = {
  // Azul oscuro primario — fondo de cabeceras principales
  headerBg: "FF1A1A2E",
  headerFont: "FFFFFFFF",
  // Rojo corporativo — acento ZonaElite
  accentBg: "FFB31B1B",
  accentFont: "FFFFFFFF",
  // Gris muy oscuro — sub-cabeceras de sección
  sectionBg: "FF16213E",
  sectionFont: "FFFFFFFF",
  // Celeste suave — fila par alternada
  rowAlt: "FFF0F4FF",
  rowAltDark: "FFE4EBF5",
  // Blanco puro — fila impar
  rowWhite: "FFFFFFFF",
  // Azul grisáceo muy claro — summary
  summaryBg: "FFE8EDF8",
  // Bordes
  borderColor: "FFCCD3E0",
  // Texto normal
  textDark: "FF1A1A2E",
  textMuted: "FF5A6378",
  // Verde positivo / Rojo negativo
  positive: "FF1B8A5A",
  negative: "FFB31B1B",
};

// ============================================================
// TIPOGRAFÍA CORPORATIVA
// ============================================================
const FONT = {
  name: "Calibri",
  nameHeadline: "Calibri",
};

// ============================================================
// HELPERS DE ESTILO
// ============================================================

function headerStyle(bold = true, bgColor = COLORS.headerBg, fontColor = COLORS.headerFont): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT.nameHeadline, bold, size: 11, color: { argb: fontColor } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: COLORS.borderColor } },
      bottom: { style: "thin", color: { argb: COLORS.borderColor } },
      left: { style: "thin", color: { argb: COLORS.borderColor } },
      right: { style: "thin", color: { argb: COLORS.borderColor } },
    },
  };
}

function sectionStyle(): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT.nameHeadline, bold: true, size: 10, color: { argb: COLORS.sectionFont } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sectionBg } },
    alignment: { horizontal: "left", vertical: "middle" },
    border: {
      bottom: { style: "medium", color: { argb: COLORS.accentBg } },
    },
  };
}

function dataStyle(rowIndex: number, bold = false): Partial<ExcelJS.Style> {
  const isAlt = rowIndex % 2 === 0;
  return {
    font: { name: FONT.name, bold, size: 10, color: { argb: COLORS.textDark } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? COLORS.rowAlt : COLORS.rowWhite } },
    alignment: { horizontal: "left", vertical: "middle", wrapText: false },
    border: {
      top: { style: "hair", color: { argb: COLORS.borderColor } },
      bottom: { style: "hair", color: { argb: COLORS.borderColor } },
      left: { style: "hair", color: { argb: COLORS.borderColor } },
      right: { style: "hair", color: { argb: COLORS.borderColor } },
    },
  };
}

function kpiStyle(rowIndex: number): Partial<ExcelJS.Style> {
  const isAlt = rowIndex % 2 === 0;
  return {
    font: { name: FONT.name, size: 10, color: { argb: COLORS.textDark } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? COLORS.summaryBg : COLORS.rowWhite } },
    alignment: { horizontal: "left", vertical: "middle" },
    border: {
      top: { style: "hair", color: { argb: COLORS.borderColor } },
      bottom: { style: "hair", color: { argb: COLORS.borderColor } },
      left: { style: "hair", color: { argb: COLORS.borderColor } },
      right: { style: "hair", color: { argb: COLORS.borderColor } },
    },
  };
}

function kpiValueStyle(rowIndex: number, isPositive?: boolean): Partial<ExcelJS.Style> {
  const isAlt = rowIndex % 2 === 0;
  return {
    font: {
      name: FONT.name,
      bold: true,
      size: 11,
      color: {
        argb: isPositive === true ? COLORS.positive : isPositive === false ? COLORS.negative : COLORS.accentBg,
      },
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? COLORS.summaryBg : COLORS.rowWhite } },
    alignment: { horizontal: "right", vertical: "middle" },
    border: {
      top: { style: "hair", color: { argb: COLORS.borderColor } },
      bottom: { style: "hair", color: { argb: COLORS.borderColor } },
      left: { style: "hair", color: { argb: COLORS.borderColor } },
      right: { style: "hair", color: { argb: COLORS.borderColor } },
    },
  };
}

// ============================================================
// LOGO EMBEDDER (fetches logo from public folder)
// ============================================================
async function addLogo(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet): Promise<void> {
  try {
    const response = await fetch("/logo-black-contraste.png");
    if (!response.ok) return;
    const arrayBuffer = await response.arrayBuffer();
    const imageId = workbook.addImage({
      buffer: arrayBuffer,
      extension: "png",
    });
    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 60 },
    });
  } catch {
    // Si no hay logo disponible, continúa sin él
  }
}

// ============================================================
// CABECERA CORPORATIVA (Rows 1-5, luego datos desde Row 6)
// ============================================================
async function addCorporateHeader(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  reportTitle: string,
  subtitle: string,
  totalColumns: number
): Promise<void> {
  // Row 1: Logo row (height para el logo)
  const logoRow = worksheet.getRow(1);
  logoRow.height = 50;

  // Row 2: Título del reporte
  const titleRow = worksheet.getRow(2);
  titleRow.height = 28;
  const titleCell = worksheet.getCell("A2");
  titleCell.value = `⬡ ZONA ELITE — ${reportTitle.toUpperCase()}`;
  titleCell.style = {
    font: { name: FONT.nameHeadline, bold: true, size: 16, color: { argb: COLORS.headerFont } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } },
    alignment: { horizontal: "center", vertical: "middle" },
  };
  worksheet.mergeCells(2, 1, 2, totalColumns);

  // Row 3: Subtítulo
  const subtitleRow = worksheet.getRow(3);
  subtitleRow.height = 18;
  const subtitleCell = worksheet.getCell("A3");
  subtitleCell.value = subtitle;
  subtitleCell.style = {
    font: { name: FONT.name, italic: true, size: 10, color: { argb: COLORS.headerFont } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.accentBg } },
    alignment: { horizontal: "center", vertical: "middle" },
  };
  worksheet.mergeCells(3, 1, 3, totalColumns);

  // Row 4: Metadata row
  const now = new Date();
  const metaRow = worksheet.getRow(4);
  metaRow.height = 16;
  const metaCell = worksheet.getCell("A4");
  metaCell.value = `Generado: ${now.toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}   |   Sistema ZonaElite`;
  metaCell.style = {
    font: { name: FONT.name, italic: true, size: 9, color: { argb: COLORS.textMuted } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF8" } },
    alignment: { horizontal: "right", vertical: "middle" },
  };
  worksheet.mergeCells(4, 1, 4, totalColumns);

  // Row 5: Spacer
  const spacer = worksheet.getRow(5);
  spacer.height = 6;

  // Embed logo (Row 1, Col A)
  await addLogo(workbook, worksheet);
}

// ============================================================
// AUTOFIT COLUMNS
// ============================================================
function autofitColumns(worksheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 50): void {
  worksheet.columns.forEach((column) => {
    if (!column) return;
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : "";
      if (val.length > maxLen) maxLen = val.length;
    });
    column.width = Math.min(maxLen + 2, maxWidth);
  });
}

// ============================================================
// PAGINACIÓN DE DATOS — Tabla de datos con cabeceras
// ============================================================
function writeDataTable(
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  rows: Record<string, any>[],
  startRow: number
): number {
  // Cabecera de tabla
  const headerRow = worksheet.getRow(startRow);
  headerRow.height = 22;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.style = headerStyle();
  });

  // Filas de datos
  let currentRow = startRow + 1;
  rows.forEach((rowData, idx) => {
    const row = worksheet.getRow(currentRow);
    row.height = 18;
    headers.forEach((h, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = rowData[h] ?? rowData[Object.keys(rowData)[colIdx]] ?? "—";
      cell.style = dataStyle(idx);
    });
    currentRow++;
  });

  return currentRow;
}

// ============================================================
// BLOQUE KPI — Pares clave-valor en un bloque resumen
// ============================================================
function writeKpiBlock(
  worksheet: ExcelJS.Worksheet,
  title: string,
  kpis: [string, string | number, boolean?][],
  startRow: number,
  totalColumns: number
): number {
  // Título del bloque
  const titleRow = worksheet.getRow(startRow);
  titleRow.height = 20;
  const titleCell = worksheet.getCell(startRow, 1);
  titleCell.value = `  ${title}`;
  titleCell.style = sectionStyle();
  worksheet.mergeCells(startRow, 1, startRow, totalColumns);
  startRow++;

  // KPI rows
  kpis.forEach(([label, value, isPositive], idx) => {
    const row = worksheet.getRow(startRow);
    row.height = 20;

    const labelCell = row.getCell(1);
    labelCell.value = `  ${label}`;
    labelCell.style = kpiStyle(idx);
    worksheet.mergeCells(startRow, 1, startRow, Math.max(1, totalColumns - 1));

    const valueCell = row.getCell(totalColumns);
    valueCell.value = value;
    valueCell.style = kpiValueStyle(idx, isPositive);

    startRow++;
  });

  // Spacer row
  worksheet.getRow(startRow).height = 8;
  return startRow + 1;
}

// ============================================================
// TIPO EXPORTABLE
// ============================================================
export interface ProfessionalSheetConfig {
  sheetName: string;
  reportTitle: string;
  subtitle: string;
  /** KPI blocks shown before the main data table */
  kpiBlocks?: { title: string; rows: [string, string | number, boolean?][] }[];
  /** Main data table — array of flat objects */
  tableData?: Record<string, any>[];
  /** Raw matrix (for visual grids like schedules) */
  matrixData?: (string | number | null)[][];
  /** Custom column widths override (in chars) */
  columnWidths?: number[];
}

// ============================================================
// EXPORTADOR PRINCIPAL
// ============================================================
export async function exportProfessionalExcel(
  sheets: ProfessionalSheetConfig[],
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZonaElite Sistema";
  workbook.lastModifiedBy = "ZonaElite Admin";
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const config of sheets) {
    const worksheet = workbook.addWorksheet(config.sheetName, {
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
      headerFooter: {
        oddFooter: `&CZonaElite — ${config.reportTitle} &P/&N &R&D`,
      },
      properties: { defaultRowHeight: 18 },
    });

    // Determinar número de columnas
    let numCols = 2;
    if (config.tableData && config.tableData.length > 0) {
      numCols = Object.keys(config.tableData[0]).length;
    } else if (config.matrixData && config.matrixData.length > 0) {
      numCols = Math.max(...config.matrixData.map((r) => r.length));
    }
    numCols = Math.max(numCols, 6); // Mínimo 6 columnas para que el header quede bien

    // Cabecera corporativa (rows 1-5)
    await addCorporateHeader(workbook, worksheet, config.reportTitle, config.subtitle, numCols);

    let currentRow = 6;

    // KPI Blocks
    if (config.kpiBlocks && config.kpiBlocks.length > 0) {
      for (const block of config.kpiBlocks) {
        currentRow = writeKpiBlock(worksheet, block.title, block.rows, currentRow, numCols);
      }
      // Spacer before data table
      worksheet.getRow(currentRow).height = 10;
      currentRow++;
    }

    // Main data table
    if (config.tableData && config.tableData.length > 0) {
      const headers = Object.keys(config.tableData[0]);
      currentRow = writeDataTable(worksheet, headers, config.tableData, currentRow);
    }

    // Matrix (visual grid like schedules)
    if (config.matrixData && config.matrixData.length > 0) {
      config.matrixData.forEach((rowData, rowIdx) => {
        const isHeader = rowIdx === 0;
        const exRow = worksheet.getRow(currentRow + rowIdx);
        exRow.height = isHeader ? 22 : 18;
        rowData.forEach((val, colIdx) => {
          const cell = exRow.getCell(colIdx + 1);
          cell.value = val ?? "";
          if (isHeader) {
            cell.style = headerStyle();
          } else if (colIdx === 0) {
            // First col = time label
            cell.style = {
              font: { name: FONT.name, bold: true, size: 9, color: { argb: COLORS.headerFont } },
              fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sectionBg } },
              alignment: { horizontal: "center", vertical: "middle" },
              border: {
                right: { style: "thin", color: { argb: COLORS.borderColor } },
              },
            };
          } else {
            const hasContent = val && String(val).trim() !== "";
            cell.style = {
              font: { name: FONT.name, size: 9, bold: !!hasContent, color: { argb: hasContent ? COLORS.accentBg : COLORS.textMuted } },
              fill: {
                type: "pattern", pattern: "solid",
                fgColor: { argb: hasContent ? (rowIdx % 2 === 0 ? "FFFFF0F0" : "FFFFFFFF") : (rowIdx % 2 === 0 ? COLORS.rowAlt : COLORS.rowWhite) },
              },
              alignment: { horizontal: "center", vertical: "middle", wrapText: true },
              border: {
                top: { style: "hair", color: { argb: COLORS.borderColor } },
                bottom: { style: "hair", color: { argb: COLORS.borderColor } },
                left: { style: "hair", color: { argb: COLORS.borderColor } },
                right: { style: "hair", color: { argb: COLORS.borderColor } },
              },
            };
          }
        });
      });
    }

    // Apply column widths
    if (config.columnWidths) {
      config.columnWidths.forEach((w, i) => {
        if (worksheet.getColumn(i + 1)) {
          worksheet.getColumn(i + 1).width = w;
        }
      });
    } else {
      autofitColumns(worksheet);
    }

    // Freeze header rows + data table header
    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 7 }];
  }

  // Generate and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// COMPATIBILIDAD LEGADA (para páginas que usen la API antigua)
// ============================================================
export interface ExcelSheetData {
  sheetName: string;
  data: any[];
  skipHeader?: boolean;
}

/** @deprecated Use exportProfessionalExcel instead */
export async function exportMultipleSheetsToExcel(sheets: ExcelSheetData[], filename: string): Promise<void> {
  const profSheets: ProfessionalSheetConfig[] = sheets.map((s) => {
    const isMatrix = s.data.length > 0 && Array.isArray(s.data[0]);
    return {
      sheetName: s.sheetName,
      reportTitle: s.sheetName,
      subtitle: `Reporte ZonaElite — ${new Date().toLocaleDateString("es-CL")}`,
      ...(isMatrix ? { matrixData: s.data } : { tableData: s.data }),
    };
  });
  await exportProfessionalExcel(profSheets, filename);
}

/** @deprecated Use exportProfessionalExcel instead */
export async function exportToExcel(data: any[], filename: string, sheetName = "Datos"): Promise<void> {
  await exportMultipleSheetsToExcel([{ sheetName, data }], filename);
}
