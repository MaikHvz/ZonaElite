"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  chileDateToUtc,
  chileMonthStartDate,
  chileMonthEndDate,
  chilePrevMonthStartDate,
  chilePrevMonthEndDate,
  chileNextMonthStartDate,
} from "@/lib/dates";

interface Comparison { label: string; current: number; previous: number; diff: number; diffPct: number; icon: string; color: string; }

export default function MonthlyComparison() {
  const [data, setData] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const thisStart = chileDateToUtc(chileMonthStartDate());
    const thisEnd = chileDateToUtc(chileNextMonthStartDate());
    const lastStart = chileDateToUtc(chilePrevMonthStartDate());
    const lastEnd = chileDateToUtc(chileMonthStartDate());
    const thisStartDate = chileMonthStartDate();
    const thisEndDate = chileMonthEndDate();
    const lastStartDate = chilePrevMonthStartDate();
    const lastEndDate = chilePrevMonthEndDate();

    Promise.all([
      supabase.from("payments").select("amount").eq("status", "pagado").gte("paid_at", thisStart).lt("paid_at", thisEnd),
      supabase.from("payments").select("amount").eq("status", "pagado").gte("paid_at", lastStart).lt("paid_at", lastEnd),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thisStart).lt("created_at", thisEnd),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", lastStart).lt("created_at", lastEnd),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "activa").gte("created_at", thisStart).lt("created_at", thisEnd),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "activa").gte("created_at", lastStart).lt("created_at", lastEnd),
      supabase.from("memberships").select("id", { count: "exact", head: true }).gte("start_date", thisStartDate).lte("start_date", thisEndDate),
      supabase.from("memberships").select("id", { count: "exact", head: true }).gte("start_date", lastStartDate).lte("start_date", lastEndDate),
    ]).then(([rThisPay, rLastPay, rThisUsers, rLastUsers, rThisMembers, rLastMembers, rThisAssign, rLastAssign]) => {
      const thisRevenue = (rThisPay.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const lastRevenue = (rLastPay.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const thisUsers = rThisUsers.count || 0;
      const lastUsers = rLastUsers.count || 0;
      const thisMembers = rThisMembers.count || 0;
      const lastMembers = rLastMembers.count || 0;
      const thisAssign = rThisAssign.count || 0;
      const lastAssign = rLastAssign.count || 0;

      const diff = (cur: number, prev: number) => {
        const d = cur - prev;
        const pct = prev > 0 ? ((d / prev) * 100) : (cur > 0 ? 100 : 0);
        return { diff: d, diffPct: Math.round(pct) };
      };

      const r1 = diff(thisRevenue, lastRevenue);
      const r2 = diff(thisUsers, lastUsers);
      const r3 = diff(thisMembers, lastMembers);
      const r4 = diff(thisAssign, lastAssign);

      setData([
        { label: "Ingresos", current: thisRevenue, previous: lastRevenue, icon: "payments", color: "green", ...r1 },
        { label: "Nuevos Usuarios", current: thisUsers, previous: lastUsers, icon: "person_add", color: "blue", ...r2 },
        { label: "Membresías Nuevas", current: thisMembers, previous: lastMembers, icon: "card_membership", color: "primary", ...r3 },
        { label: "Asignaciones Manuales", current: thisAssign, previous: lastAssign, icon: "assignment", color: "yellow", ...r4 },
      ]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const colorMap: Record<string, string> = {
    primary: "text-primary",
    green: "text-green-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">Comparación Mensual</h3>
      <div className="space-y-4">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between py-2 border-b border-on-surface/5 last:border-0">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined ${colorMap[d.color] || "text-primary"} text-[20px]`}>{d.icon}</span>
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{d.label}</p>
                <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">Mes anterior: {d.label === "Ingresos" ? `$${d.previous.toLocaleString("es-CL")}` : d.previous}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface">
                {d.label === "Ingresos" ? `$${d.current.toLocaleString("es-CL")}` : d.current}
              </p>
              <p className={`font-[family-name:var(--font-label-sm)] text-[11px] ${d.diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                {d.diff >= 0 ? "+" : ""}{d.diffPct}% vs mes anterior
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
