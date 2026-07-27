import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { session_id, beneficiary_ids } = body as {
    session_id: string;
    beneficiary_ids: string[];
  };

  if (!session_id || !Array.isArray(beneficiary_ids) || beneficiary_ids.length === 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: session, error: sessionErr } = await admin
    .from("class_sessions")
    .select("id, status")
    .eq("id", session_id)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  if (session.status !== "activa") {
    return NextResponse.json(
      { error: "Esta clase ya no está recibiendo asistencia" },
      { status: 403 }
    );
  }

  const results: Array<{
    beneficiary_id: string;
    name: string;
    ok: boolean;
    message: string;
    membership_status: "al_dia" | "atrasado" | "sin_membresia";
  }> = [];

  for (const bId of beneficiary_ids) {
    const { data: benCheck } = await admin
      .from("beneficiaries")
      .select("id, profile_id, dependent:dependents(tutor_id)")
      .eq("id", bId)
      .maybeSingle();

    const isOwner =
      benCheck?.profile_id === user.id ||
      (benCheck?.dependent as unknown as { tutor_id: string })?.tutor_id === user.id;

    if (!isOwner) {
      results.push({
        beneficiary_id: bId,
        name: "",
        ok: false,
        message: "No tienes acceso a este beneficiario",
        membership_status: "sin_membresia",
      });
      continue;
    }

    const { data: bInfo } = await admin
      .from("beneficiaries")
      .select("id, profile:profiles(full_name), dependent:dependents(full_name)")
      .eq("id", bId)
      .single();

    const bName =
      (bInfo?.dependent as unknown as { full_name: string })?.full_name ||
      (bInfo?.profile as unknown as { full_name: string })?.full_name ||
      "Alumno";

    const { data: existingEnrollment } = await admin
      .from("class_enrollments")
      .select("id")
      .eq("session_id", session_id)
      .eq("beneficiary_id", bId)
      .maybeSingle();

    if (!existingEnrollment) {
      const { error: enrollErr } = await admin.from("class_enrollments").insert({
        session_id,
        beneficiary_id: bId,
        source: "qr",
      });

      if (enrollErr) {
        results.push({
          beneficiary_id: bId,
          name: bName,
          ok: false,
          message: `Error al inscribir: ${enrollErr.message}`,
          membership_status: "sin_membresia",
        });
        continue;
      }
    }

    const now = new Date().toISOString();
    const { error: attErr } = await admin
      .from("attendance")
      .upsert(
        {
          session_id,
          beneficiary_id: bId,
          status: "presente",
          marked_by: user.id,
          marked_at: now,
        },
        { onConflict: "session_id,beneficiary_id" }
      );

    if (attErr) {
      results.push({
        beneficiary_id: bId,
        name: bName,
        ok: false,
        message: `Error al registrar asistencia: ${attErr.message}`,
        membership_status: "sin_membresia",
      });
      continue;
    }

    const { data: membership } = await admin
      .from("memberships")
      .select("end_date, status")
      .eq("beneficiary_id", bId)
      .eq("status", "activa")
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: enrollment } = await admin
      .from("academy_enrollments")
      .select("end_date, status")
      .eq("beneficiary_id", bId)
      .eq("status", "activa")
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let membershipStatus: "al_dia" | "atrasado" | "sin_membresia" = "sin_membresia";
    const today = new Date().toISOString().split("T")[0];

    if (membership && membership.end_date >= today) {
      if (enrollment && enrollment.end_date >= today) {
        membershipStatus = "al_dia";
      } else {
        membershipStatus = "atrasado";
      }
    } else if (membership) {
      membershipStatus = "atrasado";
    }

    results.push({
      beneficiary_id: bId,
      name: bName,
      ok: true,
      message: "Presente ✓",
      membership_status: membershipStatus,
    });
  }

  return NextResponse.json({ results });
}
