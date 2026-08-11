// ============================================================
// Perfil deportivo de alumnos — tipos, catálogos y helpers
// centralizados. El color del cinturón proviene de la BD
// (belt_grades.color): ningún componente debe repetir
// `if (grade === "amarillo") ...`.
// ============================================================

// ---- Tipos que reflejan el embed de Supabase ----------------

export interface DisciplineRef {
  id: string;
  name: string;
  color_hex: string;
}

export interface BeltGradeRef {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface SportProfileData {
  id: string;
  beneficiary_id: string;
  discipline_id: string | null;
  grade_id: string | null;
  disciplines: DisciplineRef | null;
  belt_grades: BeltGradeRef | null;
}

export interface SportPodiumData {
  id: string;
  beneficiary_id: string;
  tournament: string;
  event_date: string;
  discipline_id: string | null;
  category: string | null;
  position: string;
  description: string | null;
  image_url: string | null;
  disciplines?: { id: string; name: string } | null;
}

// ---- Catálogos centralizados --------------------------------

export type PodiumPosition = "1" | "2" | "3" | "participacion";

export const PODIUM_POSITIONS: {
  value: PodiumPosition;
  label: string;
  emoji: string;
}[] = [
  { value: "1", label: "1° Lugar", emoji: "🥇" },
  { value: "2", label: "2° Lugar", emoji: "🥈" },
  { value: "3", label: "3° Lugar", emoji: "🥉" },
  { value: "participacion", label: "Participación", emoji: "🎖️" },
];

// Categorías sugeridas (texto libre en BD, ampliable sin tocar código).
export const SUGGESTED_CATEGORIES = [
  "Adultos",
  "Juvenil",
  "Infantil",
  "Principiantes",
  "Avanzados",
  "Kata",
  "Combate",
  "-60 kg",
  "-70 kg",
  "-80 kg",
];

// ---- Helpers ------------------------------------------------

export function podiumPositionMeta(position: string) {
  return (
    PODIUM_POSITIONS.find((p) => p.value === position) || {
      value: position,
      label: position,
      emoji: "🎖️",
    }
  );
}

export interface PodiumStats {
  total: number;
  first: number;
  second: number;
  third: number;
  participations: number;
}

// Estadísticas calculadas en runtime a partir de los registros;
// nunca se persisten como columnas (evita inconsistencias).
export function computePodiumStats(
  podiums: Pick<SportPodiumData, "position">[]
): PodiumStats {
  let first = 0;
  let second = 0;
  let third = 0;
  let participations = 0;
  for (const p of podiums) {
    if (p.position === "1") first++;
    else if (p.position === "2") second++;
    else if (p.position === "3") third++;
    else participations++;
  }
  return {
    total: podiums.length,
    first,
    second,
    third,
    participations,
  };
}

// Fecha en formato chileno corto (dd/mm/aaaa).
export function formatPodiumDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Ordena podios por fecha descendente (más recientes primero).
export function sortPodiumsByDateAsc(podiums: SportPodiumData[]): SportPodiumData[] {
  return [...podiums].sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export function sortPodiumsByDateDesc(podiums: SportPodiumData[]): SportPodiumData[] {
  return [...podiums].sort((a, b) => b.event_date.localeCompare(a.event_date));
}
