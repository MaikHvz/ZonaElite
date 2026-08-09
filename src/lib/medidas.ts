export function normalizeMedida(value: string): string {
  return value.trim().replace(",", ".");
}

export function parseMedida(value: string): number | null {
  const normalized = normalizeMedida(value);
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function isValidPeso(value: string): boolean {
  const n = parseMedida(value);
  return n !== null && n > 0 && n <= 300;
}

export function isValidAltura(value: string): boolean {
  const n = parseMedida(value);
  return n !== null && n > 0 && n <= 250;
}

export function isValidDominantHand(value: string): boolean {
  return value === "diestro" || value === "zurdo";
}
