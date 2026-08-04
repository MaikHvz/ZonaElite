"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getChileToday } from "@/lib/dates";
import {
  getUserMemberships,
  getUserPersonalizedData,
  getActivePersonalizedPlans,
  type MembershipData,
  type PersonalizedBeneficiary,
} from "@/lib/supabase/dashboard";
import { effectiveMembershipStatus } from "@/lib/membership-status";
import MembershipCard from "@/components/dashboard/MembershipCard";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import CheckoutModal from "@/components/CheckoutModal";
import PersonalizedCheckoutModal from "@/components/PersonalizedCheckoutModal";
import PersonalizedEnrollModal from "@/components/PersonalizedEnrollModal";
import StatusBadge from "@/components/admin/StatusBadge";
import type { EnrollmentPlan } from "@/components/CheckoutModal";

type Filter = "all" | "activa" | "vencida" | "cancelada";

interface EnrollmentStatus {
  hasActive: boolean;
  planName: string | null;
  endDate: string | null;
  beneficiaryId: string | null;
}

interface BeneficiaryEnrollment {
  name: string;
  hasActive: boolean;
  planName: string | null;
  endDate: string | null;
}

interface PersonalizedScheduleRow {
  schedule: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    capacity: number;
    room: string | null;
    mode: string;
    disciplines: { name: string; color_hex: string; icon: string } | null;
    profiles: { full_name: string } | null;
    personalized_schedule_plans: { plan_id: string }[];
  };
  nextSession: { id: string; session_date: string; enrolled: number } | null;
  userEnrolled: boolean;
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function MembresiasPage() {
  const { user } = useSession();
  const [memberships, setMemberships] = useState<MembershipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [enrollment, setEnrollment] = useState<EnrollmentStatus>({ hasActive: false, planName: null, endDate: null, beneficiaryId: null });
  const [allBeneficiaryEnrollments, setAllBeneficiaryEnrollments] = useState<BeneficiaryEnrollment[]>([]);
  const [enrollmentPlans, setEnrollmentPlans] = useState<EnrollmentPlan[]>([]);
  const [enrollCheckoutOpen, setEnrollCheckoutOpen] = useState(false);
  const [personalizedBeneficiaries, setPersonalizedBeneficiaries] = useState<PersonalizedBeneficiary[]>([]);
  const [personalizedPlansCount, setPersonalizedPlansCount] = useState(0);
  const [personalizedCheckoutOpen, setPersonalizedCheckoutOpen] = useState(false);
  const [checkoutBeneficiaryId, setCheckoutBeneficiaryId] = useState<string | null>(null);
  const [personalizedSchedules, setPersonalizedSchedules] = useState<PersonalizedScheduleRow[]>([]);
  const [enrollScheduleOpen, setEnrollScheduleOpen] = useState(false);
  const [enrollSchedule, setEnrollSchedule] = useState<PersonalizedScheduleRow["schedule"] | null>(null);

  const loadPersonalizedSchedules = useCallback(async (benIds: string[]) => {
    const supabase = createClient();
    const today = getChileToday();

    const { data: pSchedules } = await supabase
      .from("schedules")
      .select("*, disciplines(name, color_hex, icon), profiles(full_name), personalized_schedule_plans(plan_id)")
      .eq("mode", "personalizado")
      .eq("active", true)
      .order("start_time");

    const rows: PersonalizedScheduleRow[] = [];
    for (const s of (pSchedules || []) as unknown as Array<Record<string, unknown>>) {
      const { data: nextSessions } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .eq("schedule_id", s.id as string)
        .gte("session_date", today)
        .order("session_date")
        .limit(3);

      const next = (nextSessions || [])[0] as { id: string; session_date: string } | undefined;
      if (!next) continue;

      const { count } = await supabase
        .from("personalized_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("session_id", next.id);

      let userEnrolled = false;
      if (benIds.length > 0) {
        const { data: myEnrollments } = await supabase
          .from("personalized_enrollments")
          .select("beneficiary_id")
          .eq("session_id", next.id)
          .in("beneficiary_id", benIds);
        userEnrolled = (myEnrollments || []).length > 0;
      }

      rows.push({
        schedule: s as unknown as PersonalizedScheduleRow["schedule"],
        nextSession: { id: next.id, session_date: next.session_date, enrolled: count || 0 },
        userEnrolled,
      });
    }
    setPersonalizedSchedules(rows);
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await getUserMemberships(user.id);
      setMemberships(data?.memberships || []);

      const today = getChileToday();

      // Fetch enrollment status for own beneficiary
      const { data: ownBen } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      const beneficiaryEnrollments: BeneficiaryEnrollment[] = [];

      if (ownBen) {
        const { data: enrollData } = await supabase
          .from("academy_enrollments")
          .select("end_date, enrollment_plans(name)")
          .eq("beneficiary_id", ownBen.id)
          .eq("status", "activa")
          .gte("end_date", today)
          .maybeSingle();

        const e = enrollData as { end_date: string; enrollment_plans?: { name: string } } | null;
        setEnrollment({
          hasActive: !!enrollData,
          planName: e?.enrollment_plans?.name || null,
          endDate: e?.end_date || null,
          beneficiaryId: ownBen.id,
        });

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        beneficiaryEnrollments.push({
          name: (profile as { full_name: string } | null)?.full_name || "Tú",
          hasActive: !!e,
          planName: e?.enrollment_plans?.name || null,
          endDate: e?.end_date || null,
        });
      }

      // Fetch enrollment for dependents
      const { data: deps } = await supabase
        .from("dependents")
        .select("id, full_name, beneficiaries(id)")
        .eq("tutor_id", user.id);

      if (deps && deps.length > 0) {
        const depBenIds = (deps as Array<{ id: string; full_name: string; beneficiaries: unknown }>)
          .map((d) => {
            const b = d.beneficiaries;
            if (!b) return null;
            return Array.isArray(b) ? (b[0] as { id: string })?.id : (b as { id: string }).id;
          })
          .filter(Boolean) as string[];

        if (depBenIds.length > 0) {
          const { data: depEnrolls } = await supabase
            .from("academy_enrollments")
            .select("beneficiary_id, end_date, enrollment_plans(name)")
            .in("beneficiary_id", depBenIds)
            .eq("status", "activa")
            .gte("end_date", today);

          const enrollMap = new Map(
            (depEnrolls || []).map((e: { beneficiary_id: string; end_date: string; enrollment_plans: unknown }) => [
              e.beneficiary_id,
              { planName: (Array.isArray(e.enrollment_plans) ? e.enrollment_plans[0] : e.enrollment_plans) as { name: string } | null, endDate: e.end_date },
            ])
          );

          for (const dep of deps as Array<{ id: string; full_name: string; beneficiaries: unknown }>) {
            const b = dep.beneficiaries;
            const benId = Array.isArray(b) ? (b[0] as { id: string })?.id : (b as { id: string } | null)?.id;
            const enroll = benId ? enrollMap.get(benId) : null;
            beneficiaryEnrollments.push({
              name: dep.full_name,
              hasActive: !!enroll,
              planName: enroll?.planName?.name || null,
              endDate: enroll?.endDate || null,
            });
          }
        }
      }

      setAllBeneficiaryEnrollments(beneficiaryEnrollments);

      // Fetch enrollment plans for checkout
      const { data: plans } = await supabase
        .from("enrollment_plans")
        .select("id, name, price, duration_days")
        .eq("active", true)
        .order("sort_order");

      setEnrollmentPlans((plans as EnrollmentPlan[]) || []);

      // Clases personalizadas (módulo desacoplado)
      const [persData, persPlans] = await Promise.all([
        getUserPersonalizedData(user.id),
        getActivePersonalizedPlans(),
      ]);
      const beneficiaries = persData.data?.beneficiaries || [];
      setPersonalizedBeneficiaries(beneficiaries);
      setPersonalizedPlansCount((persPlans.data || []).length);
      await loadPersonalizedSchedules(beneficiaries.map((b) => b.id));
      setLoading(false);
    })();
  }, [user, loadPersonalizedSchedules]);

  const filtered = (() => {
    const today = getChileToday();
    if (filter === "all") return memberships;
    return memberships.filter(
      (m) => effectiveMembershipStatus(m.status, m.end_date, today) === filter
    );
  })();

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "activa", label: "Activas" },
    { key: "vencida", label: "Vencidas" },
    { key: "cancelada", label: "Canceladas" },
  ];

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  const packEffectiveStatus = (p: { status: string; end_date: string }): string => {
    if (p.status === "activa" && p.end_date < getChileToday()) return "vencida";
    return p.status;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Membresías</span>
      </h1>

      {/* Enrollment Status */}
      {!loading && (
        <div className={`glass-card p-4 border-l-4 ${
          allBeneficiaryEnrollments.every((b) => b.hasActive)
            ? "border-l-green-500"
            : allBeneficiaryEnrollments.some((b) => b.hasActive)
              ? "border-l-amber-500"
              : "border-l-red-500"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              allBeneficiaryEnrollments.every((b) => b.hasActive)
                ? "bg-green-500/10"
                : "bg-amber-500/10"
            }`}>
              <span className={`material-symbols-outlined text-[20px] ${
                allBeneficiaryEnrollments.every((b) => b.hasActive)
                  ? "text-green-400"
                  : "text-amber-400"
              }`}>
                badge
              </span>
            </div>
            <div>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                Inscripciones a la academia
              </p>
              <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                {allBeneficiaryEnrollments.filter((b) => b.hasActive).length} de {allBeneficiaryEnrollments.length} {allBeneficiaryEnrollments.length === 1 ? "beneficiario con" : "beneficiarios con"} inscripción activa
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {allBeneficiaryEnrollments.map((b) => (
              <div key={b.name} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                b.hasActive ? "bg-green-500/5" : "bg-amber-500/5"
              }`}>
                <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface">{b.name}</span>
                {b.hasActive ? (
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400">
                    {b.planName} — vence {new Date(b.endDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ) : (
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400">
                    Sin inscripción
                  </span>
                )}
              </div>
            ))}
          </div>

          {allBeneficiaryEnrollments.some((b) => !b.hasActive) && enrollmentPlans.length > 0 && (
            <button
              onClick={() => setEnrollCheckoutOpen(true)}
              className="mt-3 flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400 hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
              Comprar inscripción
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-2 rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-on-surface-variant border-on-surface/10 hover:border-on-surface/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <MembershipCardSkeleton />
          <MembershipCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            card_membership
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-4">
            {filter === "all"
              ? "Aún no tienes membresías"
              : "No hay membresías con este filtro"}
          </p>
          <Link
            href="/#membresias"
            className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            Ver planes de membresía →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MembershipCard key={m.id} membership={m} />
          ))}
        </div>
      )}

      {/* Mis Clases Personalizadas */}
      {!loading && (
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase tracking-tighter">
                Mis <span className="text-primary">Clases Personalizadas</span>
              </h2>
              <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mt-1">
                Packs 1 a 1 o grupos pequeños, desacoplados de tu membresía regular.
              </p>
            </div>
            {personalizedPlansCount > 0 && (
              <button
                onClick={() => {
                  setCheckoutBeneficiaryId(null);
                  setPersonalizedCheckoutOpen(true);
                }}
                className="flex items-center gap-2 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                Comprar pack
              </button>
            )}
          </div>

          {personalizedPlansCount === 0 ? (
            <div className="glass-panel rounded-xl p-6 text-center">
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
                No hay planes de clases personalizadas disponibles por ahora.
              </p>
            </div>
          ) : personalizedBeneficiaries.length === 0 ? (
            <div className="glass-panel rounded-xl p-6 text-center">
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
                No encontramos tu perfil de beneficiario. Solicita a la academia que lo cree.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personalizedBeneficiaries.map((b) => (
                <div key={b.id} className="glass-card p-5 border-on-surface/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                      <h3 className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                        {b.name}
                        {b.isSelf && (
                          <span className="ml-1.5 text-[10px] text-on-surface-variant font-[family-name:var(--font-label-sm)]">
                            Titular
                          </span>
                        )}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setCheckoutBeneficiaryId(b.id);
                        setPersonalizedCheckoutOpen(true);
                      }}
                      className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      Comprar
                    </button>
                  </div>

                  {b.packs.length === 0 ? (
                    <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant/60 italic">
                      Sin packs de clases personalizadas
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {b.packs.map((p) => {
                        const effective = packEffectiveStatus(p);
                        const remaining = Math.max(0, p.total_classes - p.used_classes);
                        return (
                          <div key={p.id} className="p-3 rounded-lg bg-surface-container-lowest/50 border border-on-surface/5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                                {p.plan?.name || "Plan"}
                              </p>
                              <StatusBadge status={effective} />
                            </div>
                            <div className="flex items-center justify-between mt-2 font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                              <span>
                                {p.used_classes} de {p.total_classes} clases usadas
                              </span>
                              {effective === "activa" && (
                                <span className="text-primary/80">
                                  {remaining} restante{remaining === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5">
                              <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${p.total_classes > 0 ? Math.min(100, (p.used_classes / p.total_classes) * 100) : 0}%`,
                                    background:
                                      effective === "activa"
                                        ? "linear-gradient(90deg, #ff544c, #d32f2f)"
                                        : "linear-gradient(90deg, #78716c, #57534e)",
                                  }}
                                />
                              </div>
                            </div>
                            <p className="mt-1.5 font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant">
                              Vigencia hasta{" "}
                              {new Date(p.end_date + "T12:00:00").toLocaleDateString("es-CL", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Próximas Clases Personalizadas (Horario) */}
      {!loading && personalizedSchedules.length > 0 && (
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase tracking-tighter">
                Próximas <span className="text-primary">Clases Personalizadas</span>
              </h2>
              <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mt-1">
                Bloques horarios reservados. Agenda con las clases de tu pack.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalizedSchedules.map((row) => (
              <div key={row.schedule.id} className="glass-card p-5 border-on-surface/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ color: row.schedule.disciplines?.color_hex || "#a855f7" }}
                    >
                      {row.schedule.disciplines?.icon || "sports_martial_arts"}
                    </span>
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                      {row.schedule.disciplines?.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setEnrollSchedule(row.schedule);
                      setEnrollScheduleOpen(true);
                    }}
                    className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      row.userEnrolled
                        ? "text-primary border border-primary/30 hover:bg-primary/10"
                        : "btn-primary-gradient text-white"
                    }`}
                  >
                    {row.userEnrolled ? "Ver / Cambiar" : "Agendar"}
                  </button>
                </div>
                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                  {DAY_NAMES[row.schedule.day_of_week]} · {row.schedule.start_time.slice(0, 5)} - {row.schedule.end_time.slice(0, 5)}
                  {row.schedule.room ? ` · Sala ${row.schedule.room}` : ""}
                </p>
                {row.nextSession && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant/70">
                      Próxima: {new Date(row.nextSession.session_date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </span>
                    <span className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      row.userEnrolled
                        ? "bg-green-500/10 text-green-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {row.userEnrolled
                        ? "Inscrito"
                        : `${Math.max(0, row.schedule.capacity - row.nextSession.enrolled)} cupos`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {enrollScheduleOpen && enrollSchedule && (
        <PersonalizedEnrollModal
          open={enrollScheduleOpen}
          schedule={enrollSchedule as never}
          userId={user?.id || ""}
          onClose={() => setEnrollScheduleOpen(false)}
          onEnrolled={() => {
            loadPersonalizedSchedules(personalizedBeneficiaries.map((b) => b.id));
          }}
        />
      )}

      {/* Enrollment-only checkout */}
      {enrollCheckoutOpen && (
        <CheckoutModal
          open={enrollCheckoutOpen}
          onClose={() => setEnrollCheckoutOpen(false)}
          plan={null}
          mode="enrollment-only"
        />
      )}

      {/* Personalized classes checkout */}
      {personalizedCheckoutOpen && (
        <PersonalizedCheckoutModal
          open={personalizedCheckoutOpen}
          onClose={() => setPersonalizedCheckoutOpen(false)}
          defaultBeneficiaryId={checkoutBeneficiaryId}
        />
      )}
    </div>
  );
}
