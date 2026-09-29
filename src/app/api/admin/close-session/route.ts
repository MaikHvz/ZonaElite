import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clearQrLockFailures,
  isQrLockRateLimited,
  registerQrLockFailure,
  verifyQrLockPassword,
} from "@/lib/qr-lock";

const LOCK_ID = "00000000-0000-0000-0000-000000000001";
const NO_STORE = { "Cache-Control": "no-store" } as const;

interface QrAttendee {
  beneficiary_id: string;
  full_name: string;
  marked_at: string;
}

export async function POST(request: Request) {
  try {
    const server = await createClient();
    const { data: { user: sessionUser }, error: authError } = await server.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE });
    }

    const { data: profile } = await server
      .from("profiles")
      .select("role_id")
      .eq("id", sessionUser.id)
      .single();

    if (!profile || profile.role_id !== 1) {
      return NextResponse.json(
        { error: "Solo los administradores pueden finalizar sesiones" },
        { status: 403, headers: NO_STORE }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { session_id: sessionId, password } = body as {
      session_id?: string;
      password?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: "Falta la sesión" }, { status: 400, headers: NO_STORE });
    }

    const admin = getAdminClient();

    const { data: lock } = await admin
      .from("qr_session_lock")
      .select("password_hash, password_salt")
      .eq("id", LOCK_ID)
      .maybeSingle();

    let warning: string | undefined;

    if (lock) {
      if (isQrLockRateLimited(sessionUser.id)) {
        return NextResponse.json(
          { error: "Demasiados intentos. Espera 15 minutos." },
          { status: 429, headers: NO_STORE }
        );
      }

      if (!verifyQrLockPassword(password || "", lock)) {
        registerQrLockFailure(sessionUser.id);
        await admin.from("audit_logs").insert({
          user_id: sessionUser.id,
          action: "close_session_denied",
          entity: "class_sessions",
          entity_id: sessionId,
          metadata: { reason: "qr_lock_password_incorrect" },
        });
        return NextResponse.json(
          { error: "Contraseña incorrecta" },
          { status: 401, headers: NO_STORE }
        );
      }

      clearQrLockFailures(sessionUser.id);
    } else {
      warning = "No hay contraseña de sesión QR configurada: la sesión se cerró sin protección.";
    }

    const { data: session } = await admin
      .from("class_sessions")
      .select("id, status, schedule_id, schedules(mode)")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404, headers: NO_STORE });
    }

    const schedule = (session.schedules as { mode?: string } | null) || null;
    const isPersonalized = schedule?.mode === "personalizado";
    const scheduleId = session.schedule_id as string | null;

    let uniqueEnrollments: { beneficiary_id: string; source?: string }[] = [];

    if (isPersonalized) {
      const { data: pEnrollments } = await admin
        .from("personalized_enrollments")
        .select("beneficiary_id")
        .eq("session_id", sessionId);

      uniqueEnrollments = (pEnrollments || []).map((e) => ({
        beneficiary_id: e.beneficiary_id as string,
        source: "personalizado",
      }));
    } else {
      const { data: sessionEnrollments } = await admin
        .from("class_enrollments")
        .select("beneficiary_id, source")
        .eq("session_id", sessionId);

      const { data: scheduleEnrollments } = scheduleId
        ? await admin
            .from("class_enrollments")
            .select("beneficiary_id, source")
            .eq("schedule_id", scheduleId)
            .is("session_id", null)
        : { data: null };

      const allEnrollments = [...(sessionEnrollments || []), ...(scheduleEnrollments || [])];
      const deduped = new Map<string, { beneficiary_id: string; source?: string }>();
      for (const e of allEnrollments) {
        deduped.set(e.beneficiary_id as string, {
          beneficiary_id: e.beneficiary_id as string,
          source: (e.source as string) || undefined,
        });
      }
      uniqueEnrollments = Array.from(deduped.values());
    }

    const { data: existingAttendance } = await admin
      .from("attendance")
      .select("beneficiary_id, status")
      .eq("session_id", sessionId);

    const attendedIds = new Set(
      (existingAttendance || []).map((a) => a.beneficiary_id as string)
    );

    const notAttended = uniqueEnrollments.filter((e) => !attendedIds.has(e.beneficiary_id));

    if (notAttended.length > 0) {
      const absentInserts = notAttended.map((e) => ({
        session_id: sessionId,
        beneficiary_id: e.beneficiary_id,
        status: "ausente" as const,
        marked_by: sessionUser.id,
        marked_at: new Date().toISOString(),
      }));
      const { error: absentError } = await admin.from("attendance").insert(absentInserts);
      if (absentError) {
        return NextResponse.json(
          { error: absentError.message },
          { status: 400, headers: NO_STORE }
        );
      }
    }

    const { data: allAttendance } = await admin
      .from("attendance")
      .select("beneficiary_id, marked_at, beneficiaries(id, profile:profiles(full_name), dependent:dependents(full_name))")
      .eq("session_id", sessionId)
      .eq("status", "presente");

    const qrBenIds = new Set(
      isPersonalized
        ? (allAttendance || []).map((a) => a.beneficiary_id as string)
        : uniqueEnrollments.filter((e) => e.source === "qr").map((e) => e.beneficiary_id)
    );

    const summary: QrAttendee[] = (allAttendance || [])
      .filter((a) => qrBenIds.has(a.beneficiary_id as string))
      .map((a) => {
        const b = a.beneficiaries as unknown as {
          profile?: { full_name: string };
          dependent?: { full_name: string };
        } | null;
        return {
          beneficiary_id: a.beneficiary_id as string,
          full_name: b?.dependent?.full_name || b?.profile?.full_name || "Alumno",
          marked_at: a.marked_at as string,
        };
      });

    const { error: closeError } = await admin
      .from("class_sessions")
      .update({ status: "cerrada" })
      .eq("id", sessionId);

    if (closeError) {
      return NextResponse.json({ error: closeError.message }, { status: 400, headers: NO_STORE });
    }

    await admin.from("audit_logs").insert({
      user_id: sessionUser.id,
      action: "close_session",
      entity: "class_sessions",
      entity_id: sessionId,
      metadata: {
        mode: isPersonalized ? "personalizado" : "normal",
        absent_marked: notAttended.length,
        qr_attendees: summary.length,
        lock_enforced: Boolean(lock),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        warning,
        summary,
        absentMarked: notAttended.length,
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[CLOSE-SESSION] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
