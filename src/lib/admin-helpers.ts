export function getSupabaseErrorMessage(error: unknown, action?: string): string {
  if (!error) return action ? `${action}: Error desconocido` : "Error desconocido";

  const err = error as { message?: string; code?: string; details?: string };

  if (err.code === "23505") return action ? `${action}: Ya existe un registro similar` : "Ya existe un registro similar";
  if (err.code === "23503") return action ? `${action}: No se puede eliminar, está referenciado por otros datos` : "No se puede eliminar, está referenciado por otros datos";
  if (err.code === "42501") return action ? `${action}: No tienes permisos para esta acción` : "No tienes permisos para esta acción";

  if (err.message) return action ? `${action}: ${err.message}` : err.message;

  return action ? `${action}: Error al guardar` : "Error al guardar";
}
