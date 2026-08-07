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
import BeneficiaryCard, { type InscriptionInfo } from "@/components/dashboard/BeneficiaryCard";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import CheckoutModal from "@/components/CheckoutModal";
import PersonalizedCheckoutModal from "@/components/PersonalizedCheckoutModal";
import PersonalizedEnrollModal from "@/components/PersonalizedEnrollModal";
import type { EnrollmentPlan } from "@/components/CheckoutModal";

type Filter = "all" | "activa" | "vencida" | "cancelada";

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

  // Per-beneficiary inscription map keyed by beneficiary_id
  const [inscriptionMap, setInscriptionMap] = useState<Record<string, InscriptionInfo>>({});

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
      const newInscriptionMap: Record<string, InscriptionInfo> = {};

      // ── Own beneficiary inscription ───────────────────────────────
      const { data: ownBen } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (ownBen) {
        const { data: enrollData } = await supabase
          .from("academy_enrollments")
          .select("end_date, enrollment_plans(name)")
          .eq("beneficiary_id", ownBen.id)
          .eq("status", "activa")
          .gte("end_date", today)
          .maybeSingle();

        const e = enrollData as { end_date: string; enrollment_plans?: { name: string } } | null;
        newInscriptionMap[ownBen.id] = {
          hasActive: !!e,
          planName: e?.enrollment_plans?.name || null,
          endDate: e?.end_date || null,
        };
      }

      // ── Dependents inscriptions ───────────────────────────────────
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
              {
                planName: (Array.isArray(e.enrollment_plans) ? e.enrollment_plans[0] : e.enrollment_plans) as { name: string } | null,
                endDate: e.end_date,
              },
            ])
          );

          for (const dep of deps as Array<{ id: string; full_name: string; beneficiaries: unknown }>) {
            const b = dep.beneficiaries;
            const benId = Array.isArray(b) ? (b[0] as { id: string })?.id : (b as { id: string } | null)?.id;
            if (!benId) continue;
            const enroll = enrollMap.get(benId);
            newInscriptionMap[benId] = {
              hasActive: !!enroll,
              planName: enroll?.planName?.name || null,
              endDate: enroll?.endDate || null,
            };
          }
        }
      }

      setInscriptionMap(newInscriptionMap);

      // ── Enrollment plans for checkout ─────────────────────────────
      const { data: plans } = await supabase
        .from("enrollment_plans")
        .select("id, name, price, duration_days")
        .eq("active", true)
        .order("sort_order");

      setEnrollmentPlans((plans as EnrollmentPlan[]) || []);

      // ── Clases personalizadas ─────────────────────────────────────
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

  // ── Filters for historical memberships ─────────────────────────────────────
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

  // ── Build beneficiary view models ───────────────────────────────────────────
  const today = getChileToday();
  const beneficiaryViewModels = personalizedBeneficiaries.map((b) => ({
    ...b,
    inscription: inscriptionMap[b.id] || { hasActive: false, planName: null, endDate: null },
    activeMembership:
      memberships.find(
        (m) =>
          m.beneficiary_id === b.id &&
          effectiveMembershipStatus(m.status, m.end_date, today) === "activa"
      ) || null,
  }));

  const anyMissingInscription = beneficiaryViewModels.some((b) => !b.inscription.hasActive);

  return (
    <div className="space-y-8">
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Membresías</span>
      </h1>

      {/* ── BENEFICIARY CARDS GRID ────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MembershipCardSkeleton />
          <MembershipCardSkeleton />
        </div>
      ) : beneficiaryViewModels.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            person_off
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
            No se encontró tu perfil de beneficiario. Solicita a la academia que lo configure.
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-on-surface-variant font-[family-name:var(--font-body-md)]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              {beneficiaryViewModels.filter((b) => b.inscription.hasActive && !!b.activeMembership).length} con cobertura completa
            </div>
            <div className="flex items-center gap-2 text-[12px] text-on-surface-variant font-[family-name:var(--font-body-md)]">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              {beneficiaryViewModels.filter(
                (b) => b.inscription.hasActive !== !!b.activeMembership
              ).length} con cobertura parcial
            </div>
            {anyMissingInscription && enrollmentPlans.length > 0 && (
              <button
                onClick={() => setEnrollCheckoutOpen(true)}
                className="ml-auto flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400 border border-amber-400/30 px-3 py-1.5 rounded-full hover:bg-amber-400/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">add_shopping_cart</span>
                Comprar inscripción
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {beneficiaryViewModels.map((b) => (
              <BeneficiaryCard
                key={b.id}
                beneficiaryId={b.id}
                name={b.name}
                isSelf={b.isSelf}
                inscription={b.inscription}
                activeMembership={b.activeMembership}
                packs={b.packs}
                hasEnrollmentPlans={enrollmentPlans.length > 0}
                hasPersonalizedPlans={personalizedPlansCount > 0}
                onBuyInscription={() => setEnrollCheckoutOpen(true)}
                onBuyPack={(benId) => {
                  setCheckoutBeneficiaryId(benId);
                  setPersonalizedCheckoutOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ── HISTORIAL DE MEMBRESÍAS ───────────────────────────────────────── */}
      {!loading && memberships.length > 0 && (
        <div className="pt-2">
          <div className="mb-5">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase tracking-tighter">
              Historial de <span className="text-primary">Membresías</span>
            </h2>
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mt-1">
              Todas las membresías de tu cuenta, incluyendo las vencidas y canceladas.
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
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

          {filtered.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
                card_membership
              </span>
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-4">
                No hay membresías con este filtro
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
        </div>
      )}

      {/* ── PRÓXIMAS CLASES PERSONALIZADAS ───────────────────────────────── */}
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
                    <span
                      className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        row.userEnrolled
                          ? "bg-green-500/10 text-green-400"
                          : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
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

      {/* ── EMPTY STATE (no memberships at all) ─────────────────────────── */}
      {!loading && memberships.length === 0 && (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            card_membership
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-4">
            Aún no tienes membresías
          </p>
          <Link
            href="/#membresias"
            className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            Ver planes de membresía →
          </Link>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
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

      {enrollCheckoutOpen && (
        <CheckoutModal
          open={enrollCheckoutOpen}
          onClose={() => setEnrollCheckoutOpen(false)}
          plan={null}
          mode="enrollment-only"
        />
      )}

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
