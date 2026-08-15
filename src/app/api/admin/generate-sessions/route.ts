import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getChileToday, addDaysChile } from "@/lib/dates";

const WEEKS_AHEAD = 4;

export async function POST() {
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
      return NextResponse.json({ error: "Solo administradores pueden generar sesiones" }, { status: 403 });
    }

    const supabase = getAdminClient();

    const { data: activeSchedules, error: schedErr } = await supabase
      .from("schedules")
      .select("id, day_of_week")
      .eq("active", true);

    if (schedErr || !activeSchedules || activeSchedules.length === 0) {
      return NextResponse.json({ created: 0, error: schedErr?.message || "No active schedules" });
    }

    const today = getChileToday();
    const totalDays = WEEKS_AHEAD * 7;

    const sessionsToInsert: { schedule_id: string; session_date: string }[] = [];

    for (const schedule of activeSchedules) {
      let current = today;
      for (let i = 0; i < totalDays; i++) {
        // El día de la semana de una fecha calendario es independiente de la zona
        // horaria; usar mediodía local evita ambigüedades de DST.
        const dow = new Date(current + "T12:00:00").getDay();
        if (dow === schedule.day_of_week) {
          sessionsToInsert.push({
            schedule_id: schedule.id,
            session_date: current,
          });
        }
        current = addDaysChile(current, 1);
      }
    }

    if (sessionsToInsert.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const { data, error } = await supabase
      .from("class_sessions")
      .upsert(sessionsToInsert, { onConflict: "schedule_id,session_date", ignoreDuplicates: true })
      .select();

    if (error) {
      return NextResponse.json({ created: 0, error: error.message });
    }

    return NextResponse.json({ created: data?.length || 0 });
  } catch {
    return NextResponse.json({ created: 0, error: "Error interno del servidor" }, { status: 500 });
  }
}
