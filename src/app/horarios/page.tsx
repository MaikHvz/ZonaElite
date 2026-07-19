"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Footer from "@/components/Footer";
import PageCTA from "@/components/PageCTA";

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
  userBeneficiaryId: string | null;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function HorariosPage() {
  const [grid, setGrid] = useState<Record<string, Record<string, ScheduleCell>>>({});
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; beneficiaryId: string | null; activePlan: string | null; category: string | null } | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const supabase = createClient();

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
        .eq("session_id", s.id);

      if (!enriched[time]) enriched[time] = {};
      enriched[time][day] = {
        schedule: s,
        enrolled: count || 0,
        userEnrolled: false,
        userBeneficiaryId: null,
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .single();

    if (!profile) return;

    const { data: beneficiary } = await supabase
      .from("beneficiaries")
      .select("id, category")
      .eq("profile_id", authUser.id)
      .maybeSingle();

    const { data: membership } = await supabase
      .from("memberships")
      .select("plan_id, membership_plans(name)")
      .eq("beneficiary_id", beneficiary?.id || "")
      .eq("status", "activa")
      .gte("end_date", new Date().toISOString().split("T")[0])
      .maybeSingle();

    setUser({
      id: authUser.id,
      beneficiaryId: beneficiary?.id || null,
      activePlan: membership?.plan_id || null,
      category: beneficiary?.category || null,
    });
  }, [supabase]);

  useEffect(() => {
    Promise.all([loadSchedule(), loadUser()]);
  }, [loadSchedule, loadUser]);

  const handleEnroll = async (schedule: Schedule) => {
    if (!user) {
      setOverlayMessage("Para agendar una clase debes iniciar sesión y tener un plan activo.");
      setShowOverlay(true);
      return;
    }

    if (!user.beneficiaryId) {
      setOverlayMessage("No se encontró tu perfil de beneficiario. Contacta al administrador.");
      setShowOverlay(true);
      return;
    }

    if (schedule.category === "ninos" && user.category !== "nino") {
      setOverlayMessage("Esta clase es solo para niños.");
      setShowOverlay(true);
      return;
    }

    if (schedule.category === "adultos" && user.category !== "adulto") {
      setOverlayMessage("Esta clase es solo para adultos.");
      setShowOverlay(true);
      return;
    }

    if (schedule.class_plans.length > 0 && !schedule.class_plans.some((cp) => cp.plan_id === user.activePlan)) {
      setOverlayMessage("Tu plan actual no está habilitado para esta clase. Revisa los planes disponibles.");
      setShowOverlay(true);
      return;
    }

    if (!user.activePlan) {
      setOverlayMessage("Necesitas un plan activo para inscribirte. Visita la sección de membresías.");
      setShowOverlay(true);
      return;
    }

    setEnrolling(schedule.id);
    const { error } = await supabase.from("class_enrollments").insert({
      session_id: schedule.id,
      beneficiary_id: user.beneficiaryId,
    });
    setEnrolling(null);

    if (error) {
      if (error.code === "23505") {
        setOverlayMessage("Ya estás inscrito en esta clase.");
      } else {
        setOverlayMessage("Error al inscribirse. Intenta nuevamente.");
      }
      setShowOverlay(true);
      return;
    }

    await loadSchedule();
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
        {/* Overlay */}
        {showOverlay && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOverlay(false)}>
            <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-[32px]">lock</span>
              </div>
              <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-3">Atención</h3>
              <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant leading-[24px] mb-6">{overlayMessage}</p>
              <div className="flex flex-col gap-3">
                <Link href="/auth" className="block text-center px-6 py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider hover:opacity-90 transition-opacity">
                  Iniciar Sesión
                </Link>
                <Link href="/dashboard/membresias" className="block text-center px-6 py-3 rounded-xl border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider">
                  Ver Membresías
                </Link>
                <button onClick={() => setShowOverlay(false)} className="text-[13px] text-on-surface-variant/60 hover:text-on-surface-variant transition-colors cursor-pointer">Cerrar</button>
              </div>
            </div>
          </div>
        )}

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
                                  onClick={() => handleEnroll(s)}
                                  disabled={enrolling === s.id || cell.userEnrolled}
                                  className="mt-2 w-full text-center py-1 rounded-lg text-[10px] md:text-[11px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                                  style={{ color: color, border: `1px solid ${color}30` }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${color}15`)}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  {enrolling === s.id ? "..." : cell.userEnrolled ? "Inscrito ✓" : "Agendar"}
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
