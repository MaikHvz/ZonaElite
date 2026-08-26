import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_CATEGORIES = ["nino", "juvenil", "adulto"];

function computeCategoryFromBirth(birthDate: string): string {
  const birth = new Date(birthDate + "T12:00:00");
  const now = new Date();
  const ageMs = now.getTime() - birth.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 10) return "nino";
  if (ageYears < 16) return "juvenil";
  return "adulto";
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
      return NextResponse.json({ error: "Solo administradores pueden editar cargas" }, { status: 403 });
    }

    const body = await request.json();
    const { dependent_id, full_name, rut, birth_date, category, address, weight, height, dominant_hand } = body;

    if (!dependent_id || !full_name || !birth_date) {
      return NextResponse.json({ error: "Carga, nombre y fecha de nacimiento son obligatorios" }, { status: 400 });
    }

    const finalCategory = category && VALID_CATEGORIES.includes(category)
      ? category
      : computeCategoryFromBirth(birth_date);
    if (!VALID_CATEGORIES.includes(finalCategory)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    if (weight != null && (typeof weight !== "number" || weight <= 0 || weight > 300)) {
      return NextResponse.json({ error: "El peso debe ser mayor a 0 y hasta 300 kg" }, { status: 400 });
    }
    if (height != null && (typeof height !== "number" || height <= 0 || height > 250)) {
      return NextResponse.json({ error: "La altura debe ser mayor a 0 y hasta 250 cm" }, { status: 400 });
    }
    if (dominant_hand != null && !["diestro", "zurdo"].includes(dominant_hand)) {
      return NextResponse.json({ error: "La mano dominante debe ser diestro o zurdo" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: dependent, error: updateError } = await admin
      .from("dependents")
      .update({
        full_name: full_name.trim(),
        rut: rut?.trim() || null,
        birth_date,
        category: finalCategory,
        address: address?.trim() || null,
        weight: weight ?? null,
        height: height ?? null,
        dominant_hand: dominant_hand || null,
      })
      .eq("id", dependent_id)
      .select("id, tutor_id, full_name, rut, birth_date, category, address, weight, height, dominant_hand, created_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin.from("audit_logs").insert({
      user_id: sessionUser.id,
      action: "update_dependent",
      entity: "dependents",
      entity_id: dependent.id,
      metadata: { full_name: dependent.full_name, category: finalCategory, address: dependent.address, weight: dependent.weight, height: dependent.height, dominant_hand: dependent.dominant_hand },
    });

    return NextResponse.json({ dependent });
  } catch (err) {
    console.error("[UPDATE-DEPENDENT] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
