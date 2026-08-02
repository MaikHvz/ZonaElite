"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, addDaysChile, chileDateToUtc, chileMonthStartDate } from "@/lib/dates";
import StatsCard from "@/components/admin/StatsCard";
import RevenueChart from "@/components/admin/RevenueChart";
import MembershipBreakdown from "@/components/admin/MembershipBreakdown";
import NewStudentsChart from "@/components/admin/NewStudentsChart";
import MonthlyComparison from "@/components/admin/MonthlyComparison";
import PaymentOverview from "@/components/admin/PaymentOverview";
import AttendanceOverview from "@/components/admin/AttendanceOverview";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    activeMemberships: 0,
    products: 0,
    upcomingEvents: 0,
    pendingPayments: 0,
    totalRevenue: 0,
    thisMonthRevenue: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const thisMonthStart = chileDateToUtc(chileMonthStartDate());
    const thirtyDaysAgo = chileDateToUtc(addDaysChile(getChileToday(), -30));

    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "activa"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", getChileToday()),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
      supabase.from("payments").select("amount").eq("status", "pagado"),
      supabase.from("payments").select("amount").eq("status", "pagado").gte("paid_at", thisMonthStart),
      supabase.from("attendance").select("status").gte("marked_at", thirtyDaysAgo),
    ]).then(([users, members, prods, events, pays, allPays, monthPays, attRes]) => {
      const totalRevenue = (allPays.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const thisMonthRevenue = (monthPays.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const attRows = (attRes.data || []) as Array<{ status: string }>;
      const attTotal = attRows.length;
      const attPresent = attRows.filter((r) => r.status === "presente").length;
      const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;
      setStats({
        users: users.count || 0,
        activeMemberships: members.count || 0,
        products: prods.count || 0,
        upcomingEvents: events.count || 0,
        pendingPayments: pays.count || 0,
        totalRevenue,
        thisMonthRevenue,
        attendanceRate,
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter mb-8">
        Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
        <StatsCard icon="group" label="Usuarios Activos" value={stats.users} color="blue" />
        <StatsCard icon="card_membership" label="Membresías Activas" value={stats.activeMemberships} color="green" />
        <StatsCard icon="payments" label="Ingresos Mes" value={`$${stats.thisMonthRevenue.toLocaleString("es-CL")}`} color="green" />
        <StatsCard icon="emoji_events" label="Próximos Eventos" value={stats.upcomingEvents} color="yellow" />
        <StatsCard icon="pending_actions" label="Pagos Pendientes" value={stats.pendingPayments} color="yellow" />
        <StatsCard icon="fact_check" label="Asistencia (30d)" value={`${stats.attendanceRate}%`} color="green" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueChart />
        <NewStudentsChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <MonthlyComparison />
        </div>
        <div className="space-y-6">
          <MembershipBreakdown />
          <PaymentOverview />
        </div>
      </div>

      {/* Attendance Analytics */}
      <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase tracking-tighter mb-4">
        Asistencia
      </h2>
      <div className="mb-8">
        <AttendanceOverview />
      </div>

      {/* Quick Links */}
      <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase tracking-tighter mb-4">
        Accesos Rápidos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/admin/usuarios", icon: "group", label: "Usuarios" },
          { href: "/admin/membresias", icon: "card_membership", label: "Membresías" },
          { href: "/admin/productos", icon: "inventory_2", label: "Productos" },
          { href: "/admin/eventos", icon: "emoji_events", label: "Eventos" },
          { href: "/admin/horarios", icon: "schedule", label: "Horarios" },
          { href: "/admin/blog", icon: "article", label: "Blog" },
          { href: "/admin/notificaciones", icon: "notifications", label: "Notificaciones" },
          { href: "/admin/configuracion", icon: "settings", label: "Configuración" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 bg-surface-container border border-on-surface/5 rounded-xl p-4 hover:border-primary/30 transition-colors group"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">{item.icon}</span>
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface group-hover:text-primary transition-colors">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
