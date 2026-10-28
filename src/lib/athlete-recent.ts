// Perfiles visitados recientemente (como las búsquedas recientes de
// Instagram). Solo en este dispositivo: localStorage puede fallar o
// estar vacío, así que todo va en try/catch.

export interface RecentAthlete {
  alias: string;
  full_name: string;
  grade_color: string | null;
  avatar_key?: string | null;
}

const KEY = "zonaelite:atletas-recientes";
const MAX = 8;

export function getRecentAthletes(): RecentAthlete[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentAthlete[]) : [];
    return Array.isArray(list) ? list.filter((a) => a && typeof a.alias === "string") : [];
  } catch {
    return [];
  }
}

function save(list: RecentAthlete[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // almacenamiento no disponible: se omite
  }
}

export function rememberRecentAthlete(athlete: RecentAthlete) {
  const list = getRecentAthletes().filter((a) => a.alias !== athlete.alias);
  save([athlete, ...list].slice(0, MAX));
}

export function forgetRecentAthlete(alias: string): RecentAthlete[] {
  const list = getRecentAthletes().filter((a) => a.alias !== alias);
  save(list);
  return list;
}

export function clearRecentAthletes() {
  save([]);
}
