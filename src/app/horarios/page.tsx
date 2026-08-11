"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";
import EnrollModal from "@/components/EnrollModal";
import PersonalizedEnrollModal from "@/components/PersonalizedEnrollModal";

interface Schedule {
  id: string;
  discipline_id: string;
  professor_id: string;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  category: string;
  active: boolean;
  description: string | null;
  mode: string;
  disciplines: { name: string; color_hex: string; icon: string } | null;
  profiles: { full_name: string } | null;
  class_plans: { plan_id: string }[];
  personalized_schedule_plans?: { plan_id: string }[];
}

interface ScheduleCell {
  schedule: Schedule;
  enrolled: number;
  nextSessionDate: string | null;
  userEnrolled: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getWeekDates(): { dayName: string; date: string; full: string }[] {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dayName: DAY_NAMES[i + 1],
      date: d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
      full: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    };
  });
}

function getLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLin(parseInt(full.slice(0, 2), 16)) +
    0.7152 * toLin(parseInt(full.slice(2, 4), 16)) +
    0.0722 * toLin(parseInt(full.slice(4, 6), 16))
  );
}

function getContrastText(hex: string): string {
  return getLuminance(hex) > 0.5 ? "#141414" : "#ffffff";
}

let toastId = 0;

export default function HorariosPage() {
  const [grid, setGrid] = useState<Record<string, Record<string, ScheduleCell>>>({});
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("normal");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const weekDates = getWeekDates();
  const supabase = createClient();

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const loadSchedule = useCallback(async () => {
    const { data: schedules } = await supabase
      .from("schedules")
      .select("*, disciplines(name, color_hex, icon), profiles(full_name), class_plans(plan_id), personalized_schedule_plans(plan_id)")
      .eq("active", true)
      .order("start_time");

    if (!schedules) { setLoading(false); return; }

    const modeSchedules = (schedules as Schedule[]).filter((s) => s.mode === modeFilter);

    const todayObj = new Date();
    const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
    const enriched: Record<string, Record<string, ScheduleCell>> = {};
    const timeSet = new Set<string>();

    for (const s of modeSchedules) {
      const time = s.start_time.slice(0, 5);
      const day = String(s.day_of_week);
      timeSet.add(time);

      const { data: nextSession } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .eq("schedule_id", s.id)
        .gte("session_date", today)
        .order("session_date")
        .limit(1)
        .maybeSingle();

      let enrolled = 0;
      if (nextSession) {
        const { count } = await supabase
          .from("class_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("session_id", nextSession.id);
        enrolled = count || 0;
      }

      if (!enriched[time]) enriched[time] = {};
      enriched[time][day] = {
        schedule: s,
        enrolled,
        nextSessionDate: nextSession?.session_date || null,
        userEnrolled: false,
      };
    }

    const sortedTimes = Array.from(timeSet).sort();
    setTimes(sortedTimes);
    setGrid(enriched);
    setLoading(false);
  }, [supabase, modeFilter]);

  const loadUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setUserId(authUser.id);
  }, [supabase]);

  useEffect(() => {
    Promise.all([loadSchedule(), loadUser()]);
  }, [loadSchedule, loadUser]);

  const handleAgendar = (schedule: Schedule) => {
    if (!userId) {
      addToast("Inicia sesión para agendar clases", "error");
      return;
    }
    setSelectedSchedule(schedule);
    setModalOpen(true);
  };

  const handleModeChange = (mode: string) => {
    if (mode === modeFilter) return;
    setActiveFilter("all");
    setModeFilter(mode);
  };

  const handleEnrolled = () => {
    loadSchedule();
    addToast("Inscripción exitosa", "success");
  };

  const legendItems = [
    { color: "bg-white", label: "Disponible" },
    { color: "bg-amber-500", label: "Últimos cupos" },
    { color: "bg-white/30", label: "Llena" },
  ];

  const disciplineFilters = Object.values(grid)
    .flatMap((day) => Object.values(day))
    .map((c) => c.schedule.disciplines)
    .filter(Boolean);
  const uniqueDisciplines = Array.from(new Map(disciplineFilters.map((d) => [d!.name, d!])).values());

  return (
    <>
      <main className="min-h-screen bg-background">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-slide-in-right ${
              t.type === "success"
                ? "bg-green-900/90 border-green-500/30 text-green-200"
                : "bg-red-900/90 border-red-500/30 text-red-200"
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  {t.type === "success" ? "check_circle" : "error"}
                </span>
                <span className="font-[family-name:var(--font-body-sm)] text-[13px]">{t.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Enroll Modal */}
        {selectedSchedule?.mode === "personalizado" ? (
          <PersonalizedEnrollModal
            open={modalOpen}
            schedule={selectedSchedule}
            userId={userId || ""}
            onClose={() => setModalOpen(false)}
            onEnrolled={handleEnrolled}
          />
        ) : (
          <EnrollModal
            open={modalOpen}
            schedule={selectedSchedule}
            userId={userId || ""}
            onClose={() => setModalOpen(false)}
            onEnrolled={handleEnrolled}
          />
        )}

        {/* Header */}
        <section className="pt-24 pb-8 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-[family-name:var(--font-label-sm)] text-white uppercase tracking-[0.15em] mb-3 text-[14px] leading-[18px]">
              Calendario de Entrenamientos
            </p>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[36px] leading-[40px] md:text-[56px] md:leading-[60px] md:tracking-[0.02em] text-white uppercase tracking-tighter mb-4">
              Horarios
            </h1>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-headline-md)] text-[22px] leading-[26px] md:text-[26px] text-white uppercase">Clases disponibles</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
          </div>
        </section>

        {/* Mode Toggle */}
        <section className="pb-4 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface-container border border-on-surface/10">
              <button
                onClick={() => handleModeChange("normal")}
                className={`font-[family-name:var(--font-label-sm)] text-[13px] uppercase tracking-wider px-6 py-2.5 rounded-full transition-colors cursor-pointer ${modeFilter === "normal" ? "btn-primary-gradient text-white" : "text-white hover:bg-white/10"}`}
              >
                Membresías
              </button>
              <button
                onClick={() => handleModeChange("personalizado")}
                className={`font-[family-name:var(--font-label-sm)] text-[13px] uppercase tracking-wider px-6 py-2.5 rounded-full transition-colors cursor-pointer ${modeFilter === "personalizado" ? "bg-purple-500 text-white" : "text-white hover:bg-white/10"}`}
              >
                Personalizadas
              </button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="pb-4 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto flex flex-wrap gap-2">
            <button onClick={() => setActiveFilter("all")} className={`font-[family-name:var(--font-label-sm)] text-[13px] uppercase tracking-wider px-5 py-2 rounded-full border transition-colors cursor-pointer ${activeFilter === "all" ? "btn-primary-gradient text-white border-transparent" : "border-white/30 text-white hover:border-white"}`}>
              Todos
            </button>
            {uniqueDisciplines.map((d) => (
              <button key={d!.name} onClick={() => setActiveFilter(d!.name)} className={`font-[family-name:var(--font-label-sm)] text-[13px] uppercase tracking-wider px-5 py-2 rounded-full border transition-colors cursor-pointer flex items-center gap-1.5 ${activeFilter === d!.name ? "border-transparent font-bold" : "border-white/30 text-white hover:border-white"}`} style={activeFilter === d!.name ? { backgroundColor: d!.color_hex, color: getContrastText(d!.color_hex) } : {}}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d!.color_hex }} />
                {d!.name}
              </button>
            ))}
          </div>
        </section>

        {/* Schedule Grid */}
        <section className="pb-16 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : times.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-white/30 text-7xl mb-4 block">calendar_month</span>
                <p className="font-[family-name:var(--font-body-lg)] text-white text-[20px]">No hay clases programadas</p>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] text-white/80 mt-2">Próximamente publicaremos nuevos horarios</p>
              </div>
            ) : (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-[70px_repeat(6,1fr)] md:grid-cols-[100px_repeat(6,1fr)] gap-1.5 md:gap-2 mb-3">
                  <div />
                  {weekDates.map((wd, i) => (
                    <div key={i} className="text-center">
                      <p className="font-[family-name:var(--font-label-sm)] text-white uppercase tracking-wider text-[11px] leading-[15px] md:text-[14px] md:leading-[18px] font-bold">{wd.dayName}</p>
                      <p className="font-[family-name:var(--font-label-sm)] text-white/90 text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] capitalize">{wd.date}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[70px_repeat(6,1fr)] md:grid-cols-[100px_repeat(6,1fr)] gap-1.5 md:gap-2 mb-3">
                  <div />
                  {weekDates.map((_, i) => (<div key={i} className="h-0.5 rounded-full bg-white/40" />))}
                </div>

                {/* Time Rows */}
                <div className="space-y-2 md:space-y-3">
                  {times.map((time) => (
                    <div key={time} className="grid grid-cols-[70px_repeat(6,1fr)] md:grid-cols-[100px_repeat(6,1fr)] gap-1.5 md:gap-2 items-start">
                      <div className="pt-2 md:pt-3">
                        <span className="font-[family-name:var(--font-label-sm)] text-white text-[13px] leading-[18px] md:text-[16px] md:leading-[20px] font-bold">{time}</span>
                      </div>
                      {Array.from({ length: 6 }, (_, dayIdx) => {
                        const day = dayIdx + 1;
                        const cell = grid[time]?.[String(day)];
                        if (!cell) return <div key={day} className="min-h-[88px] md:min-h-[120px]" />;

                        const s = cell.schedule;
                        const nextDate = cell.nextSessionDate;
                        const remaining = s.capacity - cell.enrolled;
                        const isFull = remaining <= 0;
                        const isLow = remaining > 0 && remaining <= 3;
                        const color = s.disciplines?.color_hex || "#666";
                        const textOnColor = getContrastText(color);
                        const matchesFilter = activeFilter === "all" || s.disciplines?.name === activeFilter;

                        const nextDateLabel = nextDate
                          ? new Date(nextDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })
                          : null;

                        return (
                          <div key={day} className={`min-h-[88px] md:min-h-[120px] transition-opacity ${matchesFilter ? "opacity-100" : "opacity-20"}`}>
                            <div
                              className={`rounded-xl p-3 md:p-4 border-2 transition-all duration-300 ${isFull ? "opacity-50" : ""} ${isLow ? "shadow-[0_0_0_2px_rgba(245,158,11,0.45)]" : ""}`}
                              style={isFull
                                ? { borderColor: `${color}40`, backgroundColor: `${color}0A` }
                                : { borderColor: color, background: `linear-gradient(180deg, ${color}2E 0%, ${color}0F 100%)` }}
                            >
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] font-bold text-white uppercase tracking-wider line-clamp-1 rounded px-1.5 py-0.5" style={{ backgroundColor: `${color}33` }}>{s.disciplines?.name}</span>
                              </div>
                              {s.profiles && (
                                <p className="font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] text-white/90 uppercase tracking-wider mb-1">{s.profiles.full_name}</p>
                              )}
                              {nextDateLabel && (
                                <p className="font-[family-name:var(--font-label-sm)] text-white/90 text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] capitalize mb-1">Próx: {nextDateLabel}</p>
                              )}
                              <div className="flex items-center gap-1 mt-1.5">
                                <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${s.capacity > 0 ? (cell.enrolled / s.capacity) * 100 : 0}%`, backgroundColor: isFull ? "rgba(255,255,255,0.35)" : color }} />
                                </div>
                                <span className={`font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] md:text-[12px] md:leading-[16px] font-bold ${isFull ? "text-white/50" : "text-white"}`}>{remaining > 0 ? remaining : 0}/{s.capacity}</span>
                              </div>
                              {!isFull && (
                                <button
                                  onClick={() => handleAgendar(s)}
                                  className="mt-2.5 w-full text-center py-1.5 rounded-lg text-[11px] md:text-[13px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider transition-colors cursor-pointer font-bold"
                                  style={{ backgroundColor: `${color}2B`, color: "#fff", border: `1.5px solid ${color}` }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = color; e.currentTarget.style.color = textOnColor; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${color}2B`; e.currentTarget.style.color = "#fff"; }}
                                >
                                  {cell.userEnrolled ? "Inscrito ✓" : "Agendar"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-10 flex flex-wrap gap-6 items-center">
                  {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${item.color}`} />
                      <span className="font-[family-name:var(--font-label-sm)] text-white text-[12px] leading-[16px] md:text-[13px] uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
                  {uniqueDisciplines.map((d) => (
                    <div key={d!.name} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: d!.color_hex }} />
                      <span className="font-[family-name:var(--font-label-sm)] text-white text-[12px] leading-[16px] md:text-[13px] uppercase tracking-wider">{d!.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-12">
              <PageCTA />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
