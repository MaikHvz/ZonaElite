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

/**
 * Offset de Chile en minutos para una fecha "YYYY-MM-DD".
 * Usa mediodía UTC como probe para evitar ambigüedad en transiciones DST.
 */
function chileOffsetAt(dateStr: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(dateStr + "T12:00:00Z"));
  const name =
    parts.find((p) => p.type === "timeZoneName")?.value || "GMT-04:00";
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return -240;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Instante UTC (ISO) correspondiente a la medianoche de Chile del día `dateStr`.
 * DST-aware. Úsalo al comparar columnas TIMESTAMPTZ contra límites de fecha chilena.
 */
export function chileDateToUtc(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - chileOffsetAt(dateStr) * 60000).toISOString();
}

/** Primer día del mes de Chile actual ("YYYY-MM-01"). */
export function chileMonthStartDate(): string {
  return getChileToday().slice(0, 8) + "01";
}

/** Último día del mes de Chile actual. */
export function chileMonthEndDate(): string {
  const [y, m] = getChileToday().split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

/** Primer día del mes anterior (Chile). */
export function chilePrevMonthStartDate(): string {
  return addDaysChile(chileMonthStartDate(), -15).slice(0, 8) + "01";
}

/** Último día del mes anterior (Chile). */
export function chilePrevMonthEndDate(): string {
  return addDaysChile(chileMonthStartDate(), -1);
}

/** Primer día del mes siguiente (Chile). */
export function chileNextMonthStartDate(): string {
  return addDaysChile(chileMonthEndDate(), 1);
}

/** Primer día del trimestre de Chile actual. */
export function chileQuarterStartDate(): string {
  const [y, m] = getChileToday().split("-").map(Number);
  const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(qStartMonth).padStart(2, "0")}-01`;
}

/** Último día del trimestre de Chile actual. */
export function chileQuarterEndDate(): string {
  const [y, m] = getChileToday().split("-").map(Number);
  const qEndMonth = Math.floor((m - 1) / 3) * 3 + 3;
  const last = new Date(Date.UTC(y, qEndMonth, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

/** Primer día del mes, `monthsBack` meses atrás desde hoy (Chile). */
export function chileMonthsBackStart(monthsBack: number): string {
  const [y, m] = getChileToday().split("-").map(Number);
  const total = y * 12 + (m - 1) - monthsBack;
  const yy = Math.floor(total / 12);
  const mm = total % 12 + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/** Mes ("YYYY-MM") de Chile al que pertenece un timestamp ISO. */
export function chileMonthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: CHILE_TZ }).slice(0, 7);
}
