"use client";

import Link from "next/link";
import { useUserPendingTransferCount } from "@/components/dashboard/UserPendingTransferProvider";

export default function UserPendingTransferBanner() {
  const { count, loading } = useUserPendingTransferCount();

  if (loading || count === 0) return null;

  const label = count === 1 ? "solicitud pendiente" : "solicitudes pendientes";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-blue-400 text-[22px]">
            account_balance_wallet
          </span>
        </div>
        <div>
          <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase tracking-wide">
            Tienes {count} {label} por transferencia
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
            Estamos revisando tu comprobante. Aquí puedes ver su estado.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/pagos#solicitudes"
        className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider transition-colors cursor-pointer shrink-0"
      >
        <span className="material-symbols-outlined text-[16px]">fact_check</span>
        Ver solicitudes
      </Link>
    </div>
  );
}
