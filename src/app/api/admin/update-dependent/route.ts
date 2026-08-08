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
      return NextResponse.json({ error: "Solo administradores pueden editar cargas" }, { status: 403 });
    }

    const body = await request.json();
    const { dependent_id, full_name, rut, birth_date, category } = body;

    if (!dependent_id || !full_name || !birth_date) {
      return NextResponse.json({ error: "Carga, nombre y fecha de nacimiento son obligatorios" }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: dependent, error: updateError } = await admin
      .from("dependents")
      .update({
        full_name: full_name.trim(),
        rut: rut?.trim() || null,
        birth_date,
        category,
      })
      .eq("id", dependent_id)
      .select("id, tutor_id, full_name, rut, birth_date, category, created_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin.from("audit_logs").insert({
      user_id: sessionUser.id,
      action: "update_dependent",
      entity: "dependents",
      entity_id: dependent.id,
      metadata: { full_name: dependent.full_name, category },
    });

    return NextResponse.json({ dependent });
  } catch (err) {
    console.error("[UPDATE-DEPENDENT] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
