import * as XLSX from "xlsx";

/**
 * Calculates the maximum width of each column and sets it in the worksheet `!cols` property.
 */
function autofitColumns(ws: XLSX.WorkSheet, data: any[], headers: string[]) {
  const colWidths = headers.map((h) => ({ wch: h.length }));

  data.forEach((row) => {
    headers.forEach((h, i) => {
      const val = row[h];
      const strVal = val !== null && val !== undefined ? val.toString() : "";
      if (strVal.length > colWidths[i].wch) {
        colWidths[i].wch = strVal.length + 2; // +2 for padding
      }
    });
  });

  // Limit max width to prevent absurdly wide columns
  colWidths.forEach((col) => {
    if (col.wch > 80) col.wch = 80;
  });

  ws["!cols"] = colWidths;
}

/**
 * Exports a basic flat JSON array to an Excel file with one sheet, applying autofit.
 */
export function exportToExcel(data: any[], filename: string, sheetName = "Datos") {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const ws = XLSX.utils.json_to_sheet(data);
  autofitColumns(ws, data, headers);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export interface ExcelSheetData {
  sheetName: string;
  data: any[];
  skipHeader?: boolean;
}

/**
 * Exports multiple sheets, handling optional array of arrays for structural grids like Cartola or Schedules.
 */
export function exportMultipleSheetsToExcel(sheets: ExcelSheetData[], filename: string) {
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    // If the data is an array of arrays (custom matrix), use aoa_to_sheet
    // If it's an array of objects, use json_to_sheet
    const isMatrix = sheet.data.length > 0 && Array.isArray(sheet.data[0]);
    const ws = isMatrix
      ? XLSX.utils.aoa_to_sheet(sheet.data)
      : XLSX.utils.json_to_sheet(sheet.data, { skipHeader: sheet.skipHeader });

    if (!isMatrix && sheet.data.length > 0) {
      const headers = Object.keys(sheet.data[0]);
      autofitColumns(ws, sheet.data, headers);
    } else if (isMatrix && sheet.data.length > 0) {
      // Basic autofit for matrices
      const maxCols = Math.max(...sheet.data.map(r => r.length));
      const colWidths = Array(maxCols).fill({ wch: 10 });
      
      sheet.data.forEach((row) => {
        row.forEach((cell: any, i: number) => {
          const strVal = cell !== null && cell !== undefined ? cell.toString() : "";
          if (strVal.length > (colWidths[i]?.wch || 0)) {
            colWidths[i] = { wch: strVal.length + 2 };
          }
        });
      });
      
      colWidths.forEach((col) => {
        if (col.wch > 80) col.wch = 80;
      });
      
      ws["!cols"] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
