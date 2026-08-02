"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";

interface DebtRow {
  id: string;
  beneficiary_id: string;
  membership_id: string | null;
  session_id: string | null;
  amount: number;
  status: "pendiente" | "pagada" | "condonada";
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  beneficiaries?: {
    profiles?: { full_name: string } | null;
    dependents?: { full_name: string } | null;
  } | null;
  session?: {
    session_date: string;
    schedule?: { discipline?: { name: string } | null } | null;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  condonada: "Condonada",
};

export default function AdminDeudasPage() {
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pendientes" | "resueltas" | "todas">("pendientes");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const query = supabase
      .from("debts")
      .select(`
        *,
        beneficiaries(profiles(full_name), dependents(full_name)),
        session:class_sessions(session_date, schedule:schedules(discipline:disciplines(name)))
      `)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      setToast({ msg: getSupabaseErrorMessage(error), type: "error" });
      setLoading(false);
      return;
    }
    setDebts((data as DebtRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const beneficiaryName = (d: DebtRow) =>
    d.beneficiaries?.dependents?.full_name ||
    d.beneficiaries?.profiles?.full_name ||
    "Alumno";

  const resolveDebt = async (id: string, toStatus: "pagada" | "condonada") => {
    if (!window.confirm(`¿Marcar esta deuda como "${STATUS_LABEL[toStatus]}"?`)) return;
    setResolving(id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("debts")
      .update({
        status: toStatus,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
      })
      .eq("id", id);

    setResolving(null);
    if (error) {
      setToast({ msg: getSupabaseErrorMessage(error), type: "error" });
      return;
    }
    setToast({ msg: "Deuda actualizada correctamente", type: "success" });
    setLoading(true);
    load();
  };

  const resolveAll = async (beneficiaryId: string, toStatus: "pagada" | "condonada") => {
    const pendingCount = debts.filter(
      (d) => d.beneficiary_id === beneficiaryId && d.status === "pendiente"
    ).length;
    if (pendingCount === 0) return;
    if (!window.confirm(`¿Resolver las ${pendingCount} deudas pendientes de este alumno?`)) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("debts")
      .update({
        status: toStatus,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
      })
      .eq("beneficiary_id", beneficiaryId)
      .eq("status", "pendiente");

    if (error) {
      setToast({ msg: getSupabaseErrorMessage(error), type: "error" });
      return;
    }
    setToast({ msg: "Deudas actualizadas correctamente", type: "success" });
    setLoading(true);
    load();
  };

  const filtered = debts.filter((d) => {
    if (filter === "pendientes") return d.status === "pendiente";
    if (filter === "resueltas") return d.status !== "pendiente";
    return true;
  });

  const pendingCount = debts.filter((d) => d.status === "pendiente").length;
  const grouped = new Map<string, DebtRow[]>();
  for (const d of filtered) {
    const arr = grouped.get(d.beneficiary_id) || [];
    arr.push(d);
    grouped.set(d.beneficiary_id, arr);
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[26px] text-on-surface uppercase tracking-tighter">
            Deudas
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-1">
            Clases registradas por QR sin tokens disponibles. {pendingCount} pendientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              ["pendientes", "Pendientes"],
              ["resueltas", "Resueltas"],
              ["todas", "Todas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                filter === key
                  ? "bg-primary/15 text-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-[40px] mb-2 block">
            task_alt
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
            No hay deudas en esta vista.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([beneficiaryId, rows]) => {
            const anyPending = rows.some((r) => r.status === "pendiente");
            const name = beneficiaryName(rows[0]);
            return (
              <div key={beneficiaryId} className="bg-surface-container border border-on-surface/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-on-surface/5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    <span className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase">
                      {name}
                    </span>
                    {anyPending && (
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                        {rows.filter((r) => r.status === "pendiente").length} pendientes
                      </span>
                    )}
                  </div>
                  {anyPending && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resolveAll(beneficiaryId, "pagada")}
                        className="px-3 py-1.5 bg-green-500/10 text-green-400 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider rounded-lg hover:bg-green-500/20 transition-colors cursor-pointer"
                      >
                        Marcar todas pagadas
                      </button>
                      <button
                        onClick={() => resolveAll(beneficiaryId, "condonada")}
                        className="px-3 py-1.5 bg-on-surface/10 text-on-surface-variant font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider rounded-lg hover:bg-on-surface/15 transition-colors cursor-pointer"
                      >
                        Condonar todas
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                        <th className="px-5 py-3">Clase</th>
                        <th className="px-5 py-3">Fecha</th>
                        <th className="px-5 py-3">Estado</th>
                        <th className="px-5 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.id} className="border-t border-on-surface/5">
                          <td className="px-5 py-3 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                            {d.session?.schedule?.discipline?.name || "Clase"}
                          </td>
                          <td className="px-5 py-3 font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                            {d.session?.session_date
                              ? new Date(d.session.session_date + "T12:00:00").toLocaleDateString("es-CL", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-5 py-3">
                            {d.status === "pendiente" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => resolveDebt(d.id, "pagada")}
                                  disabled={resolving === d.id}
                                  className="px-3 py-1.5 bg-green-500/10 text-green-400 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                  Marcar pagada
                                </button>
                                <button
                                  onClick={() => resolveDebt(d.id, "condonada")}
                                  disabled={resolving === d.id}
                                  className="px-3 py-1.5 bg-on-surface/10 text-on-surface-variant font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider rounded-lg hover:bg-on-surface/15 transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                  Condonar
                                </button>
                              </div>
                            ) : (
                              <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                                {d.resolved_at
                                  ? new Date(d.resolved_at).toLocaleDateString("es-CL", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
