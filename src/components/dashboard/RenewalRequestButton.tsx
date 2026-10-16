"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/providers/SessionProvider";
import { getChileToday } from "@/lib/dates";
import { effectiveMembershipStatus } from "@/lib/membership-status";

// Solicitud de renovación de membresía (v1.14.0, migración 044). Visible
// solo si el alumno tiene una membresía vencida y ninguna activa. La
// solicitud la atiende el admin; si le asigna una membresía por cualquier
// vía, la solicitud se aprueba sola (trigger en memberships).

type State =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "can_request"; beneficiaryId: string; planName: string }
  | { kind: "pending"; requestId: string; createdAt: string; planName: string };

export default function RenewalRequestButton({
  variant = "card",
  fallback = null,
}: {
  /** "inline": botón compacto (aviso del resumen) · "card": tarjeta (Membresías). */
  variant?: "inline" | "card";
  /** Lo que se muestra cuando no aplica la renovación (p.ej. el link a planes). */
  fallback?: ReactNode;
}) {
  const { user } = useSession();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const today = getChileToday();

    const { data: ben } = await supabase.from("beneficiaries").select("id").eq("profile_id", user.id).maybeSingle();
    if (!ben) { setState({ kind: "hidden" }); return; }

    const [{ data: memberships }, { data: pending }] = await Promise.all([
      supabase
        .from("memberships")
        .select("status, end_date, membership_plans(name)")
        .eq("beneficiary_id", ben.id)
        .neq("status", "cancelada")
        .order("end_date", { ascending: false })
        .limit(5),
      supabase
        .from("membership_renewal_requests")
        .select("id, created_at, membership_plans(name)")
        .eq("beneficiary_id", ben.id)
        .eq("status", "pendiente")
        .maybeSingle(),
    ]);

    const rows = (memberships || []) as unknown as { status: string; end_date: string; membership_plans: { name: string } | null }[];
    const hasActive = rows.some((m) => effectiveMembershipStatus(m.status, m.end_date, today) === "activa");

    if (pending) {
      setState({
        kind: "pending",
        requestId: pending.id,
        createdAt: pending.created_at,
        planName: (pending.membership_plans as unknown as { name?: string } | null)?.name || "tu plan",
      });
    } else if (!hasActive && rows.length > 0) {
      setState({ kind: "can_request", beneficiaryId: ben.id, planName: rows[0].membership_plans?.name || "tu plan" });
    } else {
      setState({ kind: "hidden" });
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (state.kind !== "can_request") return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/memberships/renewal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId: state.beneficiaryId, note }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo enviar la solicitud"); return; }
      setConfirmOpen(false);
      setNote("");
      await load();
    } catch {
      setError("No se pudo enviar la solicitud");
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (state.kind !== "pending") return;
    const supabase = createClient();
    await supabase.rpc("cancel_membership_renewal", { p_request_id: state.requestId });
    await load();
  };

  if (state.kind === "loading") return null;
  if (state.kind === "hidden") return <>{fallback}</>;

  const pendingText =
    state.kind === "pending"
      ? `Solicitud de renovación enviada el ${new Date(state.createdAt).toLocaleDateString("es-CL")}. La academia te avisará al renovarla.`
      : "";

  const confirmBox = confirmOpen && state.kind === "can_request" && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
      <div className="bg-surface-container-lowest border border-on-surface/10 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase">Solicitar renovación</h2>
        <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
          Se enviará a la academia una solicitud para renovar tu membresía <strong className="text-on-surface">{state.planName}</strong>.
          La academia coordinará el pago contigo y te avisará cuando esté renovada.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Comentario para la academia (opcional). Ej: pago en efectivo el lunes"
          className="w-full bg-background/80 border border-on-surface/10 rounded-xl px-4 py-3 text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50"
        />
        {error && <p className="text-[13px] text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 text-[14px] cursor-pointer">
            Cancelar
          </button>
          <button onClick={send} disabled={sending} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">
            {sending ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <>
        {state.kind === "pending" ? (
          <span className="shrink-0 font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-amber-300 border border-amber-500/30 px-3 py-2 rounded-lg" title={pendingText}>
            Renovación solicitada
          </span>
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            className="shrink-0 btn-primary-gradient font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-white px-4 py-2 rounded-lg shadow-[0_0_12px_rgba(255,84,76,0.2)] cursor-pointer"
          >
            Solicitar renovación
          </button>
        )}
        {confirmBox}
      </>
    );
  }

  return (
    <div className="glass-card !rounded-xl border-l-[3px] !border-l-amber-500 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="material-symbols-outlined text-amber-400 text-[22px] shrink-0">autorenew</span>
        <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface">
          {state.kind === "pending"
            ? pendingText
            : `Tu membresía ${state.planName} está vencida. Puedes pedirle a la academia que la renueve.`}
        </p>
      </div>
      {state.kind === "pending" ? (
        <button onClick={cancel} className="shrink-0 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant border border-on-surface/15 px-3 py-2 rounded-lg hover:bg-on-surface/5 cursor-pointer">
          Cancelar solicitud
        </button>
      ) : (
        <button onClick={() => setConfirmOpen(true)} className="shrink-0 btn-primary-gradient font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-white px-4 py-2 rounded-lg cursor-pointer">
          Solicitar renovación
        </button>
      )}
      {confirmBox}
    </div>
  );
}
