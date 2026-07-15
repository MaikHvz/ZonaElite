import { createClient } from "./client";
import type { AuthError } from "@supabase/supabase-js";

function friendlyError(error: AuthError | unknown): string {
  if (!error || typeof error !== "object") return "Error de conexión. Intenta nuevamente.";
  const msg = (error as AuthError).message ?? String(error);
  const code = (error as AuthError).code ?? "";

  console.log("Supabase error:", { message: msg, code, status: (error as AuthError).status });

  if (msg.includes("Invalid login")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "Cuenta no confirmada. Revisa tu correo.";
  if (msg.includes("User already registered")) return "Este correo ya está registrado.";
  if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("Unable to validate email address")) return "Ingresa un correo válido.";
  if (msg.includes("signup_disabled")) return "El registro está deshabilitado temporalmente.";
  if (msg.includes("over_request_rate_limit")) return "Demasiadas solicitudes. Intenta en unos minutos.";
  if (msg.includes("database")) return "Error de base de datos. Contacta al administrador.";
  if (code === "email_address_invalid") return "Ingresa un correo válido.";

  return msg || "Ha ocurrido un error. Intenta nuevamente.";
}

export async function signUp(email: string, password: string, name: string) {
  console.log("signUp called:", { email, name });
  const supabase = createClient();
  console.log("supabase client created");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  console.log("signUp result:", { error: error?.message, userId: data?.user?.id });
  if (error) {
    console.error("signUp error:", error);
    throw new Error(friendlyError(error));
  }
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
