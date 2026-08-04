import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getChileToday } from "@/lib/dates";

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
    .select("id, status, schedules(mode)")
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

  const sessionMode = (session.schedules as unknown as { mode?: string } | null)?.mode;
  if (sessionMode === "personalizado") {
    return NextResponse.json(
      { error: "Las clases personalizadas no usan check-in por QR" },
      { status: 403 }
    );
  }

  const today = getChileToday();

  const results: Array<{
    beneficiary_id: string;
    name: string;
    ok: boolean;
    message: string;
    membership_status: "al_dia" | "atrasado" | "sin_membresia" | "sin_matricula";
    debt: boolean;
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
        debt: false,
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

    let createdDebt = false;

    if (!existingEnrollment) {
      const { data: membership } = await admin
        .from("memberships")
        .select("id, plan_id, end_date, status, membership_plans(tokens)")
        .eq("beneficiary_id", bId)
        .eq("status", "activa")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!membership) {
        results.push({
          beneficiary_id: bId,
          name: bName,
          ok: false,
          message: "Sin membresía activa. Debes comprar una membresía para asistir a clases.",
          membership_status: "sin_membresia",
          debt: false,
        });
        continue;
      }

      if (membership.end_date < today) {
        results.push({
          beneficiary_id: bId,
          name: bName,
          ok: false,
          message: "Membresía vencida. Debes renovar tu membresía para asistir a clases.",
          membership_status: "atrasado",
          debt: false,
        });
        continue;
      }

      // Gate de matrícula: sin inscripción activa a la academia no se puede asistir.
      const { data: academyEnrollment } = await admin
        .from("academy_enrollments")
        .select("id")
        .eq("beneficiary_id", bId)
        .eq("status", "activa")
        .gte("end_date", today)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!academyEnrollment) {
        results.push({
          beneficiary_id: bId,
          name: bName,
          ok: false,
          message: "Sin matrícula activa. Debes matricularte para asistir a clases.",
          membership_status: "sin_matricula",
          debt: false,
        });
        continue;
      }

      const planTokens = (membership.membership_plans as unknown as { tokens: number | null })?.tokens;
      let tokensAvailable = true;
      if (planTokens !== null) {
        const { data: tokenData } = await admin.rpc("get_remaining_tokens", {
          p_beneficiary_id: bId,
          p_membership_id: membership.id,
        });

        if (tokenData && tokenData.length > 0) {
          const tokenInfo = tokenData[0];
          if (!tokenInfo.is_unlimited && tokenInfo.remaining !== null && tokenInfo.remaining <= 0) {
            tokensAvailable = false;
          }
        }
      }

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
          debt: false,
        });
        continue;
      }

      // Fase 10: sin tokens -> se inscribe igual y se materializa deuda de 1 clase.
      if (!tokensAvailable) {
        const { data: existingDebt } = await admin
          .from("debts")
          .select("id")
          .eq("beneficiary_id", bId)
          .eq("session_id", session_id)
          .eq("status", "pendiente")
          .maybeSingle();

        if (!existingDebt) {
          const { error: debtErr } = await admin.from("debts").insert({
            beneficiary_id: bId,
            membership_id: membership.id,
            session_id,
            amount: 1,
            status: "pendiente",
          });

          if (!debtErr) {
            createdDebt = true;
          }
        } else {
          createdDebt = true;
        }
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
        debt: createdDebt,
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

    let membershipStatus: "al_dia" | "atrasado" | "sin_membresia" | "sin_matricula" = "sin_membresia";

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
      message: createdDebt
        ? "Presente ✓ (quedó 1 clase en deuda)"
        : "Presente ✓",
      membership_status: membershipStatus,
      debt: createdDebt,
    });
  }

  return NextResponse.json({ results });
}
