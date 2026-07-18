"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback } from "react";
import {
  getUserAttendance,
  type AttendanceRecord,
} from "@/lib/supabase/dashboard";

interface AttendanceRow extends AttendanceRecord {
  beneficiary_name: string;
  session: {
    session_date: string;
    schedule: { discipline: { name: string } | null };
  };
}

const STATUS_CONFIG = {
  presente: { label: "Presente", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  ausente: { label: "Ausente", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  justificado: { label: "Justificado", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
} as const;

export default function AsistenciaPage() {
  const { user } = useSession();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    const { data } = await getUserAttendance(user.id);
    setRecords((data?.records as AttendanceRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  const presentCount = records.filter((r) => r.status === "presente").length;
  const absentCount = records.filter((r) => r.status === "ausente").length;
  const total = records.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
          Mi <span className="text-primary">Asistencia</span>
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
          Historial de asistencia a clases.
        </p>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-container border border-on-surface/5 rounded-xl p-3 text-center">
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface">
              {total}
            </span>
            <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
              Total
            </p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-green-400">
              {presentCount}
            </span>
            <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400/70">
              Presente
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-red-400">
              {absentCount}
            </span>
            <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400/70">
              Ausente
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            fact_check
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
            No hay registros de asistencia
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 mt-1">
            Tu asistencia se registrará cuando asistas a clases
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const cfg = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
            return (
              <div
                key={r.id}
                className="bg-surface-container border border-on-surface/5 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/10 border border-primary-container/20 flex flex-col items-center justify-center shrink-0">
                    <span className="font-[family-name:var(--font-headline-md)] text-[13px] text-primary leading-none">
                      {new Date(r.session.session_date + "T12:00:00").getDate()}
                    </span>
                    <span className="font-[family-name:var(--font-label-sm)] text-[8px] uppercase text-primary/70 leading-none mt-0.5">
                      {new Date(r.session.session_date + "T12:00:00")
                        .toLocaleDateString("es-CL", { month: "short" })
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface truncate">
                      {r.session.schedule?.discipline?.name || "Clase"}
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">
                      {r.beneficiary_name}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider border px-3 py-1 rounded-full ${cfg?.bg || ""} ${cfg?.color || ""}`}
                >
                  {cfg?.label || r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
