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
  category: string[];
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
        <section className="pb-16 px-2 md:px-4 lg:px-6 w-full">
          <div className="w-full mx-auto bg-white rounded-2xl md:rounded-[32px] p-4 md:p-6 lg:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-slate-200/60">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : times.length === 0 ? (
              <div className="text-center py-24">
                <span className="material-symbols-outlined text-slate-200 text-8xl mb-6 block">calendar_month</span>
                <p className="font-[family-name:var(--font-body-lg)] text-slate-800 text-[24px] font-bold">No hay clases programadas</p>
                <p className="font-[family-name:var(--font-body-md)] text-[16px] text-slate-500 mt-2">Próximamente publicaremos nuevos horarios</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[900px] xl:min-w-0">
                  {/* Day Headers */}
                  <div className="grid grid-cols-[80px_repeat(6,1fr)] lg:grid-cols-[100px_repeat(6,1fr)] gap-3 lg:gap-4 mb-6">
                    <div />
                    {weekDates.map((wd, i) => (
                      <div key={i} className="text-center bg-slate-50/80 rounded-2xl py-4 border border-slate-100 shadow-sm">
                        <p className="font-[family-name:var(--font-label-sm)] text-slate-800 uppercase tracking-wider text-[13px] lg:text-[15px] font-bold">{wd.dayName}</p>
                        <p className="font-[family-name:var(--font-label-sm)] text-slate-500 text-[11px] lg:text-[12px] capitalize mt-1 font-medium">{wd.date}</p>
                      </div>
                    ))}
                  </div>

                  {/* Time Rows */}
                  <div className="space-y-4 lg:space-y-5">
                    {times.map((time) => (
                      <div key={time} className="grid grid-cols-[80px_repeat(6,1fr)] lg:grid-cols-[100px_repeat(6,1fr)] gap-3 lg:gap-4 items-stretch group">
                        {/* Time Label */}
                        <div className="flex items-start pt-5 justify-center">
                          <span className="font-[family-name:var(--font-label-sm)] text-slate-700 text-[14px] lg:text-[16px] font-black bg-slate-100 px-4 py-2 rounded-xl shadow-sm border border-slate-200/50">{time}</span>
                        </div>
                        
                        {Array.from({ length: 6 }, (_, dayIdx) => {
                          const day = dayIdx + 1;
                          const cell = grid[time]?.[String(day)];
                          if (!cell) return <div key={day} className="min-h-[120px] lg:min-h-[150px] rounded-2xl border-2 border-dashed border-slate-200/70 bg-slate-50/30 transition-colors hover:bg-slate-50/80" />;

                          const s = cell.schedule;
                          const nextDate = cell.nextSessionDate;
                          const remaining = s.capacity - cell.enrolled;
                          const isFull = remaining <= 0;
                          const isLow = remaining > 0 && remaining <= 3;
                          const color = s.disciplines?.color_hex || "#666";
                          
                          const hexToRgb = (hex: string) => {
                            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
                          };
                          const rgb = hexToRgb(color);

                          const nextDateLabel = nextDate
                            ? new Date(nextDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })
                            : null;

                          return (
                            <div key={day} className={`min-h-[120px] lg:min-h-[150px] flex transition-opacity duration-300 ${activeFilter === "all" || s.disciplines?.name === activeFilter ? "opacity-100" : "opacity-30"}`}>
                              <div
                                className={`w-full flex flex-col rounded-2xl p-4 lg:p-5 border-[1.5px] transition-all duration-300 relative overflow-hidden bg-white hover:shadow-xl hover:-translate-y-1 ${isFull ? "opacity-60 grayscale-[0.2]" : "cursor-pointer"} ${isLow ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                                style={{ borderColor: color, boxShadow: `0 4px 20px -10px ${color}40` }}
                                onClick={() => !isFull && handleAgendar(s)}
                              >
                                {/* Top bar */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 opacity-90" style={{ backgroundColor: color }} />
                                
                                <div className="flex items-center justify-between mb-2 mt-1">
                                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] lg:text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ backgroundColor: `rgba(${rgb}, 0.1)`, color: color }}>
                                    {s.disciplines?.name}
                                  </span>
                                  {cell.userEnrolled && (
                                    <span className="material-symbols-outlined text-[18px]" style={{ color }}>check_circle</span>
                                  )}
                                </div>

                                {s.category && s.category.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    {s.category.map((cat) => (
                                      <span key={cat} className={`font-[family-name:var(--font-label-sm)] text-[9px] lg:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                        cat === "ninos" ? "bg-blue-100 text-blue-700" :
                                        cat === "juveniles" ? "bg-amber-100 text-amber-700" :
                                        "bg-green-100 text-green-700"
                                      }`}>
                                        {cat === "ninos" ? "Niños" : cat === "juveniles" ? "Juveniles" : "Adultos"}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {s.profiles && (
                                  <p className="font-[family-name:var(--font-label-sm)] text-[13px] lg:text-[14px] text-slate-800 font-extrabold uppercase tracking-wide line-clamp-1 mb-1">{s.profiles.full_name}</p>
                                )}
                                
                                {nextDateLabel && (
                                  <p className="font-[family-name:var(--font-label-sm)] text-slate-500 text-[11px] lg:text-[12px] capitalize mb-3 flex items-center gap-1.5 font-medium">
                                    <span className="material-symbols-outlined text-[14px]">event</span>
                                    {nextDateLabel}
                                  </p>
                                )}
                                
                                <div className="mt-auto pt-2 border-t border-slate-100">
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cupos</span>
                                    <span className={`font-[family-name:var(--font-label-sm)] text-[11px] lg:text-[12px] font-black ${isFull ? "text-red-500" : "text-slate-700"}`}>
                                      {remaining > 0 ? remaining : 0}/{s.capacity}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${s.capacity > 0 ? (cell.enrolled / s.capacity) * 100 : 0}%`, backgroundColor: isFull ? "#ef4444" : color }} />
                                  </div>
                                </div>

                                {isFull && (
                                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-[1px]">
                                    <span className="bg-red-500 text-white font-bold text-[12px] uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg transform -rotate-12">Llena</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Legend inside the box */}
            {times.length > 0 && (
              <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap gap-8 items-center justify-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 bg-white shadow-sm" />
                  <span className="font-[family-name:var(--font-label-sm)] text-slate-500 text-[12px] lg:text-[13px] uppercase tracking-wider font-bold">Disponible</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-400 ring-2 ring-amber-400/30 ring-offset-2" />
                  <span className="font-[family-name:var(--font-label-sm)] text-slate-500 text-[12px] lg:text-[13px] uppercase tracking-wider font-bold">Últimos cupos</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm" />
                  <span className="font-[family-name:var(--font-label-sm)] text-slate-500 text-[12px] lg:text-[13px] uppercase tracking-wider font-bold">Clase llena</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CTA section outside the calendar */}
        <section className="pb-16 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <PageCTA />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
