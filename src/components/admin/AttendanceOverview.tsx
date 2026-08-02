"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, addDaysChile, chileDateToUtc } from "@/lib/dates";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface DisciplineData {
  discipline: string;
  present: number;
  absent: number;
  justified: number;
  total: number;
  rate: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface TrendData {
  date: string;
  present: number;
  absent: number;
  justified: number;
  total: number;
  rate: number;
}

const STATUS_COLORS: Record<string, string> = {
  presente: "#4ade80",
  ausente: "#f87171",
  justificado: "#fbbf24",
};

const STATUS_LABELS: Record<string, string> = {
  presente: "Presentes",
  ausente: "Ausentes",
  justificado: "Justificados",
};

export default function AttendanceOverview() {
  const [byDiscipline, setByDiscipline] = useState<DisciplineData[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [overallRate, setOverallRate] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const sixWeeksAgo = addDaysChile(getChileToday(), -42);

    Promise.all([
      supabase
        .from("attendance")
        .select("status, session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))")
        .gte("marked_at", chileDateToUtc(sixWeeksAgo)),
      supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", sixWeeksAgo),
    ]).then(([attRes, sessRes]) => {
      const rows = (attRes.data || []) as unknown as Array<{
        status: string;
        session: {
          session_date: string;
          schedule: { discipline: { name: string } | null } | null;
        } | null;
      }>;

      const allSessions = (sessRes.data || []) as Array<{ id: string; session_date: string }>;
      const thirtyDaysAgo = addDaysChile(getChileToday(), -30);
      setTotalSessions(
        allSessions.filter((s) => s.session_date >= thirtyDaysAgo).length
      );

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      rows.forEach((r) => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      });
      const total = rows.length;
      const present = statusCounts["presente"] || 0;
      setOverallRate(total > 0 ? Math.round((present / total) * 100) : 0);
      setStatusBreakdown([
        { status: "presente", count: statusCounts["presente"] || 0 },
        { status: "ausente", count: statusCounts["ausente"] || 0 },
        { status: "justificado", count: statusCounts["justificado"] || 0 },
      ]);

      // By discipline
      const discMap: Record<string, { present: number; absent: number; justified: number; total: number }> = {};
      rows.forEach((r) => {
        const d = r.session?.schedule?.discipline?.name || "Otra";
        if (!discMap[d]) discMap[d] = { present: 0, absent: 0, justified: 0, total: 0 };
        discMap[d].total += 1;
        if (r.status === "presente") discMap[d].present += 1;
        else if (r.status === "ausente") discMap[d].absent += 1;
        else discMap[d].justified += 1;
      });
      setByDiscipline(
        Object.entries(discMap)
          .map(([discipline, data]) => ({
            discipline,
            ...data,
            rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
          }))
          .sort((a, b) => b.total - a.total)
      );

      // Trend (6 weeks)
      const now = new Date();
      const weekMap: Record<string, { present: number; absent: number; justified: number; total: number; date: string }> = {};
      for (let i = 5; i >= 0; i--) {
        const ws = new Date(now.getTime() - (i + 1) * 7 * 86400000);
        weekMap[`w${i}`] = { present: 0, absent: 0, justified: 0, total: 0, date: `${ws.getDate()}/${ws.getMonth() + 1}` };
      }
      rows.forEach((r) => {
        const d = new Date(r.session?.session_date || "");
        const diff = Math.floor((now.getTime() - d.getTime()) / (7 * 86400000));
        const key = diff < 6 ? `w${5 - diff}` : null;
        if (key && weekMap[key]) {
          weekMap[key].total += 1;
          if (r.status === "presente") weekMap[key].present += 1;
          else if (r.status === "ausente") weekMap[key].absent += 1;
          else weekMap[key].justified += 1;
        }
      });
      setTrend(
        Object.entries(weekMap).map(([, v]) => ({
          date: v.date,
          present: v.present,
          absent: v.absent,
          justified: v.justified,
          total: v.total,
          rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        }))
      );

      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasDisciplineData = byDiscipline.length > 0;
  const hasTrendData = trend.some((t) => t.total > 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
          <span className="material-symbols-outlined text-green-400 text-[28px] mb-2 block">trending_up</span>
          <p className="font-[family-name:var(--font-headline-lg)] text-[32px] text-on-surface">
            {overallRate}%
          </p>
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Asistencia General (30d)
          </p>
        </div>
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
          <span className="material-symbols-outlined text-primary text-[28px] mb-2 block">event_available</span>
          <p className="font-[family-name:var(--font-headline-lg)] text-[32px] text-on-surface">
            {totalSessions}
          </p>
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Sesiones (30d)
          </p>
        </div>
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
          <span className="material-symbols-outlined text-blue-400 text-[28px] mb-2 block">groups</span>
          <p className="font-[family-name:var(--font-headline-lg)] text-[32px] text-on-surface">
            {hasDisciplineData ? byDiscipline.length : 0}
          </p>
          <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
            Disciplinas con Asistencia
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance by Discipline */}
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">
            Asistencia por Disciplina
          </h3>
          {hasDisciplineData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byDiscipline} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(229,226,225,0.06)" />
                <XAxis
                  dataKey="discipline"
                  tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#e4beb9", fontSize: 11, fontFamily: "var(--font-label-sm)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
                  labelStyle={{ color: "#e4beb9", fontFamily: "var(--font-headline-md)" }}
                  formatter={(value, name) => [
                    value,
                    name === "present" ? "Presentes" : name === "absent" ? "Ausentes" : "Justificados",
                  ]}
                />
                <Bar dataKey="present" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
                <Bar dataKey="justified" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" stackId="a" fill="#f87171" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant/40">
              <span className="material-symbols-outlined text-[40px] mb-2">fact_check</span>
              <p className="font-[family-name:var(--font-body-md)] text-[13px]">Sin datos de asistencia</p>
            </div>
          )}
          {/* Legend */}
          {hasDisciplineData && (
            <div className="flex items-center gap-4 mt-3 justify-center">
              {[
                { label: "Presentes", color: "#4ade80" },
                { label: "Justificados", color: "#fbbf24" },
                { label: "Ausentes", color: "#f87171" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface-variant">{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Breakdown Donut + Trend */}
        <div className="space-y-6">
          {/* Donut */}
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
            <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">
              Distribución de Estados
            </h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie
                    data={statusBreakdown.filter((s) => s.count > 0)}
                    dataKey="count"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    strokeWidth={0}
                  >
                    {statusBreakdown
                      .filter((s) => s.count > 0)
                      .map((s) => (
                        <Cell key={s.status} fill={STATUS_COLORS[s.status] || "#666"} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
                    formatter={(value, name) => [
                      `${value} registros`,
                      STATUS_LABELS[name as string] || name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {statusBreakdown.map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s.status] || "#666" }}
                      />
                      <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </div>
                    <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
            <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">
              Tendencia Semanal
            </h3>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(229,226,225,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#e4beb9", fontSize: 10, fontFamily: "var(--font-label-sm)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#e4beb9", fontSize: 10, fontFamily: "var(--font-label-sm)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1e1e1e", border: "1px solid rgba(229,226,225,0.1)", borderRadius: 12, fontSize: 13 }}
                    labelStyle={{ color: "#e4beb9", fontFamily: "var(--font-headline-md)" }}
                    formatter={(value) => [`${value}%`, "Asistencia"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#ff544c"
                    strokeWidth={2.5}
                    dot={{ fill: "#ff544c", r: 4, strokeWidth: 0 }}
                    activeDot={{ fill: "#ff544c", r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-on-surface-variant/40">
                <p className="font-[family-name:var(--font-body-md)] text-[13px]">Sin tendencia disponible</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
