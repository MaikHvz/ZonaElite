"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryFromBirth } from "@/lib/category";

export interface EventAttendee {
  id: string;
  beneficiary_id: string;
  created_at: string;
}

export interface EventBeneficiaryRow {
  beneficiaryId: string;
  label: string;
  category: "nino" | "juvenil" | "adulto";
}

export function eventTypeIcon(type: string): string {
  const map: Record<string, string> = {
    torneo: "emoji_events",
    graduacion: "military_tech",
    seminario: "school",
    clase_especial: "fitness_center",
  };
  return map[type] || "event";
}

function categoryLabel(category: string): string {
  if (category === "nino") return "Niño";
  if (category === "juvenil") return "Juvenil";
  return "Adulto";
}

function categoryBadgeClass(category: string): string {
  if (category === "nino") return "bg-blue-500/10 text-blue-400";
  if (category === "juvenil") return "bg-amber-500/10 text-amber-400";
  return "bg-green-500/10 text-green-400";
}

/**
 * Beneficiario propio legible por RLS. Una cuenta por alumno: cada persona
 * se inscribe con su propia cuenta (sin cargas). La categoría sale de la
 * fecha de nacimiento.
 */
export async function fetchOwnBeneficiaries(userId: string, selfName?: string | null): Promise<EventBeneficiaryRow[]> {
  const supabase = createClient();
  const rows: EventBeneficiaryRow[] = [];

  const [{ data: selfBeneficiary }, { data: profile }] = await Promise.all([
    supabase.from("beneficiaries").select("id").eq("profile_id", userId).maybeSingle(),
    supabase.from("profiles").select("birth_date").eq("id", userId).maybeSingle(),
  ]);

  if (selfBeneficiary) {
    rows.push({
      beneficiaryId: selfBeneficiary.id,
      label: selfName || "Yo",
      category: categoryFromBirth((profile as { birth_date?: string | null } | null)?.birth_date),
    });
  }

  return rows;
}

/** Filas de event_attendees visibles para el usuario (RLS: owns_beneficiary o staff). */
export async function fetchMyEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_attendees")
    .select("id, beneficiary_id, created_at")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data || []) as EventAttendee[];
}

interface EventEnrollModalProps {
  open: boolean;
  eventId: string;
  eventTitle: string;
  eventType: string;
  userId: string;
  selfName?: string | null;
  alreadyEnrolled: Set<string>;
  onClose: () => void;
  onEnrolled: () => void;
}

export default function EventEnrollModal({
  open,
  eventId,
  eventTitle,
  eventType,
  userId,
  selfName,
  alreadyEnrolled,
  onClose,
  onEnrolled,
}: EventEnrollModalProps) {
  const [beneficiaries, setBeneficiaries] = useState<EventBeneficiaryRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loadData = useCallback(async () => {
    if (!open || !userId) return;
    setLoading(true);
    setSubmitError("");
    setSelected(new Set());
    try {
      const rows = await fetchOwnBeneficiaries(userId, selfName);
      setBeneficiaries(rows);
    } catch {
      setSubmitError("No se pudieron cargar tus beneficiarios.");
    } finally {
      setLoading(false);
    }
  }, [open, userId, selfName]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("enroll_event", {
        p_event_id: eventId,
        p_beneficiary_ids: Array.from(selected),
      });
      if (error) {
        setSubmitError(error.message || "No se pudo completar la inscripción.");
        return;
      }
      const results = (data || []) as { success: boolean; error_code: string | null; error_message: string | null }[];
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        setSubmitError(failed[0].error_message || "No se pudo completar la inscripción.");
        return;
      }
      onEnrolled();
      onClose();
    } catch {
      setSubmitError("No se pudo completar la inscripción. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const icon = eventTypeIcon(eventType);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-on-surface/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase">Inscribirse al evento</h3>
                <p className="font-[family-name:var(--font-body-sm)] text-[13px] text-on-surface-variant truncate">
                  {eventTitle}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-on-surface/5 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">close</span>
            </button>
          </div>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface mt-4">
            ¿Deseas inscribirte al evento <span className="text-primary">{eventTitle}</span>?
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
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
                Confirma tu asistencia
              </p>
              {beneficiaries.map((b) => {
                const isEnrolled = alreadyEnrolled.has(b.beneficiaryId);
                return (
                  <button
                    key={b.beneficiaryId}
                    onClick={() => !isEnrolled && toggle(b.beneficiaryId)}
                    disabled={isEnrolled}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer disabled:cursor-not-allowed ${isEnrolled
                        ? "bg-surface-container-high/30 border-on-surface/5 opacity-60"
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
                        <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${categoryBadgeClass(b.category)}`}>
                          {categoryLabel(b.category)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isEnrolled ? (
                        <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Inscrito
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

        <div className="p-6 pt-4 border-t border-on-surface/5">
          {submitError && (
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-red-400 mb-3 text-center">
              {submitError}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting || loading}
            className="w-full py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {submitting
              ? "Inscribiendo..."
              : selected.size === 0
                ? "Selecciona al menos uno"
                : `Confirmar ${selected.size > 1 ? `inscripción de ${selected.size} personas` : "inscripción"}`
            }
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-2.5 rounded-xl border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[13px] cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}