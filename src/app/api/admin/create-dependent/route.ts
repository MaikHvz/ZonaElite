import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = ["nino", "adulto"];

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
      return NextResponse.json({ error: "Solo administradores pueden crear cargas" }, { status: 403 });
    }

    const body = await request.json();
    const { tutor_id, full_name, rut, birth_date, category } = body;

    if (!tutor_id || !full_name || !birth_date) {
      return NextResponse.json({ error: "Tutor, nombre y fecha de nacimiento son obligatorios" }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: tutor } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", tutor_id)
      .maybeSingle();

    if (!tutor) {
      return NextResponse.json({ error: "El tutor seleccionado no existe" }, { status: 400 });
    }

    const { data: dependent, error: insertError } = await admin
      .from("dependents")
      .insert({
        tutor_id,
        full_name: full_name.trim(),
        rut: rut?.trim() || null,
        birth_date,
        category,
      })
      .select("id, tutor_id, full_name, rut, birth_date, category, created_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const { data: existingBeneficiary } = await admin
      .from("beneficiaries")
      .select("id")
      .eq("dependent_id", dependent.id)
      .maybeSingle();

    if (!existingBeneficiary) {
      await admin.from("beneficiaries").insert({
        dependent_id: dependent.id,
        profile_id: null,
      });
    }

    await admin.from("audit_logs").insert({
      user_id: sessionUser.id,
      action: "create_dependent",
      entity: "dependents",
      entity_id: dependent.id,
      metadata: { tutor_id, tutor_name: tutor.full_name, full_name: dependent.full_name, category },
    });

    return NextResponse.json({ dependent });
  } catch (err) {
    console.error("[CREATE-DEPENDENT] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
