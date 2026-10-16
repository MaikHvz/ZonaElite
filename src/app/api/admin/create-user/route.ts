import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { isValidRut, formatRut } from "@/lib/rut";

interface AccountConflict {
  profile_id: string;
  full_name: string;
  email: string;
  match: "rut" | "email" | "name_birth";
}

// El admin ve a quién corresponde la coincidencia, sin exponer el correo completo.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function POST(request: Request) {
  try {
    const server = await createClient();
    const { data: { user: sessionUser }, error: authError } = await server.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await server
      .from("profiles")
      .select("role_id")
      .eq("id", sessionUser.id)
      .single();

    if (!profile || profile.role_id !== 1) {
      return NextResponse.json({ error: "Solo administradores pueden crear usuarios" }, { status: 403 });
    }

    const body = await request.json();
    const { email, full_name, role_id = 4, birth_date, phone, force = false } = body;
    let { rut } = body;

    if (!email || !full_name) {
      return NextResponse.json({ error: "Email y nombre son obligatorios" }, { status: 400 });
    }

    if (rut) {
      if (!isValidRut(rut)) {
        return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
      }
      rut = formatRut(rut);
    }

    const admin = getAdminClient();

    // Una cuenta por persona (migración 037): mismo RUT o correo
    // equivalente (Gmail ignora puntos y "+etiqueta") bloquean; mismo
    // nombre y fecha de nacimiento es advertencia que el admin puede forzar.
    const { data: conflictRows, error: conflictError } = await admin.rpc("find_account_conflicts", {
      p_rut: rut || null,
      p_email: email,
      p_full_name: full_name,
      p_birth_date: birth_date || null,
    });

    if (conflictError) {
      console.error("[CREATE-USER] Conflict check failed:", conflictError);
      return NextResponse.json({ error: "No se pudo verificar si la cuenta ya existe" }, { status: 500 });
    }

    const conflicts = ((conflictRows || []) as AccountConflict[]).map((c) => ({
      profileId: c.profile_id,
      fullName: c.full_name,
      email: maskEmail(c.email),
      match: c.match,
    }));
    const blocking = conflicts.filter((c) => c.match === "rut" || c.match === "email");

    if (blocking.length > 0) {
      const byRut = blocking.some((c) => c.match === "rut");
      return NextResponse.json(
        {
          error: byRut
            ? "Ya existe una cuenta con este RUT"
            : "Ya existe una cuenta con este correo (o uno equivalente)",
          conflicts: blocking,
        },
        { status: 409 }
      );
    }

    if (conflicts.length > 0 && !force) {
      return NextResponse.json(
        {
          error: "Hay una cuenta con el mismo nombre y fecha de nacimiento",
          warning: true,
          conflicts,
        },
        { status: 409 }
      );
    }

    const password = generatePassword();

    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!authUser?.user) {
      return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 });
    }

    const userId = authUser.user.id;

    const profileUpdate: Record<string, unknown> = {};
    if (role_id !== 4) profileUpdate.role_id = role_id;
    if (birth_date) profileUpdate.birth_date = birth_date;
    if (phone) profileUpdate.phone = phone;
    if (rut) profileUpdate.rut = rut;

    if (Object.keys(profileUpdate).length > 0) {
      await admin.from("profiles").update(profileUpdate).eq("id", userId);
    }

    const { data: existingBeneficiary } = await admin
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (!existingBeneficiary) {
      await admin.from("beneficiaries").insert({
        profile_id: userId,
        dependent_id: null,
      });
    }

    try {
      await sendWelcomeEmail(email, full_name, password);
    } catch (emailError) {
      console.error("[CREATE-USER] Email failed but user was created:", emailError);
    }

    await admin.from("audit_logs").insert({
      user_id: sessionUser.id,
      action: "create_user",
      entity: "profiles",
      entity_id: userId,
      metadata: { email, full_name, role_id, birth_date: birth_date || null, phone: phone || null, rut: rut || null, method: "admin_create" },
    });

    return NextResponse.json({
      user: { id: userId, email, full_name },
      tempPassword: password,
    });
  } catch (err) {
    console.error("[CREATE-USER] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
