"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";
import EnrollModal from "@/components/EnrollModal";

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
  disciplines: { name: string; color_hex: string; icon: string } | null;
  profiles: { full_name: string } | null;
  class_plans: { plan_id: string }[];
}

interface ScheduleCell {
  schedule: Schedule;
  enrolled: number;
  userEnrolled: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

let toastId = 0;

export default function HorariosPage() {
  const [grid, setGrid] = useState<Record<string, Record<string, ScheduleCell>>>({});
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedEnrolledCount, setSelectedEnrolledCount] = useState(0);

  const supabase = createClient();

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const loadSchedule = useCallback(async () => {
    const { data: schedules } = await supabase
      .from("schedules")
      .select("*, disciplines(name, color_hex, icon), profiles(full_name), class_plans(plan_id)")
      .eq("active", true)
      .order("start_time");

    if (!schedules) { setLoading(false); return; }

    const enriched: Record<string, Record<string, ScheduleCell>> = {};
    const timeSet = new Set<string>();

    for (const s of schedules as Schedule[]) {
      const time = s.start_time.slice(0, 5);
      const day = String(s.day_of_week);
      timeSet.add(time);

      const { count } = await supabase
        .from("class_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("schedule_id", s.id);

      if (!enriched[time]) enriched[time] = {};
      enriched[time][day] = {
        schedule: s,
        enrolled: count || 0,
        userEnrolled: false,
      };
    }

    const sortedTimes = Array.from(timeSet).sort();
    setTimes(sortedTimes);
    setGrid(enriched);
    setLoading(false);
  }, [supabase]);

  const loadUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setUserId(authUser.id);
  }, [supabase]);

  useEffect(() => {
    Promise.all([loadSchedule(), loadUser()]);
  }, [loadSchedule, loadUser]);

  const handleAgendar = (schedule: Schedule, enrolledCount: number) => {
    if (!userId) {
      addToast("Inicia sesión para agendar clases", "error");
      return;
    }
    setSelectedSchedule(schedule);
    setSelectedEnrolledCount(enrolledCount);
    setModalOpen(true);
  };

  const handleEnrolled = () => {
    loadSchedule();
    addToast("Inscripción exitosa", "success");
  };

  const legendItems = [
    { color: "bg-primary", label: "Disponible" },
    { color: "bg-amber-500", label: "Últimos cupos" },
    { color: "bg-on-surface-variant/30", label: "Llena" },
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
        <EnrollModal
          open={modalOpen}
          schedule={selectedSchedule}
          enrolledCount={selectedEnrolledCount}
          userId={userId || ""}
          onClose={() => setModalOpen(false)}
          onEnrolled={handleEnrolled}
        />

        {/* Header */}
        <section className="pt-24 pb-8 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-[family-name:var(--font-label-sm)] text-primary uppercase tracking-[0.15em] mb-3 text-[12px] leading-[16px]">
              Calendario de Entrenamientos
            </p>
            <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter mb-4">
              Horarios
            </h1>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] text-on-surface uppercase">Clases disponibles</span>
              <div className="h-px flex-1 bg-on-surface/10" />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="pb-4 px-5 md:px-6">
          <div className="max-w-[1280px] mx-auto flex flex-wrap gap-2">
            <button onClick={() => setActiveFilter("all")} className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-full border transition-colors cursor-pointer ${activeFilter === "all" ? "btn-primary-gradient text-white border-transparent" : "border-on-surface/20 text-on-surface-variant hover:border-primary/50"}`}>
              Todos
            </button>
            {uniqueDisciplines.map((d) => (
              <button key={d!.name} onClick={() => setActiveFilter(d!.name)} className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-1.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1.5 ${activeFilter === d!.name ? "text-white border-transparent" : "border-on-surface/20 text-on-surface-variant hover:border-primary/50"}`} style={activeFilter === d!.name ? { backgroundColor: d!.color_hex } : {}}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d!.color_hex }} />
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
                <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">calendar_month</span>
                <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant">No hay clases programadas</p>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant/60 mt-2">Próximamente publicaremos nuevos horarios</p>
              </div>
            ) : (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-[60px_repeat(6,1fr)] md:grid-cols-[80px_repeat(6,1fr)] gap-1.5 md:gap-2 mb-3">
                  <div />
                  {DAY_NAMES.slice(1).map((day, i) => (
                    <div key={i} className="text-center">
                      <p className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[10px] leading-[14px] md:text-[12px] md:leading-[16px]">{day}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[60px_repeat(6,1fr)] md:grid-cols-[80px_repeat(6,1fr)] gap-1.5 md:gap-2 mb-3">
                  <div />
                  {DAY_NAMES.slice(1).map((_, i) => (<div key={i} className="h-0.5 rounded-full bg-primary/40" />))}
                </div>

                {/* Time Rows */}
                <div className="space-y-2 md:space-y-3">
                  {times.map((time) => (
                    <div key={time} className="grid grid-cols-[60px_repeat(6,1fr)] md:grid-cols-[80px_repeat(6,1fr)] gap-1.5 md:gap-2 items-start">
                      <div className="pt-2 md:pt-3">
                        <span className="font-[family-name:var(--font-label-sm)] text-primary text-[12px] leading-[16px] md:text-[14px] md:leading-[18px] font-bold">{time}</span>
                      </div>
                      {Array.from({ length: 6 }, (_, dayIdx) => {
                        const day = dayIdx + 1;
                        const cell = grid[time]?.[String(day)];
                        if (!cell) return <div key={day} className="min-h-[60px] md:min-h-[72px]" />;

                        const s = cell.schedule;
                        const remaining = s.capacity - cell.enrolled;
                        const isFull = remaining <= 0;
                        const isLow = remaining > 0 && remaining <= 3;
                        const color = s.disciplines?.color_hex || "#666";
                        const matchesFilter = activeFilter === "all" || s.disciplines?.name === activeFilter;

                        return (
                          <div key={day} className={`min-h-[60px] md:min-h-[72px] transition-opacity ${matchesFilter ? "opacity-100" : "opacity-20"}`}>
                            <div className={`rounded-xl p-3 border transition-all duration-300 ${isFull ? "bg-surface-container-high/50 border-on-surface/5 opacity-60" : isLow ? "border-amber-500/30 hover:border-amber-500/60" : "border-on-surface/5 hover:border-primary/30"}`} style={!isFull ? { backgroundColor: `${color}08` } : {}}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <p className="font-[family-name:var(--font-label-sm)] text-[10px] leading-[14px] md:text-[11px] md:leading-[15px] text-on-surface uppercase tracking-wider line-clamp-1">{s.disciplines?.name}</p>
                              </div>
                              {s.profiles && (
                                <p className="font-[family-name:var(--font-label-sm)] text-[9px] leading-[12px] md:text-[10px] md:leading-[14px] text-on-surface-variant/70 uppercase tracking-wider mb-1">{s.profiles.full_name}</p>
                              )}
                              <div className="flex items-center gap-1 mt-1.5">
                                <div className="flex-1 h-1 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${s.capacity > 0 ? (cell.enrolled / s.capacity) * 100 : 0}%`, backgroundColor: isFull ? "var(--color-on-surface-variant)" : color }} />
                                </div>
                                <span className={`font-[family-name:var(--font-label-sm)] text-[9px] leading-[12px] md:text-[10px] ${isFull ? "text-on-surface-variant/40" : "text-on-surface-variant"}`}>{remaining > 0 ? remaining : 0}/{s.capacity}</span>
                              </div>
                              {!isFull && (
                                <button
                                  onClick={() => handleAgendar(s, cell.enrolled)}
                                  className="mt-2 w-full text-center py-1 rounded-lg text-[10px] md:text-[11px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider transition-colors cursor-pointer"
                                  style={{ color: color, border: `1px solid ${color}30` }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${color}15`)}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
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
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant text-[10px] leading-[14px] md:text-[11px] uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
                  {uniqueDisciplines.map((d) => (
                    <div key={d!.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d!.color_hex }} />
                      <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant text-[10px] leading-[14px] md:text-[11px] uppercase tracking-wider">{d!.name}</span>
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
