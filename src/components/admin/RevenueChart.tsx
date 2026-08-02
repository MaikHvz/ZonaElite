"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { chileDateToUtc, chileMonthsBackStart, chileMonthKey } from "@/lib/dates";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MonthData { name: string; amount: number; count: number; }

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function RevenueChart() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const monthsBack = 5;
    const startUtc = chileDateToUtc(chileMonthsBackStart(monthsBack));

    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("status", "pagado")
      .gte("paid_at", startUtc)
      .order("paid_at", { ascending: true })
      .then(({ data: payments }) => {
        const months: Record<string, { amount: number; count: number }> = {};
        for (let i = monthsBack; i >= 0; i--) {
          const key = chileMonthsBackStart(i).slice(0, 7);
          months[key] = { amount: 0, count: 0 };
        }
        (payments || []).forEach((p) => {
          if (!p.paid_at) return;
          const key = chileMonthKey(p.paid_at);
          if (months[key]) {
            months[key].amount += p.amount || 0;
            months[key].count += 1;
          }
        });
        const chartData: MonthData[] = Object.entries(months).map(([key, val]) => {
          const [, m] = key.split("-");
          return { name: MONTHS_ES[Number(m) - 1], amount: val.amount, count: val.count };
        });
        setData(chartData);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">Ingresos Mensuales</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(229,226,225,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
            labelStyle={{ color: "#e4beb9", fontFamily: "var(--font-headline-md)" }}
            formatter={(value) => [`$${Number(value).toLocaleString("es-CL")}`, "Ingresos"]}
          />
          <Bar dataKey="amount" fill="#ff544c" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
