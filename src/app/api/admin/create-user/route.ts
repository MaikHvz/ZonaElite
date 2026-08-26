import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

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
    const { email, full_name, role_id = 4, birth_date, phone, rut } = body;

    if (!email || !full_name) {
      return NextResponse.json({ error: "Email y nombre son obligatorios" }, { status: 400 });
    }

    const password = generatePassword();
    const admin = getAdminClient();

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
