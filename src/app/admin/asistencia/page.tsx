"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getUpcomingSessions,
  getAttendanceForSession,
  markAttendance,
  type ClassSessionData,
  type AttendanceBeneficiary,
} from "@/lib/supabase/dashboard";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const STATUS_OPTIONS = [
  { value: "presente", label: "Presente", icon: "check", color: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" },
  { value: "ausente", label: "Ausente", icon: "close", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { value: "justificado", label: "Justificado", icon: "info", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30" },
] as const;

interface SessionWithCount extends ClassSessionData {
  enrolledCount?: number;
}

interface EnrollableBeneficiary {
  id: string;
  full_name: string;
  category: string;
  beneficiary_id: string;
  activePlan: string | null;
}

export default function AdminAsistenciaPage() {
  const { user } = useSession();
  const supabase = createClient();

  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const [beneficiaries, setBeneficiaries] = useState<AttendanceBeneficiary[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollSessionId, setEnrollSessionId] = useState<string | null>(null);
  const [enrollSessionName, setEnrollSessionName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EnrollableBeneficiary[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSessions = useCallback(async () => {
    const { data } = await getUpcomingSessions();
    setSessions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleGenerateSessions = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-sessions", { method: "POST" });
      const json = await res.json();
      if (json.error) {
        showToast(json.error, "error");
      } else {
        showToast(`${json.created} sesiones generadas`, "success");
        await loadSessions();
      }
    } catch {
      showToast("Error al generar sesiones", "error");
    }
    setGenerating(false);
  };

  const toggleSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setBeneficiaries([]);
      return;
    }

    setExpandedSession(sessionId);
    setLoadingAttendance(true);
    setBeneficiaries([]);

    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      session.enrolledCount = undefined;
    }

    const { data } = await getAttendanceForSession(sessionId);
    const bens = data?.beneficiaries || [];
    setBeneficiaries(bens);

    if (session) {
      session.enrolledCount = bens.length;
      setSessions((prev) => [...prev]);
    }

    setLoadingAttendance(false);
  };

  const handleMark = (beneficiaryId: string, status: "presente" | "ausente" | "justificado") => {
    setBeneficiaries((prev) =>
      prev.map((b) => {
        if (b.id !== beneficiaryId) return b;
        const existing = b.attendance;
        return {
          ...b,
          attendance: {
            id: existing?.id || "",
            session_id: expandedSession || "",
            beneficiary_id: b.id,
            status,
            marked_by: null,
            marked_at: new Date().toISOString(),
          },
        };
      })
    );
  };

  const handleMarkAllPresent = () => {
    setBeneficiaries((prev) =>
      prev.map((b) => ({
        ...b,
        attendance: {
          id: b.attendance?.id || "",
          session_id: expandedSession || "",
          beneficiary_id: b.id,
          status: "presente" as const,
          marked_by: null,
          marked_at: new Date().toISOString(),
        },
      }))
    );
  };

  const handleSaveAll = async () => {
    if (!expandedSession || !user) return;
    setSaving(true);

    let errors = 0;
    for (const b of beneficiaries) {
      if (!b.attendance?.status) continue;
      const { error } = await markAttendance(expandedSession, b.id, b.attendance.status, user.id);
      if (error) errors++;
    }

    if (errors > 0) {
      showToast(`Guardado con ${errors} error(es)`, "error");
    } else {
      showToast("Asistencia guardada correctamente", "success");
    }
    setSaving(false);
  };

  const openEnrollModal = (sessionId: string, sessionName: string) => {
    setEnrollSessionId(sessionId);
    setEnrollSessionName(sessionName);
    setSearchQuery("");
    setSearchResults([]);
    setShowEnrollModal(true);
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", `%${query}%`)
      .limit(10);

    if (!profiles || profiles.length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const results: EnrollableBeneficiary[] = [];

    for (const p of profiles) {
      const { data: ben } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", p.id)
        .maybeSingle();

      if (!ben) continue;

      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id, membership_plans(name)")
        .eq("beneficiary_id", ben.id)
        .eq("status", "activa")
        .gte("end_date", new Date().toISOString().split("T")[0])
        .maybeSingle();

      results.push({
        id: p.id,
        full_name: p.full_name,
        category: "adulto",
        beneficiary_id: ben.id,
        activePlan: membership?.plan_id || null,
      });
    }

    for (const p of profiles) {
      const { data: deps } = await supabase
        .from("dependents")
        .select("id, full_name, category")
        .eq("tutor_id", p.id)
        .ilike("full_name", `%${query}%`);

      if (!deps) continue;

      for (const d of deps) {
        const { data: ben } = await supabase
          .from("beneficiaries")
          .select("id")
          .eq("dependent_id", d.id)
          .maybeSingle();

        if (!ben) continue;

        const { data: membership } = await supabase
          .from("memberships")
          .select("plan_id, membership_plans(name)")
          .eq("beneficiary_id", ben.id)
          .eq("status", "activa")
          .gte("end_date", new Date().toISOString().split("T")[0])
          .maybeSingle();

        results.push({
          id: p.id,
          full_name: d.full_name,
          category: d.category,
          beneficiary_id: ben.id,
          activePlan: membership?.plan_id || null,
        });
      }
    }

    setSearchResults(results);
    setSearching(false);
  };

  const handleEnroll = async (beneficiaryId: string) => {
    if (!enrollSessionId) return;
    setEnrolling(beneficiaryId);

    const { error } = await supabase.from("class_enrollments").insert({
      session_id: enrollSessionId,
      beneficiary_id: beneficiaryId,
    });

    setEnrolling(null);

    if (error) {
      if (error.code === "23505") {
        showToast("Ya está inscrito en esta sesión", "error");
      } else {
        showToast("Error al inscribir", "error");
      }
      return;
    }

    showToast("Inscrito correctamente", "success");
    setShowEnrollModal(false);
    if (expandedSession === enrollSessionId) {
      await toggleSession(enrollSessionId);
    }
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

  const groupedByDate: Record<string, SessionWithCount[]> = {};
  for (const s of sessions) {
    if (!groupedByDate[s.session_date]) groupedByDate[s.session_date] = [];
    groupedByDate[s.session_date].push(s);
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-slide-in-right">
          <div className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${
            toast.type === "success"
              ? "bg-green-900/90 border-green-500/30 text-green-200"
              : "bg-red-900/90 border-red-500/30 text-red-200"
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {toast.type === "success" ? "check_circle" : "error"}
              </span>
              <span className="font-[family-name:var(--font-body-sm)] text-[13px]">{toast.msg}</span>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEnrollModal(false)}>
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4 border-b border-on-surface/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">Inscribir usuario</h3>
                  <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mt-0.5">{enrollSessionName}</p>
                </div>
                <button onClick={() => setShowEnrollModal(false)} className="p-1.5 rounded-full hover:bg-on-surface/5 cursor-pointer">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="relative">
                <span className="material-symbols-outlined text-on-surface-variant/40 absolute left-3 top-1/2 -translate-y-1/2 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                  className="w-full bg-surface-container border border-on-surface/10 rounded-xl pl-10 pr-4 py-2.5 font-[family-name:var(--font-body-md)] text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 text-center py-8">
                  {searchQuery.length < 2 ? "Escribe al menos 2 caracteres" : "No se encontraron resultados"}
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <div key={r.beneficiary_id} className="flex items-center justify-between p-3 rounded-xl border border-on-surface/5">
                      <div>
                        <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{r.full_name}</p>
                        <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider ${r.category === "nino" ? "text-blue-400" : "text-on-surface-variant/60"}`}>
                          {r.category === "nino" ? "Niño" : "Adulto"}
                          {r.activePlan ? " · Con membresía" : " · Sin membresía"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEnroll(r.beneficiary_id)}
                        disabled={enrolling === r.beneficiary_id || !r.activePlan}
                        className="btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {enrolling === r.beneficiary_id ? "..." : "Inscribir"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
          Asistencia
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
          Gestiona las sesiones de clase y marca la asistencia de los alumnos.
        </p>
      </div>

      {/* Generate Sessions Button */}
      <div className="mb-6">
        <button
          onClick={handleGenerateSessions}
          disabled={generating}
          className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-xl disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">
            {generating ? "sync" : "calendar_month"}
          </span>
          {generating ? "Generando..." : "Generar sesiones próximas"}
        </button>
      </div>

      {/* Sessions by Date */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-surface-container rounded-lg w-48 animate-pulse" />
              <div className="h-20 bg-surface-container rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">event_busy</span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
            No hay sesiones de clase próximas
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 mt-1">
            Haz clic en &quot;Generar sesiones próximas&quot; para crear las clases de las próximas semanas
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateSessions]) => {
              const isToday = date === new Date().toISOString().split("T")[0];
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className={`font-[family-name:var(--font-headline-md)] text-[15px] uppercase ${isToday ? "text-primary" : "text-on-surface"}`}>
                      {isToday ? "Hoy" : formatDate(date)}
                    </h3>
                    <div className="h-px flex-1 bg-on-surface/10" />
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                      {dateSessions.length} clase{dateSessions.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dateSessions.map((s) => {
                      const isExpanded = expandedSession === s.id;
                      const discName = s.schedule?.discipline?.name || "Clase";
                      const profName = s.schedule?.professor?.full_name || "Sin instructor";
                      const startTime = s.schedule?.start_time?.slice(0, 5) || "";
                      const endTime = s.schedule?.end_time?.slice(0, 5) || "";

                      return (
                        <div key={s.id} className={`bg-surface-container border rounded-xl transition-all ${isExpanded ? "border-primary/30" : "border-on-surface/5 hover:border-on-surface/15"}`}>
                          <button
                            onClick={() => toggleSession(s.id)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
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
                                  {discName}
                                </p>
                                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                                  {startTime} - {endTime} · {profName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {s.enrolledCount !== undefined && (
                                <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                                  {s.enrolledCount} inscrito{s.enrolledCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              <span className={`material-symbols-outlined text-on-surface/30 text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                expand_more
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-on-surface/5">
                              {/* Summary + Actions */}
                              <div className="flex items-center justify-between mt-4 mb-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">{presentCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">{absentCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">{justifiedCount}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEnrollModal(s.id, `${discName} · ${formatDate(s.session_date)}`)}
                                    className="flex items-center gap-1.5 border border-on-surface/10 text-on-surface-variant font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-on-surface/5 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">person_add</span>
                                    Inscribir
                                  </button>
                                  <button
                                    onClick={handleMarkAllPresent}
                                    className="flex items-center gap-1.5 border border-green-500/20 text-green-400 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-green-500/10 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">task_alt</span>
                                    Todos presentes
                                  </button>
                                </div>
                              </div>

                              {/* Beneficiaries */}
                              {loadingAttendance ? (
                                <div className="space-y-2">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-14 bg-surface-container-high/50 rounded-xl animate-pulse" />
                                  ))}
                                </div>
                              ) : beneficiaries.length === 0 ? (
                                <div className="bg-surface-container-high/30 rounded-xl p-6 text-center">
                                  <span className="material-symbols-outlined text-on-surface/20 text-[36px] mb-2 block">group_off</span>
                                  <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                                    No hay alumnos inscritos en esta sesión
                                  </p>
                                  <button
                                    onClick={() => openEnrollModal(s.id, `${discName} · ${formatDate(s.session_date)}`)}
                                    className="mt-3 text-primary font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider hover:underline cursor-pointer"
                                  >
                                    Inscribir usuario
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="space-y-2 mb-4">
                                    {beneficiaries.map((b) => (
                                      <div
                                        key={b.id}
                                        className="bg-surface-container-high/30 border border-on-surface/5 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-8 h-8 rounded-full btn-primary-gradient flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-white text-[14px]">person</span>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface truncate">{b.full_name}</p>
                                            <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider ${b.category === "nino" ? "text-blue-400" : "text-on-surface-variant/60"}`}>
                                              {b.category === "nino" ? "Niño" : "Adulto"}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                          {STATUS_OPTIONS.map((opt) => (
                                            <button
                                              key={opt.value}
                                              onClick={() => handleMark(b.id, opt.value as "presente" | "ausente" | "justificado")}
                                              className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider border px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
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

                                  {/* Save Button */}
                                  <div className="flex items-center justify-end">
                                    <button
                                      onClick={handleSaveAll}
                                      disabled={saving}
                                      className="btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-6 py-2.5 rounded-lg disabled:opacity-50 cursor-pointer"
                                    >
                                      {saving ? "Guardando..." : "Guardar asistencia"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
