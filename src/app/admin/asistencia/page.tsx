"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/providers/SessionProvider";
import {
  getUpcomingSessions,
  getAttendanceForSession,
  markAttendance,
  type ClassSessionData,
  type AttendanceBeneficiary,
} from "@/lib/supabase/dashboard";

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const STATUS_OPTIONS = [
  { value: "presente", label: "Presente", color: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" },
  { value: "ausente", label: "Ausente", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { value: "justificado", label: "Justificado", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30" },
] as const;

export default function AdminAsistenciaPage() {
  const { user } = useSession();
  const [sessions, setSessions] = useState<ClassSessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ClassSessionData | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<AttendanceBeneficiary[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await getUpcomingSessions();
    setSessions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadAttendance = useCallback(async (session: ClassSessionData) => {
    setSelectedSession(session);
    setLoadingAttendance(true);
    setSaveMsg(null);
    const { data } = await getAttendanceForSession(session.id);
    setBeneficiaries(data?.beneficiaries || []);
    setLoadingAttendance(false);
  }, []);

  const handleMark = (beneficiaryId: string, status: "presente" | "ausente" | "justificado") => {
    setBeneficiaries((prev) =>
      prev.map((b) =>
        b.id === beneficiaryId
          ? { ...b, attendance: { ...b.attendance, status } as any }
          : b
      )
    );
  };

  const handleSaveAll = async () => {
    if (!selectedSession || !user) return;
    setSaving(true);
    setSaveMsg(null);

    let errors = 0;
    for (const b of beneficiaries) {
      if (!b.attendance?.status) continue;
      const { error } = await markAttendance(
        selectedSession.id,
        b.id,
        b.attendance.status,
        user.id
      );
      if (error) errors++;
    }

    if (errors > 0) {
      setSaveMsg(`Guardado con ${errors} error(es)`);
    } else {
      setSaveMsg("Asistencia guardada correctamente");
    }
    setSaving(false);
  };

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const presentCount = beneficiaries.filter((b) => b.attendance?.status === "presente").length;
  const absentCount = beneficiaries.filter((b) => b.attendance?.status === "ausente").length;
  const justifiedCount = beneficiaries.filter((b) => b.attendance?.status === "justificado").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Asistencia
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
          Marca la asistencia de los alumnos en cada clase.
        </p>
      </div>

      {selectedSession ? (
        <div className="space-y-6">
          <button
            onClick={() => {
              setSelectedSession(null);
              setBeneficiaries([]);
              setSaveMsg(null);
            }}
            className="flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Volver a sesiones
          </button>

          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">event</span>
              <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">
                {selectedSession.schedule?.discipline?.name || "Clase"}
              </h2>
            </div>
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
              {formatDate(selectedSession.session_date)} ·{" "}
              {selectedSession.schedule?.start_time?.slice(0, 5)} -{" "}
              {selectedSession.schedule?.end_time?.slice(0, 5)} ·{" "}
              {selectedSession.schedule?.professor?.full_name || "Sin instructor"}
            </p>
          </div>

          {beneficiaries.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-green-400">
                  {presentCount}
                </span>
                <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400/70">
                  Presentes
                </p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-red-400">
                  {absentCount}
                </span>
                <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400/70">
                  Ausentes
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                <span className="font-[family-name:var(--font-headline-md)] text-[24px] text-yellow-400">
                  {justifiedCount}
                </span>
                <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-yellow-400/70">
                  Justificados
                </p>
              </div>
            </div>
          )}

          {loadingAttendance ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />
              ))}
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
                group_off
              </span>
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
                No hay alumnos inscritos con membresía activa para esta clase
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {beneficiaries.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface-container border border-on-surface/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-white text-[16px]">
                        person
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface truncate">
                        {b.full_name}
                      </p>
                      <span
                        className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider ${
                          b.category === "nino" ? "text-blue-400" : "text-on-surface-variant"
                        }`}
                      >
                        {b.category === "nino" ? "Niño" : "Adulto"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          handleMark(b.id, opt.value as "presente" | "ausente" | "justificado")
                        }
                        className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider border px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          b.attendance?.status === opt.value
                            ? opt.color
                            : "border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {beneficiaries.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              {saveMsg && (
                <p
                  className={`font-[family-name:var(--font-body-md)] text-[13px] ${
                    saveMsg.includes("correctamente") ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {saveMsg}
                </p>
              )}
              <div className="ml-auto">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-6 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Guardando..." : "Guardar asistencia"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-surface-container rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
                event_busy
              </span>
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
                No hay sesiones de clase próximas programadas
              </p>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 mt-1">
                Crea horarios y sesiones de clase primero
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadAttendance(s)}
                  className="w-full bg-surface-container border border-on-surface/5 rounded-xl px-5 py-4 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container/10 border border-primary-container/20 flex flex-col items-center justify-center shrink-0">
                      <span className="font-[family-name:var(--font-headline-md)] text-[14px] text-primary leading-none">
                        {new Date(s.session_date + "T12:00:00").getDate()}
                      </span>
                      <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase text-primary/70 leading-none mt-0.5">
                        {DAYS[new Date(s.session_date + "T12:00:00").getDay()].slice(0, 3)}
                      </span>
                    </div>
                    <div>
                      <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                        {s.schedule?.discipline?.name || "Clase"}
                      </p>
                      <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                        {s.schedule?.start_time?.slice(0, 5)} -{" "}
                        {s.schedule?.end_time?.slice(0, 5)} ·{" "}
                        {s.schedule?.professor?.full_name || "Sin instructor"}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface/30 text-[20px]">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
