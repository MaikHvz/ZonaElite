import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

const WEEKS_AHEAD = 4;

export async function POST() {
  const supabase = getAdminClient();

  const { data: activeSchedules, error: schedErr } = await supabase
    .from("schedules")
    .select("id, day_of_week")
    .eq("active", true);

  if (schedErr || !activeSchedules || activeSchedules.length === 0) {
    return NextResponse.json({ created: 0, error: schedErr?.message || "No active schedules" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + WEEKS_AHEAD * 7);

  const sessionsToInsert: { schedule_id: string; session_date: string }[] = [];

  for (const schedule of activeSchedules) {
    const current = new Date(today);

    while (current <= endDate) {
      if (current.getDay() === schedule.day_of_week) {
        const dateStr = current.toISOString().split("T")[0];
        sessionsToInsert.push({
          schedule_id: schedule.id,
          session_date: dateStr,
        });
      }
      current.setDate(current.getDate() + 1);
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
}
