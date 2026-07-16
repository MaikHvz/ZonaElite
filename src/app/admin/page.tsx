"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatsCard from "@/components/admin/StatsCard";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    activeMemberships: 0,
    products: 0,
    upcomingEvents: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "activa"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", new Date().toISOString().split("T")[0]),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
    ]).then(([users, members, prods, events, pays]) => {
      setStats({
        users: users.count || 0,
        activeMemberships: members.count || 0,
        products: prods.count || 0,
        upcomingEvents: events.count || 0,
        pendingPayments: pays.count || 0,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        <StatsCard icon="group" label="Usuarios Activos" value={stats.users} color="blue" />
        <StatsCard icon="card_membership" label="Membresías Activas" value={stats.activeMemberships} color="green" />
        <StatsCard icon="inventory_2" label="Productos" value={stats.products} />
        <StatsCard icon="emoji_events" label="Próximos Eventos" value={stats.upcomingEvents} color="yellow" />
        <StatsCard icon="payments" label="Pagos Pendientes" value={stats.pendingPayments} color="yellow" />
      </div>

      <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase tracking-tighter mb-4">
        Accesos Rápidos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/admin/productos", icon: "inventory_2", label: "Productos" },
          { href: "/admin/eventos", icon: "emoji_events", label: "Eventos" },
          { href: "/admin/usuarios", icon: "group", label: "Usuarios" },
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
