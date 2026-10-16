"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FormModal from "@/components/admin/FormModal";
import Toast from "@/components/admin/Toast";
import { UserNameButton } from "@/components/admin/UserQuickView";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { eventTypeIcon, type EventAttendee } from "@/components/EventEnrollModal";

interface AttendeeRow extends EventAttendee {
  full_name: string;
  category: "nino" | "juvenil" | "adulto" | null;
}

interface EventAttendeesModalProps {
  open: boolean;
  eventId: string | null;
  eventTitle: string;
  eventType: string;
  eventDate: string;
  onClose: () => void;
  onChanged: () => void;
}

function categoryLabel(category: string | null): string {
  if (category === "nino") return "Niño";
  if (category === "juvenil") return "Juvenil";
  return "Adulto";
}

function categoryBadgeClass(category: string | null): string {
  if (category === "nino") return "bg-blue-500/10 text-blue-400";
  if (category === "juvenil") return "bg-amber-500/10 text-amber-400";
  return "bg-green-500/10 text-green-400";
}

function formatRegisteredAt(value: string): string {
  return new Date(value).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventAttendeesModal({
  open,
  eventId,
  eventTitle,
  eventType,
  eventDate,
  onClose,
  onChanged,
}: EventAttendeesModalProps) {
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<AttendeeRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!open || !eventId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_attendees")
        .select("id, beneficiary_id, created_at, beneficiaries(id, profile_id, dependent_id)")
        .eq("event_id", eventId);
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "cargar la lista de asistencia"), type: "error" });
        setAttendees([]);
        return;
      }

      const raw = (data || []) as unknown as {
        id: string;
        beneficiary_id: string;
        created_at: string;
        beneficiaries: { id: string; profile_id: string | null; dependent_id: string | null } | null;
      }[];

      const profileIds = raw.map((r) => r.beneficiaries?.profile_id).filter((v): v is string => Boolean(v));
      const dependentIds = raw.map((r) => r.beneficiaries?.dependent_id).filter((v): v is string => Boolean(v));

      const { data: profiles } = profileIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
        : { data: [] };
      const { data: dependents } = dependentIds.length
        ? await supabase.from("dependents").select("id, full_name, category").in("id", dependentIds)
        : { data: [] };

      const profileNames = new Map(((profiles || []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
      const dependentMap = new Map(
        ((dependents || []) as { id: string; full_name: string; category: string }[]).map((d) => [d.id, d])
      );

      const rows: AttendeeRow[] = raw.map((r) => {
        const depId = r.beneficiaries?.dependent_id;
        const dep = depId ? dependentMap.get(depId) : undefined;
        return {
          id: r.id,
          beneficiary_id: r.beneficiary_id,
          created_at: r.created_at,
          full_name: dep?.full_name || (r.beneficiaries?.profile_id ? profileNames.get(r.beneficiaries.profile_id) || "Alumno" : "Alumno"),
          category: (dep?.category === "nino" || dep?.category === "juvenil" ? dep.category : "adulto"),
        };
      });

      rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setAttendees(rows);
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "cargar la lista de asistencia"), type: "error" });
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [open, eventId]);

  useEffect(() => {
    if (open) {
      setToast(null);
      setRemoveTarget(null);
      load();
    }
  }, [open, load]);

  const handleRemove = async () => {
    if (!removeTarget || !eventId) return;
    setRemoving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("cancel_event_attendance", {
        p_event_id: eventId,
        p_beneficiary_id: removeTarget.beneficiary_id,
      });
      if (error) {
        setToast({ msg: getSupabaseErrorMessage(error, "eliminar de la lista"), type: "error" });
        return;
      }
      const result = (Array.isArray(data) ? data[0] : data) as { removed: boolean; message: string } | null;
      if (result && !result.removed) {
        setToast({ msg: result.message, type: "error" });
        setRemoveTarget(null);
        return;
      }
      setRemoveTarget(null);
      setToast({ msg: "Se eliminó la asistencia", type: "success" });
      await load();
      onChanged();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "eliminar de la lista"), type: "error" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <FormModal open={open} title="Lista de asistencia" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-surface-container border border-on-surface/5 rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">{eventTypeIcon(eventType)}</span>
            </div>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-headline-sm)] text-[15px] text-on-surface">{eventTitle}</p>
              <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant mt-0.5 capitalize">
                {new Date(eventDate + "T12:00:00").toLocaleDateString("es-CL", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary mt-2">
                {attendees.length} inscrito{attendees.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : attendees.length === 0 ? (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-on-surface/20 text-5xl mb-3 block">group_off</span>
              <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
                Nadie se ha inscrito a este evento todavía
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {attendees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 bg-surface-container-high/30 border border-on-surface/5 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-[16px]">person</span>
                    </div>
                    <div className="min-w-0">
                      <UserNameButton beneficiaryId={a.beneficiary_id} className="block font-[family-name:var(--font-body-md)] text-[13px] text-on-surface truncate">
                        {a.full_name}
                      </UserNameButton>
                      <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60">
                        Inscrito el {formatRegisteredAt(a.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${categoryBadgeClass(a.category)}`}>
                      {categoryLabel(a.category)}
                    </span>
                    <button
                      onClick={() => setRemoveTarget(a)}
                      title="Eliminar de la lista"
                      className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-on-surface/5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </FormModal>

      {/* Confirmación de baja */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => !removing && setRemoveTarget(null)}>
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-400 text-[24px]">person_remove</span>
            </div>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-2">
              Eliminar asistencia
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
              ¿Deseas eliminar a <span className="text-primary">{removeTarget.full_name}</span> de la lista de asistencia del evento?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="px-4 py-2 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-[14px] disabled:opacity-50 cursor-pointer"
              >
                {removing ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}