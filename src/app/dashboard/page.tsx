"use client";

import { useSession } from "@/providers/SessionProvider";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "@/lib/supabase/dashboard";
import AlertBanner from "@/components/dashboard/AlertBanner";
import QuickStats from "@/components/dashboard/QuickStats";
import MembershipCard from "@/components/dashboard/MembershipCard";
import PaymentRow from "@/components/dashboard/PaymentRow";
import NotificationItem from "@/components/dashboard/NotificationItem";
import {
  StatsSkeleton,
  MembershipCardSkeleton,
  PaymentRowSkeleton,
  NotificationSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import { getUserNotifications, type NotificationData } from "@/lib/supabase/dashboard";

export default function DashboardPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getDashboardSummary(user.id),
      getUserNotifications(0, 3),
    ]).then(([summaryRes, notifRes]) => {
      if (summaryRes.error) setError(summaryRes.error);
      else setSummary(summaryRes.data);
      if (notifRes.data) setNotifications(notifRes.data.notifications);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;

  const firstName = (
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Atleta"
  )
    .split(" ")[0]
    .toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter mb-1">
          Bienvenido, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant">
          Tu zona de entrenamiento
        </p>
      </div>

      {loading ? (
        <>
          <StatsSkeleton />
          <MembershipCardSkeleton />
          <PaymentRowSkeleton />
        </>
      ) : error ? (
        <div className="glass-panel rounded-xl p-6 text-center">
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

          {summary.activeMemberships.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase">
                  Mis Membresías
                </h2>
                <Link
                  href="/dashboard/membresias"
                  className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.activeMemberships.slice(0, 2).map((m) => (
                  <MembershipCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {summary.recentPayments.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase">
                  Últimos Pagos
                </h2>
                <Link
                  href="/dashboard/pagos"
                  className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver historial →
                </Link>
              </div>
              <div className="bg-surface-container border border-on-surface/5 rounded-2xl px-5">
                {summary.recentPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </div>
            </section>
          )}

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
                className="bg-surface-container border border-on-surface/5 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 transition-colors group"
              >
                <span className="material-symbols-outlined text-primary text-[24px] group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </section>

          {notifications.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase">
                  Últimas Notificaciones
                </h2>
                <Link
                  href="/dashboard/notificaciones"
                  className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
                >
                  Ver todas →
                </Link>
              </div>
              <div className="bg-surface-container border border-on-surface/5 rounded-2xl px-5">
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
