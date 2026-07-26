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

export default function MembresiasPage() {
  const { user } = useSession();
  const [memberships, setMemberships] = useState<MembershipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [enrollment, setEnrollment] = useState<EnrollmentStatus>({ hasActive: false, planName: null, endDate: null, beneficiaryId: null });
  const [enrollmentPlans, setEnrollmentPlans] = useState<EnrollmentPlan[]>([]);
  const [enrollCheckoutOpen, setEnrollCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await getUserMemberships(user.id);
      setMemberships(data?.memberships || []);

      // Fetch enrollment status
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
          .gte("end_date", new Date().toISOString().split("T")[0])
          .maybeSingle();

        const e = enrollData as { end_date: string; enrollment_plans?: { name: string } } | null;
        setEnrollment({
          hasActive: !!enrollData,
          planName: e?.enrollment_plans?.name || null,
          endDate: e?.end_date || null,
          beneficiaryId: ownBen.id,
        });
      }

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
        <div className={`glass-card p-4 flex items-center gap-4 ${
          enrollment.hasActive ? "border-l-4 border-l-green-500" : "border-l-4 border-l-amber-500"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            enrollment.hasActive ? "bg-green-500/10" : "bg-amber-500/10"
          }`}>
            <span className={`material-symbols-outlined text-[20px] ${
              enrollment.hasActive ? "text-green-400" : "text-amber-400"
            }`}>
              {enrollment.hasActive ? "badge" : "warning"}
            </span>
          </div>
          <div className="flex-1">
            {enrollment.hasActive ? (
              <>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                  Inscripción <strong>{enrollment.planName}</strong> vigente
                </p>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                  Vence el {formatDate(enrollment.endDate || "")}
                </p>
              </>
            ) : (
              <>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                  Sin inscripción a la academia
                </p>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                  Requisito para comprar membresías e inscribirte en clases
                </p>
              </>
            )}
          </div>
          {!enrollment.hasActive && enrollmentPlans.length > 0 && (
            <button
              onClick={() => setEnrollCheckoutOpen(true)}
              className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
            >
              Comprar Inscripción
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
