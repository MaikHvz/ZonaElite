"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserAttendanceStats, type UserAttendanceStats } from "@/lib/supabase/dashboard";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  presente: { label: "Presente", color: "text-green-400", bg: "bg-green-500/10" },
  ausente: { label: "Ausente", color: "text-red-400", bg: "bg-red-500/10" },
  justificado: { label: "Justificado", color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

export default function AttendanceSummary({ userId }: { userId: string }) {
  const [stats, setStats] = useState<UserAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserAttendanceStats(userId).then(({ data }) => {
      setStats(data);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg skeleton-shimmer" />
          <div className="w-32 h-4 rounded skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
            Mi Asistencia
          </h2>
        </div>
        <div className="glass-card p-6 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30 text-[40px] mb-2 block">
            fact_check
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant/50">
            Aún no tienes registros de asistencia
          </p>
        </div>
      </section>
    );
  }

  const rateColor =
    stats.rate >= 80
      ? "text-green-400"
      : stats.rate >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const rateBarColor =
    stats.rate >= 80
      ? "from-green-500 to-emerald-600"
      : stats.rate >= 60
        ? "from-yellow-500 to-amber-600"
        : "from-red-500 to-rose-600";

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
          Mi Asistencia
        </h2>
        <Link
          href="/dashboard/asistencia"
          className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary hover:text-on-surface transition-colors"
        >
          Ver historial →
        </Link>
      </div>

      {/* Rate + Stats */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center gap-5 mb-4">
          {/* Circular rate */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="rgba(229,226,225,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="url(#rateGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(stats.rate / 100) * 213.6} 213.6`}
              />
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff544c" />
                  <stop offset="100%" stopColor="#d32f2f" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-[family-name:var(--font-headline-lg)] text-[22px] ${rateColor} leading-none`}>
                {stats.rate}%
              </span>
              <span className="font-[family-name:var(--font-label-sm)] text-[8px] text-on-surface-variant uppercase">
                asistencia
              </span>
            </div>
          </div>

          {/* Status counts */}
          <div className="flex-1 grid grid-cols-3 gap-2">
            {(["presente", "ausente", "justificado"] as const).map((status) => {
              const cfg = STATUS_CONFIG[status];
              const count = status === "presente" ? stats.present : status === "ausente" ? stats.absent : stats.justified;
              return (
                <div key={status} className={`${cfg.bg} rounded-xl p-3 text-center`}>
                  <p className={`font-[family-name:var(--font-headline-md)] text-[20px] ${cfg.color} leading-none mb-1`}>
                    {count}
                  </p>
                  <p className="font-[family-name:var(--font-label-sm)] text-[9px] text-on-surface-variant uppercase">
                    {cfg.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-on-surface/5 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${rateBarColor} transition-all duration-700`}
            style={{ width: `${stats.rate}%` }}
          />
        </div>
        <p className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface-variant mt-2 text-right">
          {stats.present} de {stats.totalSessions} sesiones
        </p>
      </div>

      {/* By Discipline */}
      {stats.byDiscipline.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase tracking-tighter mb-3">
            Por Disciplina
          </h3>
          <div className="space-y-3">
            {stats.byDiscipline.map((d) => (
              <div key={d.discipline}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                    {d.discipline}
                  </span>
                  <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant">
                    {d.present}/{d.total} ({d.rate}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-on-surface/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary transition-all duration-500"
                    style={{ width: `${d.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
