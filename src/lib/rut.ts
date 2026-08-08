export function normalizeRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function isValidRut(value: string): boolean {
  const normalized = normalizeRut(value);
  if (!normalized || normalized.length < 2) return false;

  const bodyStr = normalized.slice(0, -1);
  const dv = normalized.slice(-1);

  if (!/^\d{1,8}$/.test(bodyStr)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;

  const body = Number(bodyStr);
  if (body < 1000000 || body > 25000000) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = bodyStr.length - 1; i >= 0; i--) {
    sum += Number(bodyStr[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const mod = sum % 11;
  const expected = 11 - mod;
  const expectedDv = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);

  return expectedDv === dv;
}

export function formatRut(value: string): string {
  const normalized = normalizeRut(value);
  if (!normalized) return "";
  const dv = normalized.slice(-1);
  const body = normalized.slice(0, -1);
  if (!body) return dv;
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
