const CHILE_TZ = "America/Santiago";

/**
 * Retorna la fecha actual en zona horaria de Chile como "YYYY-MM-DD".
 * Usa "en-CA" locale que formatea en ISO YYYY-MM-DD.
 */
export function getChileToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: CHILE_TZ });
}

/**
 * Suma días a una fecha string "YYYY-MM-DD" y retorna el resultado como "YYYY-MM-DD".
 * Usa mediodía para evitar problemas de DST.
 */
export function addDaysChile(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
