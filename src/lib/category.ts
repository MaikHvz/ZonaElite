import { getChileToday } from "./dates.ts";

export type StudentCategory = "nino" | "juvenil" | "adulto";

/**
 * Categoría del alumno según su edad en la fecha de Chile:
 * nino < 10, juvenil 10–15, adulto >= 16 (misma regla que
 * compute_category_from_birth() en la BD). Sin fecha → adulto.
 *
 * Con una cuenta por alumno (sin cargas) la categoría ya no sale de
 * dependents.category: se deriva de profiles.birth_date.
 */
export function categoryFromBirth(
  birthDate: string | null | undefined,
  today: string = getChileToday()
): StudentCategory {
  if (!birthDate) return "adulto";
  const [by, bm, bd] = birthDate.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !ty) return "adulto";
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  if (age < 10) return "nino";
  if (age < 16) return "juvenil";
  return "adulto";
}

export function categoryLabel(category: string | null | undefined): string {
  if (category === "nino") return "Niño";
  if (category === "juvenil") return "Juvenil";
  return "Adulto";
}

/** Categorías de `schedules.category`, en orden de edad. */
export const SCHEDULE_CATEGORIES = ["ninos", "juveniles", "adultos"] as const;

export function scheduleCategoryLabel(category: string): string {
  if (category === "ninos") return "Niños";
  if (category === "juveniles") return "Juveniles";
  if (category === "adultos") return "Adultos";
  return category;
}

/** Ordena (niños → juveniles → adultos) y quita duplicados de `schedules.category`. */
export function sortScheduleCategories(
  categories: string[] | string | null | undefined
): string[] {
  const list = Array.isArray(categories) ? categories : categories ? [categories] : [];
  const order = (c: string) => {
    const i = (SCHEDULE_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? SCHEDULE_CATEGORIES.length : i;
  };
  return [...new Set(list)].sort((a, b) => order(a) - order(b));
}

/** schedules.category usa plurales ('ninos' | 'juveniles' | 'adultos'). */
export function categoryToPlural(category: string): string {
  if (category === "nino") return "ninos";
  if (category === "juvenil") return "juveniles";
  return "adultos";
}
