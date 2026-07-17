"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface PlanStat { name: string; count: number; }
const COLORS = ["#ff544c", "#ffb4ac", "#ff8a80", "#ff6e67", "#ff3d34"];

export default function MembershipBreakdown() {
  const [data, setData] = useState<PlanStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("memberships")
      .select("plan_id, membership_plans(name)")
      .eq("status", "activa")
      .then(({ data: rows }) => {
        const counts: Record<string, number> = {};
        (rows || []).forEach((r: Record<string, unknown>) => {
          const plan = r.membership_plans as { name: string } | null;
          const name = plan?.name || "Sin plan";
          counts[name] = (counts[name] || 0) + 1;
        });
        const chartData = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        setData(chartData);
        setTotal(chartData.reduce((sum, d) => sum + d.count, 0));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">Membresías por Plan</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} dataKey="count" cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
              formatter={(value, name) => [`${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(0) : 0}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{d.name}</span>
              </div>
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">{d.count}</span>
            </div>
          ))}
          {data.length === 0 && (
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 italic">Sin membresías activas</p>
          )}
        </div>
      </div>
    </div>
  );
}
