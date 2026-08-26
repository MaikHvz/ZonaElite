"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChileToday } from "@/lib/dates";

interface Schedule {
  id: string;
  discipline_id: string;
  professor_id: string;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  category: string[];
  active: boolean;
  description: string | null;
  disciplines: { name: string; color_hex: string; icon: string } | null;
  profiles: { full_name: string } | null;
  class_plans: { plan_id: string }[];
}

interface ClassSession {
  id: string;
  session_date: string;
  enrolled: number;
}

interface BeneficiaryRow {
  beneficiaryId: string;
  label: string;
  category: string;
  activePlan: string | null;
  activePlanName: string | null;
  membershipValid: boolean;
  hasActiveEnrollment: boolean;
  enrolledSessions: Set<string>;
  eligible: boolean;
  ineligibleReason: string | null;
  tokensRemaining: number | null;
  tokensTotal: number | null;
  isUnlimited: boolean;
}

interface EnrollModalProps {
  open: boolean;
  schedule: Schedule | null;
  userId: string;
  onClose: () => void;
  onEnrolled: () => void;
}

const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatSessionDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

export default function EnrollModal({ open, schedule, userId, onClose, onEnrolled }: EnrollModalProps) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (!schedule) return;
    setLoading(true);
    setSelected(new Set());
    setSelectedSession(null);
    setSubmitError(null);

    const today = getChileToday();

    const sessionsRes = await supabase
      .from("class_sessions")
      .select("id, session_date")
      .eq("schedule_id", schedule.id)
      .gte("session_date", today)
      .order("session_date");

    const upcomingSessions = (sessionsRes.data || []) as ClassSession[];

    const enriched: ClassSession[] = [];
    for (const s of upcomingSessions) {
      const { count } = await supabase
        .from("class_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("session_id", s.id);
      enriched.push({ ...s, enrolled: count || 0 });
    }
    setSessions(enriched);

    if (enriched.length > 0) setSelectedSession(enriched[0].id);

    const [ownBenRes, depsRes] = await Promise.all([
      supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("dependents")
        .select("id, full_name, category")
        .eq("tutor_id", userId),
    ]);

    const rows: BeneficiaryRow[] = [];

    if (ownBenRes.data) {
      const benId = ownBenRes.data.id;

      const { data: membershipRows } = await supabase
        .from("memberships")
        .select("id, plan_id, membership_plans(name, category)")
        .eq("beneficiary_id", benId)
        .eq("status", "activa")
        .gte("end_date", today)
        .order("end_date", { ascending: false })
        .limit(1);

      const membership = membershipRows?.[0] || null;

      const planCategory = (membership as { membership_plans?: { category?: string } } | null)?.membership_plans?.category || "adulto";
      const planId = membership?.plan_id || null;
      const planName = (membership as { membership_plans?: { name?: string } } | null)?.membership_plans?.name || null;
      const membershipValid = !!membership;

      const { data: enrollment } = await supabase
        .from("academy_enrollments")
        .select("id")
        .eq("beneficiary_id", benId)
        .eq("status", "activa")
        .gte("end_date", today)
        .maybeSingle();

      const hasActiveEnrollment = !!enrollment;

      const { data: enrolledSessions } = await supabase
        .from("class_enrollments")
        .select("session_id")
        .eq("beneficiary_id", benId)
        .in("session_id", enriched.map((s) => s.id));

      const enrolledSessionIds = new Set((enrolledSessions || []).map((e) => e.session_id));

      const classPlanIds = schedule.class_plans.map((cp) => cp.plan_id);
      const planAllowed = classPlanIds.length === 0 || (planId && classPlanIds.includes(planId));

      let eligible = true;
      let ineligibleReason: string | null = null;
      let tokensRemaining: number | null = null;
      let tokensTotal: number | null = null;
      let isUnlimited = true;

      if (membership) {
        const { data: tokenData } = await supabase.rpc("get_remaining_tokens", {
          p_beneficiary_id: benId,
          p_membership_id: membership.id,
        });

        if (tokenData && tokenData.length > 0) {
          const tokenInfo = tokenData[0];
          tokensRemaining = tokenInfo.remaining;
          tokensTotal = tokenInfo.total;
          isUnlimited = tokenInfo.is_unlimited;
        }
      }

      if (!schedule.category.includes(planCategory)) {
        eligible = false;
        ineligibleReason = "Categoría no compatible con esta clase";
      } else if (!hasActiveEnrollment) {
        eligible = false;
        ineligibleReason = "Sin inscripción a la academia";
      } else if (!membershipValid) {
        eligible = false;
        ineligibleReason = "Sin membresía activa";
      } else if (!planAllowed) {
        eligible = false;
        ineligibleReason = "Plan no habilitado para esta clase";
      } else if (!isUnlimited && tokensRemaining !== null && tokensRemaining <= 0) {
        eligible = false;
        ineligibleReason = "Sin tokens disponibles";
      }

      rows.push({
        beneficiaryId: benId,
        label: "Yo",
        category: planCategory,
        activePlan: planId,
        activePlanName: planName,
        membershipValid,
        hasActiveEnrollment,
        enrolledSessions: enrolledSessionIds,
        eligible,
        ineligibleReason,
        tokensRemaining,
        tokensTotal,
        isUnlimited,
      });
    }

    if (depsRes.data && depsRes.data.length > 0) {
      const depIds = depsRes.data.map((d) => d.id);
      const { data: depBeneficiaries } = await supabase
        .from("beneficiaries")
        .select("id, dependent_id")
        .in("dependent_id", depIds);

      for (const dep of depsRes.data) {
        const ben = depBeneficiaries?.find((b) => b.dependent_id === dep.id);
        if (!ben) continue;

        const benId = ben.id;

        const { data: membershipRows } = await supabase
          .from("memberships")
          .select("id, plan_id, membership_plans(name, category)")
          .eq("beneficiary_id", benId)
          .eq("status", "activa")
          .gte("end_date", today)
          .order("end_date", { ascending: false })
          .limit(1);

        const membership = membershipRows?.[0] || null;

        const planCategory = dep.category;
        const planId = membership?.plan_id || null;
        const planName = (membership as { membership_plans?: { name?: string } } | null)?.membership_plans?.name || null;
        const membershipValid = !!membership;

        const { data: enrollment } = await supabase
          .from("academy_enrollments")
          .select("id")
          .eq("beneficiary_id", benId)
          .eq("status", "activa")
          .gte("end_date", today)
          .maybeSingle();

        const hasActiveEnrollment = !!enrollment;

        const { data: enrolledSessions } = await supabase
          .from("class_enrollments")
          .select("session_id")
          .eq("beneficiary_id", benId)
          .in("session_id", enriched.map((s) => s.id));

        const enrolledSessionIds = new Set((enrolledSessions || []).map((e) => e.session_id));

        const classPlanIds = schedule.class_plans.map((cp) => cp.plan_id);
        const planAllowed = classPlanIds.length === 0 || (planId && classPlanIds.includes(planId));

        let eligible = true;
        let ineligibleReason: string | null = null;
        let tokensRemaining: number | null = null;
        let tokensTotal: number | null = null;
        let isUnlimited = true;

        if (membership) {
          const { data: tokenData } = await supabase.rpc("get_remaining_tokens", {
            p_beneficiary_id: benId,
            p_membership_id: membership.id,
          });

          if (tokenData && tokenData.length > 0) {
            const tokenInfo = tokenData[0];
            tokensRemaining = tokenInfo.remaining;
            tokensTotal = tokenInfo.total;
            isUnlimited = tokenInfo.is_unlimited;
          }
        }

        if (!schedule.category.includes(planCategory)) {
          eligible = false;
          ineligibleReason = "Categoría no compatible con esta clase";
        } else if (!hasActiveEnrollment) {
          eligible = false;
          ineligibleReason = "Sin inscripción a la academia";
        } else if (!membershipValid) {
          eligible = false;
          ineligibleReason = "Sin membresía activa";
        } else if (!planAllowed) {
          eligible = false;
          ineligibleReason = "Plan no habilitado para esta clase";
        } else if (!isUnlimited && tokensRemaining !== null && tokensRemaining <= 0) {
          eligible = false;
          ineligibleReason = "Sin tokens disponibles";
        }

        rows.push({
          beneficiaryId: benId,
          label: dep.full_name,
          category: planCategory,
          activePlan: planId,
          activePlanName: planName,
          membershipValid,
          hasActiveEnrollment,
          enrolledSessions: enrolledSessionIds,
          eligible,
          ineligibleReason,
          tokensRemaining,
          tokensTotal,
          isUnlimited,
        });
      }
    }

    setBeneficiaries(rows);
    setLoading(false);
  }, [schedule, userId, supabase]);

  useEffect(() => {
    if (open && schedule) loadData();
  }, [open, schedule, loadData]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedSessionData = sessions.find((s) => s.id === selectedSession);
  const remaining = selectedSessionData ? schedule!.capacity - selectedSessionData.enrolled : 0;

  const handleSubmit = async () => {
    if (!schedule || !selectedSession || selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const ids = Array.from(selected);
    const { data, error } = await supabase.rpc("enroll_class", {
      p_session_id: selectedSession,
      p_beneficiary_ids: ids,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message || "No se pudo inscribir. Intenta de nuevo.");
      return;
    }

    const results = (data || []) as Array<{
      beneficiary_id: string | null;
      success: boolean;
      error_code: string | null;
      error_message: string | null;
    }>;

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0 && failed[0].error_code) {
      setSubmitError(failed[0].error_message || "No se pudo inscribir. Intenta de nuevo.");
      return;
    }

    onEnrolled();
    onClose();
  };

  if (!open || !schedule) return null;

  const color = schedule.disciplines?.color_hex || "#666";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 border-b border-on-surface/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color }}>{schedule.disciplines?.icon || "sports_martial_arts"}</span>
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">{schedule.disciplines?.name}</h3>
                <p className="font-[family-name:var(--font-body-sm)] text-[13px] text-on-surface-variant">
                  {DAY_NAMES_FULL[schedule.day_of_week]} · {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-on-surface/5 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              Categoría: {schedule.category.map(c => c === "ninos" ? "Niños" : c === "juveniles" ? "Juveniles" : c === "adultos" ? "Adultos" : c).join(", ")}
            </span>
            {schedule.room && (
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
                Sala: {schedule.room}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Session Date Picker */}
          <div>
            <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-2">
              Selecciona la fecha
            </p>
            {sessions.length === 0 ? (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60">No hay sesiones programadas próximamente</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => {
                  const full = selectedSession === s.id;
                  const spotsLeft = schedule.capacity - s.enrolled;
                  const isFull = spotsLeft <= 0;
                  const isEnrolled = beneficiaries.some((b) => b.enrolledSessions.has(s.id));
                  return (
                    <button
                      key={s.id}
                      onClick={() => !isFull && setSelectedSession(s.id)}
                      disabled={isFull}
                      className={`px-3 py-2 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${full
                          ? "border-primary bg-primary/10"
                          : "border-on-surface/10 hover:border-on-surface/20"
                        }`}
                    >
                      <p className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider ${full ? "text-primary" : "text-on-surface"}`}>
                        {formatShortDate(s.session_date)}
                      </p>
                      <p className={`font-[family-name:var(--font-body-sm)] text-[10px] mt-0.5 ${isFull ? "text-red-400" : "text-on-surface-variant/60"}`}>
                        {isFull ? "Llena" : isEnrolled ? "Ya inscrito" : `${spotsLeft} cupos`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Beneficiaries */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-on-surface/20 text-5xl mb-3 block">person_off</span>
              <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">No se encontraron beneficiarios</p>
              <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 mt-1">Contacta al administrador</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-3">
                Selecciona quiénes asistirán
              </p>
              {beneficiaries.map((b) => {
                const alreadyInSession = selectedSession ? b.enrolledSessions.has(selectedSession) : false;
                const isEligible = b.eligible && !alreadyInSession && remaining > 0;
                return (
                  <button
                    key={b.beneficiaryId}
                    onClick={() => isEligible && toggle(b.beneficiaryId)}
                    disabled={!isEligible}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer disabled:cursor-not-allowed ${!isEligible
                        ? "bg-surface-container-high/30 border-on-surface/5 opacity-50"
                        : selected.has(b.beneficiaryId)
                          ? "border-primary/40 bg-primary/5"
                          : "border-on-surface/5 hover:border-on-surface/15"
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(b.beneficiaryId)
                        ? "border-primary bg-primary"
                        : "border-on-surface/20"
                      }`}>
                      {selected.has(b.beneficiaryId) && (
                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-headline-sm)] text-[14px] text-on-surface truncate">{b.label}</span>
                        <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                          b.category === "nino" ? "bg-blue-500/10 text-blue-400" : b.category === "juvenil" ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"
                        }`}>
                          {b.category === "nino" ? "Niño" : b.category === "juvenil" ? "Juvenil" : "Adulto"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.activePlanName && (
                          <span className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60">{b.activePlanName}</span>
                        )}
                        {b.membershipValid && (
                          <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${b.isUnlimited
                              ? "bg-green-500/10 text-green-400"
                              : b.tokensRemaining !== null && b.tokensRemaining > 0
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                            {b.isUnlimited
                              ? "Ilimitado"
                              : `${b.tokensRemaining}/${b.tokensTotal} tokens`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {alreadyInSession ? (
                        <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Inscrito
                        </span>
                      ) : !b.eligible ? (
                        <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          {b.ineligibleReason}
                        </span>
                      ) : (
                        <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Apto
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-on-surface/5">
          {submitError && (
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-red-400 mb-3 text-center">
              {submitError}
            </p>
          )}
          {selectedSessionData && (
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mb-3 text-center">
              {formatSessionDate(selectedSessionData.session_date)} · {remaining > 0 ? `${remaining} cupos disponibles` : "Clase llena"}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!selectedSession || selected.size === 0 || submitting || remaining <= 0}
            className="w-full py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {submitting
              ? "Inscribiendo..."
              : !selectedSession
                ? "Selecciona una fecha"
                : selected.size === 0
                  ? "Selecciona al menos uno"
                  : `Inscribir ${selected.size} persona${selected.size > 1 ? "s" : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
