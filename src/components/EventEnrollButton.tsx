"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import { getChileToday } from "@/lib/dates";
import EventEnrollModal, { fetchMyEventAttendees } from "@/components/EventEnrollModal";

interface EventEnrollButtonProps {
  eventId: string;
  eventTitle: string;
  eventType: string;
  eventDate: string;
}

function SuccessModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-green-400 text-[34px]">check_circle</span>
        </div>
        <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-2">
          Confirmación exitosa
        </h3>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[13px] uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function EventEnrollButton({ eventId, eventTitle, eventType, eventDate }: EventEnrollButtonProps) {
  const { user, profile, loading: sessionLoading } = useSession();
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const isPast = eventDate < getChileToday();

  const loadEnrollment = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchMyEventAttendees(eventId);
      setEnrolledIds(new Set(rows.map((r) => r.beneficiary_id)));
    } catch {
      setEnrolledIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => {
    if (!sessionLoading) loadEnrollment();
  }, [sessionLoading, loadEnrollment]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleEnrolled = async () => {
    await loadEnrollment();
    setSuccessOpen(true);
  };

  const handleLeave = async () => {
    if (enrolledIds.size === 0) return;
    setLeaving(true);
    setLeaveError("");
    try {
      const supabase = createClient();
      // Podría haber más de uno (titular + cargas): se eliminan todos.
      const results = await Promise.all(
        Array.from(enrolledIds).map((beneficiaryId) =>
          supabase.rpc("cancel_event_attendance", {
            p_event_id: eventId,
            p_beneficiary_id: beneficiaryId,
          })
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        setLeaveError(failed.error.message || "No se pudo eliminar tu participación.");
        return;
      }
      setEnrolledIds(new Set());
      setLeaveOpen(false);
      setNotice({ msg: "Tu participación fue eliminada de la lista de asistencia", type: "success" });
    } catch {
      setLeaveError("No se pudo eliminar tu participación. Intenta de nuevo.");
    } finally {
      setLeaving(false);
    }
  };

  // Sin sesión: se preserva el comportamiento actual (CTA a /auth).
  if (!sessionLoading && !user) {
    return (
      <Link
        href="/auth"
        className="block w-full text-center px-6 py-3 rounded-xl btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider hover:opacity-90 transition-opacity"
      >
        Inscribirse
      </Link>
    );
  }

  if (isPast) {
    return (
      <div className="w-full text-center px-6 py-3 rounded-xl border border-on-surface/10 bg-surface-container/40 text-on-surface-variant font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider cursor-not-allowed">
        Evento finalizado
      </div>
    );
  }

  const isEnrolled = enrolledIds.size > 0;

  const baseButton =
    "block w-full text-center px-6 py-3 rounded-xl font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider transition-colors";

  return (
    <>
      {!isEnrolled ? (
        <button
          onClick={() => setEnrollOpen(true)}
          disabled={loading}
          className={`${baseButton} btn-primary-gradient text-white hover:opacity-90 disabled:opacity-50 cursor-pointer`}
        >
          {loading ? "Cargando..." : "Inscribirse"}
        </button>
      ) : (
        <div className="group relative">
          <button
            onClick={() => { setLeaveError(""); setLeaveOpen(true); }}
            className={`${baseButton} border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 cursor-pointer`}
          >
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Inscrito
            </span>
          </button>
          {/* Tooltip "Eliminar asistencia" (patrón group-hover del repo) */}
          <span className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-black/90 border border-red-500/30 text-red-300 text-[11px] font-[family-name:var(--font-body-sm)] flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <span className="material-symbols-outlined text-[14px]">person_remove</span>
            Eliminar asistencia
          </span>
          <span className="absolute top-1/2 -translate-y-1/2 right-3 w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </span>
        </div>
      )}

      <EventEnrollModal
        open={enrollOpen}
        eventId={eventId}
        eventTitle={eventTitle}
        eventType={eventType}
        userId={user?.id || ""}
        selfName={profile?.full_name}
        alreadyEnrolled={enrolledIds}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={handleEnrolled}
      />

      <SuccessModal
        open={successOpen}
        message="Te agregaste a la lista de asistencia del evento."
        onClose={() => setSuccessOpen(false)}
      />

      {/* Confirmación de baja de participación */}
      {leaveOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !leaving && setLeaveOpen(false)}>
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-400 text-[24px]">warning</span>
            </div>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-2">
              Eliminar asistencia
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mb-6">
              ¿Deseas eliminar tu participación del evento <span className="text-primary">{eventTitle}</span>?
            </p>
            {leaveError && (
              <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-red-400 mb-3 text-center">{leaveError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setLeaveOpen(false)}
                disabled={leaving}
                className="px-4 py-2 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-[14px] disabled:opacity-50 cursor-pointer"
              >
                {leaving ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-[14px] font-[family-name:var(--font-body-md)] ${notice.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
            }`}>
            <span className="material-symbols-outlined text-[18px]">{notice.type === "success" ? "check_circle" : "error"}</span>
            {notice.msg}
          </div>
        </div>
      )}
    </>
  );
}