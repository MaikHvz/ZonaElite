"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getUserMemberships,
  type MembershipData,
} from "@/lib/supabase/dashboard";
import MembershipCard from "@/components/dashboard/MembershipCard";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import CheckoutModal from "@/components/CheckoutModal";
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

export default function MembresiasPage() {
  const { user } = useSession();
  const [memberships, setMemberships] = useState<MembershipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [enrollment, setEnrollment] = useState<EnrollmentStatus>({ hasActive: false, planName: null, endDate: null, beneficiaryId: null });
  const [allBeneficiaryEnrollments, setAllBeneficiaryEnrollments] = useState<BeneficiaryEnrollment[]>([]);
  const [enrollmentPlans, setEnrollmentPlans] = useState<EnrollmentPlan[]>([]);
  const [enrollCheckoutOpen, setEnrollCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await getUserMemberships(user.id);
      setMemberships(data?.memberships || []);

      const today = new Date().toISOString().split("T")[0];

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
      setLoading(false);
    })();
  }, [user]);

  const filtered =
    filter === "all"
      ? memberships
      : memberships.filter((m) => m.status === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "activa", label: "Activas" },
    { key: "vencida", label: "Vencidas" },
    { key: "cancelada", label: "Canceladas" },
  ];

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

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
                    {b.planName} — vence {new Date(b.endDate + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
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

      {/* Enrollment-only checkout */}
      {enrollCheckoutOpen && (
        <CheckoutModal
          open={enrollCheckoutOpen}
          onClose={() => setEnrollCheckoutOpen(false)}
          plan={null}
          mode="enrollment-only"
        />
      )}
    </div>
  );
}
