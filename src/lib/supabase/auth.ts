import { createClient } from "./client";
import type { AuthError } from "@supabase/supabase-js";

function friendlyError(error: AuthError | unknown): string {
  if (!error || typeof error !== "object") return "Error de conexión. Intenta nuevamente.";
  const msg = (error as AuthError).message ?? String(error);
  const code = (error as AuthError).code ?? "";

  if (msg.includes("Invalid login")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "Cuenta no confirmada. Revisa tu correo.";
  if (msg.includes("User already registered")) return "Este correo ya está registrado.";
  if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("Unable to validate email address")) return "Ingresa un correo válido.";
  if (msg.includes("signup_disabled")) return "El registro está deshabilitado temporalmente.";
  if (msg.includes("over_request_rate_limit")) return "Demasiadas solicitudes. Intenta en unos minutos.";
  // El alta falla en handle_new_user() si el RUT o el correo ya existen
  // (índices únicos de la migración 037); Supabase lo reporta así.
  if (msg.includes("Database error saving new user")) {
    return "Ya existe una cuenta con este RUT o correo. Si es tuya, recupera tu contraseña.";
  }
  if (msg.includes("database")) return "Error de base de datos. Contacta al administrador.";
  if (code === "email_address_invalid") return "Ingresa un correo válido.";

  return msg || "Ha ocurrido un error. Intenta nuevamente.";
}

export type RegistrationConflict = "RUT_TAKEN" | "EMAIL_TAKEN" | null;

// Pre-chequeo del registro: una cuenta por persona (migración 037).
// Solo devuelve un código, nunca datos de la cuenta existente.
export async function checkRegistrationConflict(rut: string, email: string): Promise<RegistrationConflict> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_registration_conflict", {
    p_rut: rut,
    p_email: email,
  });
  if (error) return null;
  return (data as RegistrationConflict) ?? null;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  extra: { rut: string; birthDate: string }
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // handle_new_user() copia rut y birth_date al perfil.
    options: { data: { full_name: name, rut: extra.rut, birth_date: extra.birthDate } },
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function resetPassword(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/update-password`,
  });
  if (error) throw new Error(friendlyError(error));
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyError(error));
}
