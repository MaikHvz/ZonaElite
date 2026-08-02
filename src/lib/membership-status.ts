/**
 * Estado efectivo de una membresía.
 *
 * La regla de negocio: una membresía "vence" cuando su `end_date` es anterior a
 * la fecha actual de Chile, independientemente del valor literal de `status`
 * (que permanece en "activa" porque nada lo cambia automáticamente).
 *
 * `status` literal `"cancelada"` se respeta siempre. El resto se deriva por fecha.
 */

export type EffectiveMembershipStatus = "activa" | "vencida" | "cancelada";

export function effectiveMembershipStatus(
  status: string | null | undefined,
  endDate: string | null | undefined,
  today: string
): EffectiveMembershipStatus {
  if (status === "cancelada") return "cancelada";
  if (status === "vencida") return "vencida";
  if (!endDate) return "vencida";
  if (endDate < today) return "vencida";
  return "activa";
}

export function isMembershipExpired(
  status: string | null | undefined,
  endDate: string | null | undefined,
  today: string
): boolean {
  return effectiveMembershipStatus(status, endDate, today) === "vencida";
}

/**
 * Días de calendario restantes entre `today` y `endDate` (ambos "YYYY-MM-DD").
 * Usa mediodía UTC como ancla para evitar errores de DST. 0 si ya venció.
 */
export function daysRemaining(endDate: string | null | undefined, today: string): number {
  if (!endDate) return 0;
  const end = new Date(endDate + "T12:00:00").getTime();
  const start = new Date(today + "T12:00:00").getTime();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}
