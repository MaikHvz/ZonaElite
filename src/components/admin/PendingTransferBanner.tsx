"use client";

import Link from "next/link";
import { usePendingTransferCount } from "@/components/admin/PendingTransferProvider";

export default function PendingTransferBanner() {
  const { count, loading } = usePendingTransferCount();

  if (loading || count === 0) return null;

  const label =
    count === 1 ? "solicitud pendiente" : "solicitudes pendientes";

  return (
    <div className="mx-4 md:mx-6 mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/25">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-red-400 text-[22px]">account_balance_wallet</span>
          </div>
          <div>
            <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase tracking-wide">
              {count} {label} de pago por transferencia
            </p>
            <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
              Revisa los comprobantes y aprueba o rechaza cada solicitud.
            </p>
          </div>
        </div>
        <Link
          href="/admin/ventas?tab=solicitudes"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">fact_check</span>
          Revisar ahora
        </Link>
      </div>
    </div>
  );
}
