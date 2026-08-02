"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { chileDateToUtc, chileMonthsBackStart, chileMonthKey } from "@/lib/dates";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MonthData { name: string; count: number; }

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function NewStudentsChart() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const monthsBack = 11;
    const startUtc = chileDateToUtc(chileMonthsBackStart(monthsBack));

    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", startUtc)
      .order("created_at", { ascending: true })
      .then(({ data: profiles }) => {
        const months: Record<string, number> = {};
        for (let i = monthsBack; i >= 0; i--) {
          const key = chileMonthsBackStart(i).slice(0, 7);
          months[key] = 0;
        }
        (profiles || []).forEach((p) => {
          const key = chileMonthKey(p.created_at);
          if (months[key] !== undefined) months[key]++;
        });
        const chartData: MonthData[] = Object.entries(months).map(([key, count]) => {
          const [, m] = key.split("-");
          return { name: MONTHS_ES[Number(m) - 1], count };
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
      <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">Nuevos Alumnos</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorAlumnos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff544c" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff544c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(229,226,225,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
            labelStyle={{ color: "#e4beb9", fontFamily: "var(--font-headline-md)" }}
            formatter={(value) => [`${value}`, "Alumnos"]}
          />
          <Area type="monotone" dataKey="count" stroke="#ff544c" strokeWidth={2} fill="url(#colorAlumnos)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
