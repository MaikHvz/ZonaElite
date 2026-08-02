"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { getChileToday, chileDateToUtc, chileMonthStartDate } from "@/lib/dates";
import { QRCodeSVG } from "qrcode.react";
import {
  getUpcomingSessions,
  getAttendanceForSession,
  markAttendance,
  type ClassSessionData,
  type AttendanceBeneficiary,
} from "@/lib/supabase/dashboard";
import { exportProfessionalExcel, type ProfessionalSheetConfig } from "@/lib/excel";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const STATUS_OPTIONS = [
  { value: "presente", label: "Presente", icon: "check", color: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" },
  { value: "ausente", label: "Ausente", icon: "close", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { value: "justificado", label: "Justificado", icon: "info", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30" },
] as const;

interface SessionWithCount extends ClassSessionData {
  enrolledCount?: number;
  status?: string;
}

interface EnrollableBeneficiary {
  id: string;
  full_name: string;
  category: string;
  beneficiary_id: string;
  activePlan: string | null;
  membershipId: string | null;
  tokensRemaining: number | null;
  tokensTotal: number | null;
  isUnlimited: boolean;
}

interface QrAlert {
  id: string;
  name: string;
  timestamp: number;
}

interface SummaryAttendee {
  beneficiary_id: string;
  full_name: string;
  marked_at: string;
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

  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrAlerts, setQrAlerts] = useState<QrAlert[]>([]);
  const alertQueueRef = useRef<QrAlert[]>([]);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertDurationRef = useRef(4000);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryAttendees, setSummaryAttendees] = useState<SummaryAttendee[]>([]);
  const [closingSession, setClosingSession] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

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

  useEffect(() => {
    supabase
      .from("academy_settings")
      .select("qr_alert_duration")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.qr_alert_duration) {
          alertDurationRef.current = data.qr_alert_duration * 1000;
        }
      });
  }, [supabase]);

  const processAlertQueue = useCallback(() => {
    if (alertTimerRef.current) return;
    const next = alertQueueRef.current.shift();
    if (!next) return;

    setQrAlerts((prev) => [...prev, next]);
    alertTimerRef.current = setTimeout(() => {
      setQrAlerts((prev) => prev.filter((a) => a.id !== next.id));
      alertTimerRef.current = null;
      processAlertQueue();
    }, alertDurationRef.current);
  }, []);

  useEffect(() => {
    if (!qrSessionId) return;

    let lastCount = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const { count } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", qrSessionId);

      const currentCount = count || 0;
      if (currentCount > lastCount) {
        const { data: newRecords } = await supabase
          .from("attendance")
          .select("beneficiary_id, marked_at")
          .eq("session_id", qrSessionId)
          .order("marked_at", { ascending: false })
          .limit(currentCount - lastCount);

        lastCount = currentCount;

        if (newRecords) {
          for (const rec of newRecords) {
            const { data: membership } = await supabase
              .from("memberships")
              .select("end_date")
              .eq("beneficiary_id", rec.beneficiary_id)
              .eq("status", "activa")
              .order("end_date", { ascending: false })
              .limit(1)
              .maybeSingle();

            const today = getChileToday();
            const isExpired = !membership || membership.end_date < today;

            if (isExpired) {
              const { data: bInfo } = await supabase
                .from("beneficiaries")
                .select("profile:profiles(full_name), dependent:dependents(full_name)")
                .eq("id", rec.beneficiary_id)
                .single();

              const name =
                (bInfo?.dependent as unknown as { full_name: string })?.full_name ||
                (bInfo?.profile as unknown as { full_name: string })?.full_name ||
                "Alumno";

              const alert: QrAlert = {
                id: `${Date.now()}-${Math.random()}`,
                name,
                timestamp: Date.now(),
              };
              alertQueueRef.current.push(alert);
              processAlertQueue();
            }
          }
        }
      }
    };

    const initPoll = async () => {
      const { count } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("session_id", qrSessionId);
      lastCount = count || 0;
    };

    initPoll();
    const interval = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
      alertQueueRef.current = [];
    };
  }, [qrSessionId, supabase, processAlertQueue]);

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
      setQrSessionId(null);
      setShowSummary(false);
      setSummaryAttendees([]);
      setShowCloseConfirm(false);
      return;
    }

    setExpandedSession(sessionId);
    setLoadingAttendance(true);
    setBeneficiaries([]);
    setShowSummary(false);
    setSummaryAttendees([]);
    setShowCloseConfirm(false);

    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      session.enrolledCount = undefined;
    }

    const { data: sessData } = await supabase
      .from("class_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    const sessionStatus = sessData?.status || "cerrada";
    if (session) {
      session.status = sessionStatus;
    }

    if (sessionStatus === "activa") {
      setQrSessionId(sessionId);
    } else {
      setQrSessionId(null);
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

  const handleActivateSession = async (sessionId: string) => {
    const { error } = await supabase
      .from("class_sessions")
      .update({ status: "activa" })
      .eq("id", sessionId);

    if (error) {
      showToast("Error al activar sesión", "error");
      return;
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: "activa" } : s))
    );
    setQrSessionId(sessionId);
    showToast("Sesión activada — QR listo", "success");
  };

  const handleCloseSession = async () => {
    if (!expandedSession) return;
    setClosingSession(true);

    const sessionRow = sessions.find((s) => s.id === expandedSession);
    const scheduleId = sessionRow?.schedule_id;

    const { data: sessionEnrollments } = await supabase
      .from("class_enrollments")
      .select("beneficiary_id, source")
      .eq("session_id", expandedSession);

    const { data: scheduleEnrollments } = scheduleId
      ? await supabase
          .from("class_enrollments")
          .select("beneficiary_id, source")
          .eq("schedule_id", scheduleId)
          .is("session_id", null)
      : { data: null };

    const allEnrollments = [...(sessionEnrollments || []), ...(scheduleEnrollments || [])];
    const uniqueEnrollments = Array.from(
      new Map(allEnrollments.map((e) => [e.beneficiary_id, e])).values()
    );

    const { data: existingAttendance } = await supabase
      .from("attendance")
      .select("beneficiary_id, status")
      .eq("session_id", expandedSession);

    const attendedIds = new Set((existingAttendance || []).map((a) => a.beneficiary_id));

    const notAttended = uniqueEnrollments.filter(
      (e) => !attendedIds.has(e.beneficiary_id)
    );

    if (notAttended.length > 0) {
      const absentInserts = notAttended.map((e) => ({
        session_id: expandedSession,
        beneficiary_id: e.beneficiary_id,
        status: "ausente" as const,
        marked_by: user?.id || null,
        marked_at: new Date().toISOString(),
      }));
      await supabase.from("attendance").insert(absentInserts);
    }

    const { data: allAttendance } = await supabase
      .from("attendance")
      .select("beneficiary_id, marked_at, beneficiaries(id, profile:profiles(full_name), dependent:dependents(full_name))")
      .eq("session_id", expandedSession)
      .eq("status", "presente");

    const qrBenIds = new Set(
      uniqueEnrollments.filter((e) => e.source === "qr").map((e) => e.beneficiary_id)
    );

    const attendees: SummaryAttendee[] = (allAttendance || [])
      .filter((a) => qrBenIds.has(a.beneficiary_id))
      .map((a) => {
        const b = a.beneficiaries as unknown as {
          profile?: { full_name: string };
          dependent?: { full_name: string };
        } | null;
        return {
          beneficiary_id: a.beneficiary_id,
          full_name:
            b?.dependent?.full_name || b?.profile?.full_name || "Alumno",
          marked_at: a.marked_at,
        };
      });

    const { error } = await supabase
      .from("class_sessions")
      .update({ status: "cerrada" })
      .eq("id", expandedSession);

    if (error) {
      showToast("Error al cerrar sesión", "error");
      setClosingSession(false);
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === expandedSession ? { ...s, status: "cerrada" } : s
      )
    );
    setQrSessionId(null);
    setSummaryAttendees(attendees);
    setShowSummary(true);
    setShowCloseConfirm(false);
    setClosingSession(false);
    showToast("Sesión finalizada", "success");
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

    const today = getChileToday();

    const [profilesRes, depsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${query}%`)
        .limit(10),
      supabase
        .from("dependents")
        .select("id, full_name, category, tutor_id")
        .ilike("full_name", `%${query}%`)
        .limit(10),
    ]);

    const results: EnrollableBeneficiary[] = [];

    for (const p of profilesRes.data || []) {
      const { data: ben } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", p.id)
        .maybeSingle();

      if (!ben) continue;

      const { data: membership } = await supabase
        .from("memberships")
        .select("id, plan_id, membership_plans(name, tokens)")
        .eq("beneficiary_id", ben.id)
        .eq("status", "activa")
        .gte("end_date", today)
        .maybeSingle();

      let tokensRemaining: number | null = null;
      let tokensTotal: number | null = null;
      let isUnlimited = true;

      if (membership) {
        const { data: tokenData } = await supabase.rpc("get_remaining_tokens", {
          p_beneficiary_id: ben.id,
          p_membership_id: membership.id,
        });

        if (tokenData && tokenData.length > 0) {
          const tokenInfo = tokenData[0];
          tokensRemaining = tokenInfo.remaining;
          tokensTotal = tokenInfo.total;
          isUnlimited = tokenInfo.is_unlimited;
        }
      }

      results.push({
        id: p.id,
        full_name: p.full_name,
        category: "adulto",
        beneficiary_id: ben.id,
        activePlan: membership?.plan_id || null,
        membershipId: membership?.id || null,
        tokensRemaining,
        tokensTotal,
        isUnlimited,
      });
    }

    for (const d of depsRes.data || []) {
      const { data: ben } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("dependent_id", d.id)
        .maybeSingle();

      if (!ben) continue;

      const alreadyFound = results.some((r) => r.beneficiary_id === ben.id);
      if (alreadyFound) continue;

      const { data: membership } = await supabase
        .from("memberships")
        .select("id, plan_id, membership_plans(name, tokens)")
        .eq("beneficiary_id", ben.id)
        .eq("status", "activa")
        .gte("end_date", today)
        .maybeSingle();

      let tokensRemaining: number | null = null;
      let tokensTotal: number | null = null;
      let isUnlimited = true;

      if (membership) {
        const { data: tokenData } = await supabase.rpc("get_remaining_tokens", {
          p_beneficiary_id: ben.id,
          p_membership_id: membership.id,
        });

        if (tokenData && tokenData.length > 0) {
          const tokenInfo = tokenData[0];
          tokensRemaining = tokenInfo.remaining;
          tokensTotal = tokenInfo.total;
          isUnlimited = tokenInfo.is_unlimited;
        }
      }

      results.push({
        id: d.tutor_id,
        full_name: d.full_name,
        category: d.category,
        beneficiary_id: ben.id,
        activePlan: membership?.plan_id || null,
        membershipId: membership?.id || null,
        tokensRemaining,
        tokensTotal,
        isUnlimited,
      });
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
      source: "admin",
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

  const handleExportAsistencia = async () => {
    const supabase = createClient();
    const startDate = chileDateToUtc(chileMonthStartDate());

    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("id, status, marked_at, beneficiary_id, class_sessions(session_date, schedules(disciplines(name), profiles(full_name))), beneficiaries(profiles(full_name), dependents(full_name))")
      .gte("marked_at", startDate)
      .order("marked_at", { ascending: false })
      .limit(2000);

    if (!attendanceData || attendanceData.length === 0) return;

    const totalPresente = attendanceData.filter((a: any) => a.status === "presente").length;
    const totalAusente = attendanceData.filter((a: any) => a.status === "ausente").length;
    const totalJustificado = attendanceData.filter((a: any) => a.status === "justificado").length;
    const tasaAsistencia = Math.round((totalPresente / attendanceData.length) * 100);

    // Disciplina breakdown
    const disciplinaCounts: Record<string, { presentes: number; ausentes: number; justificados: number }> = {};
    attendanceData.forEach((a: any) => {
      const disc = a.class_sessions?.schedules?.disciplines?.name || "Sin disciplina";
      if (!disciplinaCounts[disc]) disciplinaCounts[disc] = { presentes: 0, ausentes: 0, justificados: 0 };
      if (a.status === "presente") disciplinaCounts[disc].presentes++;
      else if (a.status === "ausente") disciplinaCounts[disc].ausentes++;
      else if (a.status === "justificado") disciplinaCounts[disc].justificados++;
    });

    const periodoLabel = `${new Date(startDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })} al ${new Date(getChileToday() + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}`;

    const resumenSheet: ProfessionalSheetConfig = {
      sheetName: "Resumen Asistencia",
      reportTitle: "Reporte de Asistencia",
      subtitle: `Período: ${periodoLabel}`,
      kpiBlocks: [
        {
          title: "INDICADORES GENERALES DEL MES",
          rows: [
            ["Total Registros de Asistencia", attendanceData.length],
            ["Alumnos Presentes", totalPresente, true],
            ["Alumnos Ausentes", totalAusente, totalAusente === 0],
            ["Justificados (no descuenta token)", totalJustificado],
            ["Tasa de Asistencia", `${tasaAsistencia}%`, tasaAsistencia >= 70],
          ],
        },
        {
          title: "ASISTENCIA POR DISCIPLINA",
          rows: Object.entries(disciplinaCounts).map(([disc, counts]) => [
            disc,
            `${counts.presentes} pres. | ${counts.ausentes} aus. | ${counts.justificados} just.`,
          ]),
        },
      ],
    };

    const detalleSheet: ProfessionalSheetConfig = {
      sheetName: "Detalle Asistencia",
      reportTitle: "Detalle de Asistencia",
      subtitle: `${attendanceData.length} registros en el período`,
      tableData: attendanceData.map((a: any) => {
        const session = a.class_sessions;
        const ben = a.beneficiaries;
        const nombre = ben?.profiles?.full_name || ben?.dependents?.full_name || "—";
        return {
          "Alumno": nombre,
          "Estado": a.status === "presente" ? "✅ Presente" : a.status === "ausente" ? "❌ Ausente" : "🟡 Justificado",
          "Fecha Clase": session?.session_date || "—",
          "Disciplina": session?.schedules?.disciplines?.name || "—",
          "Instructor": session?.schedules?.profiles?.full_name || "—",
          "Marcado el": a.marked_at ? new Date(a.marked_at).toLocaleString("es-CL") : "—",
        };
      }),
    };

    await exportProfessionalExcel(
      [resumenSheet, detalleSheet],
      `Reporte_Asistencia_ZonaElite_${getChileToday().slice(0, 4)}_${getChileToday().slice(5, 7)}`
    );
  };

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
                    <div key={r.beneficiary_id} className="p-3 rounded-xl border border-on-surface/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{r.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider ${r.category === "nino" ? "text-blue-400" : "text-on-surface-variant/60"}`}>
                              {r.category === "nino" ? "Niño" : "Adulto"}
                            </span>
                            {r.activePlan ? (
                              <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${r.isUnlimited
                                  ? "bg-green-500/10 text-green-400"
                                  : r.tokensRemaining !== null && r.tokensRemaining > 0
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}>
                                {r.isUnlimited
                                  ? "Ilimitado"
                                  : `${r.tokensRemaining}/${r.tokensTotal} tokens`
                                }
                              </span>
                            ) : (
                              <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-red-400">
                                Sin membresía
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEnroll(r.beneficiary_id)}
                          disabled={enrolling === r.beneficiary_id || !r.activePlan}
                          className="btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {enrolling === r.beneficiary_id ? "..." : "Inscribir"}
                        </button>
                      </div>
                      {r.activePlan && !r.isUnlimited && r.tokensRemaining !== null && r.tokensRemaining <= 0 && (
                        <div className={`mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${
                          r.tokensRemaining === 0
                            ? "bg-yellow-500/5 border border-yellow-500/15"
                            : "bg-red-500/5 border border-red-500/15"
                        }`}>
                          <span className={`material-symbols-outlined text-[12px] ${r.tokensRemaining === 0 ? "text-yellow-400" : "text-red-400"}`}>
                            {r.tokensRemaining === 0 ? "warning" : "error"}
                          </span>
                          <span className={`font-[family-name:var(--font-body-md)] text-[11px] ${r.tokensRemaining === 0 ? "text-yellow-400" : "text-red-400"}`}>
                            {r.tokensRemaining === 0
                              ? "Esto generará una deuda de 1 clase"
                              : `Deuda acumulada: ${Math.abs(r.tokensRemaining)} clase${Math.abs(r.tokensRemaining) > 1 ? "s" : ""}`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCloseConfirm(false)}>
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-primary text-[40px] mb-3 block">stop_circle</span>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase mb-2">
              Finalizar asistencia
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mb-6">
              No se podrán recibir más check-ins por QR para esta sesión.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 border border-on-surface/15 text-on-surface font-[family-name:var(--font-headline-md)] text-[12px] uppercase rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSession}
                disabled={closingSession}
                className="flex-1 py-2.5 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[12px] uppercase rounded-lg shadow-[0_0_16px_rgba(229,57,53,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {closingSession ? "Cerrando..." : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
            Asistencia
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
            Gestiona las sesiones de clase y marca la asistencia de los alumnos.
          </p>
        </div>
        <button
          onClick={handleExportAsistencia}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/10 text-green-500 border border-green-500/20 hover:bg-green-600/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Excel
        </button>
      </div>

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
              const isToday = date === getChileToday();
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
                      const isActive = s.status === "activa";

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
                                <div className="flex items-center gap-2">
                                  <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                                    {discName}
                                  </p>
                                  {isActive && (
                                    <span className="flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[9px] uppercase text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                      QR activo
                                    </span>
                                  )}
                                </div>
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
                              {/* QR Section */}
                              {isActive && (
                                <div className="mt-4 mb-4 p-5 bg-surface-container-lowest rounded-xl border border-on-surface/5">
                                  <div className="flex flex-col items-center gap-4">
                                    <div className="bg-white p-4 rounded-xl">
                                      <QRCodeSVG
                                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${s.id}`}
                                        size={200}
                                        level="M"
                                        includeMargin={false}
                                      />
                                    </div>
                                    <div className="text-center">
                                      <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                                        Escanear para check-in
                                      </p>
                                      <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant/60 mt-1 break-all">
                                        {`${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${s.id}`}
                                      </p>
                                    </div>

                                    {qrAlerts.length > 0 && (
                                      <div className="w-full space-y-2">
                                        {qrAlerts.map((alert) => (
                                          <div
                                            key={alert.id}
                                            className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-slide-in-right"
                                          >
                                            <span className="material-symbols-outlined text-red-400 text-[18px]">warning</span>
                                            <span className="font-[family-name:var(--font-body-md)] text-[13px] text-red-300">
                                              <strong>{alert.name}</strong> — Membresía vencida
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <button
                                      onClick={() => setShowCloseConfirm(true)}
                                      className="flex items-center gap-2 py-2.5 px-6 border border-red-500/30 text-red-400 font-[family-name:var(--font-headline-md)] text-[12px] uppercase rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                                      Finalizar asistencia
                                    </button>
                                  </div>
                                </div>
                              )}

                              {!isActive && !showSummary && (
                                <div className="mt-4 mb-4">
                                  <button
                                    onClick={() => handleActivateSession(s.id)}
                                    className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[12px] uppercase px-5 py-2.5 rounded-lg shadow-[0_0_16px_rgba(229,57,53,0.3)] cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                                    Abrir sesión de asistencia QR
                                  </button>
                                </div>
                              )}

                              {/* Summary */}
                              {showSummary && expandedSession === s.id && (
                                <div className="mt-4 mb-4 p-5 bg-surface-container-lowest rounded-xl border border-on-surface/5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
                                    <h4 className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase">
                                      Resumen — Check-ins por QR
                                    </h4>
                                  </div>
                                  {summaryAttendees.length === 0 ? (
                                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant text-center py-4">
                                      Ningún alumno se registró por QR en esta sesión.
                                    </p>
                                  ) : (
                                    <div className="space-y-2 mb-4">
                                      {summaryAttendees.map((a) => (
                                        <div key={a.beneficiary_id} className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/15 rounded-lg">
                                          <span className="material-symbols-outlined text-green-400 text-[18px]">check_circle</span>
                                          <div>
                                            <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface block">
                                              {a.full_name}
                                            </span>
                                            <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase text-on-surface-variant">
                                              Presente ✓
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleActivateSession(s.id)}
                                    className="text-primary font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider hover:underline cursor-pointer"
                                  >
                                    Reabrir sesión
                                  </button>
                                </div>
                              )}

                              {/* Manual Attendance */}
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
