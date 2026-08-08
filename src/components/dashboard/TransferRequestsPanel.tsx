"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/providers/SessionProvider";
import {
  getUserTransferRequests,
  type PaymentData,
} from "@/lib/supabase/dashboard";
import { useUserPendingTransferCount } from "@/components/dashboard/UserPendingTransferProvider";

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusConfig: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  pendiente: {
    label: "En revisión",
    icon: "schedule",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  pagado: {
    label: "Aprobada",
    icon: "check_circle",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  rechazado: {
    label: "Rechazada",
    icon: "cancel",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

export default function TransferRequestsPanel() {
  const { user } = useSession();
  const { count } = useUserPendingTransferCount();
  const [requests, setRequests] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserTransferRequests(user.id).then(({ data }) => {
      setRequests(data || []);
      setLoading(false);
    });
  }, [user]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-headline-md)] text-[18px] md:text-[20px] text-on-surface uppercase">
          Mis Solicitudes de Pago
        </h2>
        {count > 0 && (
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
            {count} {count === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-on-surface/5 animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl py-12 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            account_balance_wallet
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
            No has enviado solicitudes de pago por transferencia
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((p) => {
            const config = statusConfig[p.status] || statusConfig.pendiente;
            const date = new Date(p.created_at).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <div
                key={p.id}
                className="bg-surface-container border border-on-surface/5 rounded-2xl p-4 md:p-5"
              >
                <div className="flex flex-wrap items-start gap-3 md:gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                    <span className={`material-symbols-outlined text-[20px] ${config.color}`}>
                      {config.icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
                      {p.concept || "Pago por transferencia"}
                    </p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant">
                      {date}
                      {p.commerce_order && (
                        <span className="text-primary/80"> · {p.commerce_order}</span>
                      )}
                    </p>

                    {p.status === "rechazado" && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5">
                        <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0">
                          info
                        </span>
                        <div>
                          <p className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400">
                            Motivo del rechazo
                          </p>
                          <p className="font-[family-name:var(--font-body-md)] text-[12px] text-red-300">
                            {p.admin_note || "Sin motivo especificado."}
                          </p>
                        </div>
                      </div>
                    )}
                    {p.status === "pendiente" && (
                      <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-blue-400/80 mt-1">
                        Estamos revisando tu comprobante. Te avisaremos cuando esté lista.
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface">
                      {formatCLP(Number(p.amount) || 0)}
                    </p>
                    <span className={`inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border ${config.bg} ${config.color} border-current/20`}>
                      {config.label}
                    </span>
                  </div>

                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-on-surface/5 flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
                      title="Ver comprobante"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                        receipt_long
                      </span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
