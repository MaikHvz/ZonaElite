"use client";

import { useSession } from "@/providers/SessionProvider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "@/lib/supabase/dashboard";
import AlertBanner from "@/components/dashboard/AlertBanner";
import QuickStats from "@/components/dashboard/QuickStats";
import MembershipCard from "@/components/dashboard/MembershipCard";
import PaymentRow from "@/components/dashboard/PaymentRow";
import NotificationItem from "@/components/dashboard/NotificationItem";
import AttendanceSummary from "@/components/dashboard/AttendanceSummary";
import {
  StatsSkeleton,
  MembershipCardSkeleton,
  PaymentRowSkeleton,
  HeroSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import { getUserNotifications, type NotificationData } from "@/lib/supabase/dashboard";

interface EnrollmentStatus {
  hasActive: boolean;
  planName: string | null;
  endDate: string | null;
  loading: boolean;
}

export default function DashboardPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentStatus>({ hasActive: false, planName: null, endDate: null, loading: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    (async () => {
      const [summaryRes, notifRes] = await Promise.all([
        getDashboardSummary(user.id),
        getUserNotifications(0, 3),
      ]);

      if (summaryRes.error) setError(summaryRes.error);
      else setSummary(summaryRes.data);
      if (notifRes.data) setNotifications(notifRes.data.notifications);

      // Fetch enrollment status for own beneficiary
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
          hasActive: !!e,
          planName: e?.enrollment_plans?.name || null,
          endDate: e?.end_date || null,
          loading: false,
        });
      } else {
        setEnrollment({ hasActive: false, planName: null, endDate: null, loading: false });
      }

      setLoading(false);
    })();
  }, [user]);

  if (!user) return null;

  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Atleta";
  const firstName = fullName.split(" ")[0].toUpperCase();
  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero Greeting */}
      {loading ? (
        <HeroSkeleton />
      ) : (
        <div className="glass-card bg-gradient-to-br from-primary-container/8 via-transparent to-transparent p-5 md:p-7 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 md:gap-5 relative z-10">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl btn-primary-gradient flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(255,84,76,0.25)]">
              <span className="font-[family-name:var(--font-headline-md)] text-white text-[20px] md:text-[22px]">
                {initials}
              </span>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-headline-lg)] text-[26px] md:text-[34px] text-on-surface uppercase tracking-tighter leading-tight">
                Hola, <span className="text-primary">{firstName}</span>
              </h1>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface-variant mt-0.5">
                Tu zona de entrenamiento
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment Status Card */}
      {!loading && (
        <div className={`glass-card p-4 flex items-center gap-4 ${
          enrollment.loading
            ? ""
            : enrollment.hasActive
              ? "border-l-4 border-l-green-500"
              : "border-l-4 border-l-amber-500"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            enrollment.loading
              ? "bg-on-surface/5"
              : enrollment.hasActive
                ? "bg-green-500/10"
                : "bg-amber-500/10"
          }`}>
            <span className={`material-symbols-outlined text-[20px] ${
              enrollment.loading
                ? "text-on-surface/20"
                : enrollment.hasActive
                  ? "text-green-400"
                  : "text-amber-400"
            }`}>
              {enrollment.loading ? "hourglass_empty" : enrollment.hasActive ? "badge" : "warning"}
            </span>
          </div>
          <div className="flex-1">
            {enrollment.loading ? (
              <div className="h-4 bg-on-surface/5 rounded animate-pulse w-48" />
            ) : enrollment.hasActive ? (
              <>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                  Inscripción <strong>{enrollment.planName}</strong> vigente
                </p>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                  Vence el {new Date(enrollment.endDate + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
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
          {!enrollment.loading && !enrollment.hasActive && (
            <Link
              href="/dashboard/membresias"
              className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors"
            >
              Comprar
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <>
          <StatsSkeleton />
          <MembershipCardSkeleton />
          <PaymentRowSkeleton />
        </>
      ) : error ? (
        <div className="glass-card p-6 text-center">
          <span className="material-symbols-outlined text-red-400 text-[32px] mb-3 block">
            error_outline
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : summary ? (
        <>
          <AlertBanner memberships={summary.allMemberships} />

          <QuickStats
            activeCount={summary.activeMemberships.length}
            paidThisMonth={summary.paidThisMonth}
            dependentsCount={summary.dependentsCount}
          />

          <AttendanceSummary userId={user.id} />

          {summary.activeMemberships.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
                  Mis Membresías
                </h2>
                <Link
                  href="/dashboard/membresias"
                  className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {summary.activeMemberships.slice(0, 2).map((m) => (
                  <MembershipCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {summary.recentPayments.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
                  Últimos Pagos
                </h2>
                <Link
                  href="/dashboard/pagos"
                  className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver historial →
                </Link>
              </div>
              <div className="glass-card px-4 md:px-5">
                {summary.recentPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </div>
            </section>
          )}

          {/* Quick Access Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/horarios", icon: "calendar_month", label: "Horarios" },
              { href: "/perfil", icon: "person", label: "Mi Perfil" },
              { href: "/productos", icon: "storefront", label: "Tienda" },
              { href: "/eventos", icon: "emoji_events", label: "Eventos" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="glass-card !rounded-xl p-4 flex flex-col items-center gap-2.5 group hover:scale-[1.03] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <span className="material-symbols-outlined text-primary text-[22px] group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </span>
                </div>
                <span className="font-[family-name:var(--font-body-md)] text-[12px] md:text-[13px] text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </section>

          {notifications.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
                  Últimas Notificaciones
                </h2>
                <Link
                  href="/dashboard/notificaciones"
                  className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
              <div className="glass-card px-4 md:px-5">
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
