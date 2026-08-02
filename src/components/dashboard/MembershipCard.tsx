"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/admin/StatusBadge";
import { getChileToday } from "@/lib/dates";
import {
  effectiveMembershipStatus,
  daysRemaining,
} from "@/lib/membership-status";
import type { MembershipData, TokenInfo, PendingDebt } from "@/lib/supabase/dashboard";
import { getRemainingTokens, getPendingDebts } from "@/lib/supabase/dashboard";

function getProgress(start: string, end: string, today: string) {
  const s = new Date(start + "T12:00:00").getTime();
  const e = new Date(end + "T12:00:00").getTime();
  const now = new Date(today + "T12:00:00").getTime();
  if (now >= e) return 100;
  if (now <= s) return 0;
  return Math.round(((now - s) / (e - s)) * 100);
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MembershipCard({
  membership,
}: {
  membership: MembershipData;
}) {
  const today = getChileToday();
  const effectiveStatus = effectiveMembershipStatus(
    membership.status,
    membership.end_date,
    today
  );
  const progress = getProgress(membership.start_date, membership.end_date, today);
  const daysLeft = daysRemaining(membership.end_date, today);
  const isExpired = effectiveStatus === "vencida";
  const isWarning = effectiveStatus === "activa" && daysLeft <= 7;
  const beneficiaryName = membership.beneficiary?.dependent
    ? membership.beneficiary.dependent.full_name
    : null;

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);

  useEffect(() => {
    if (effectiveStatus === "activa") {
      getRemainingTokens(membership.beneficiary_id, membership.id).then((info) => {
        setTokenInfo(info);
      });
      getPendingDebts(membership.beneficiary_id).then(setPendingDebts);
    }
  }, [membership.beneficiary_id, membership.id, effectiveStatus]);

  const bgGradient = isExpired
    ? "from-red-950/20 to-transparent"
    : isWarning
    ? "from-yellow-950/20 to-transparent"
    : "from-primary-container/5 to-transparent";

  const borderClass = isExpired
    ? "border-red-500/20"
    : isWarning
    ? "border-yellow-500/30"
    : "border-on-surface/5 hover:border-primary/20";

  return (
    <div
      className={`glass-card bg-gradient-to-br ${bgGradient} ${borderClass} !border p-5 group hover:scale-[1.01] transition-all duration-300 ${
        isExpired ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isExpired
                ? "bg-red-500/10"
                : isWarning
                ? "bg-yellow-500/10"
                : "bg-primary/10"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                isExpired
                  ? "text-red-400"
                  : isWarning
                  ? "text-yellow-400"
                  : "text-primary"
              }`}
            >
              card_membership
            </span>
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[17px] md:text-[18px] text-on-surface uppercase">
              {membership.plan?.name || "Plan"}
            </h3>
            {beneficiaryName && (
              <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant mt-0.5">
                {beneficiaryName}
                {membership.beneficiary?.dependent?.category === "nino" &&
                  " (carga)"}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={membership.status} />
      </div>

      {/* Clases disponibles — siempre visible en membresías activas */}
      {effectiveStatus === "activa" && (
        <div className="mb-4 p-3 bg-surface-container-lowest/50 rounded-xl border border-on-surface/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary text-[16px]">confirmation_number</span>
            <span className="font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-on-surface">
              Clases disponibles
            </span>
          </div>
          {tokenInfo ? (
            tokenInfo.is_unlimited ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-400 text-[22px]">all_inclusive</span>
                  <span className="font-[family-name:var(--font-headline-md)] text-[18px] text-green-400">
                    Ilimitadas
                  </span>
                </div>
                {tokenInfo.consumed > 0 && (
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {tokenInfo.consumed} usadas
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className={`font-[family-name:var(--font-headline-md)] text-[24px] ${
                    tokenInfo.remaining !== null && tokenInfo.remaining > 0
                      ? "text-on-surface"
                      : "text-red-400"
                  }`}>
                    {tokenInfo.remaining !== null ? Math.max(0, tokenInfo.remaining) : 0}
                  </span>
                  {tokenInfo.total !== null && (
                    <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                      de {tokenInfo.total}
                    </span>
                  )}
                </div>
                {tokenInfo.total !== null && tokenInfo.total > 0 && (
                <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((tokenInfo.total - tokenInfo.consumed) / tokenInfo.total) * 100))}%`,
                      background: tokenInfo.remaining !== null && tokenInfo.remaining <= 0
                        ? "linear-gradient(90deg, #ef4444, #dc2626)"
                        : tokenInfo.remaining !== null && tokenInfo.remaining <= Math.ceil(tokenInfo.total * 0.25)
                          ? "linear-gradient(90deg, #ef4444, #dc2626)"
                          : tokenInfo.remaining !== null && tokenInfo.remaining <= Math.ceil(tokenInfo.total * 0.5)
                            ? "linear-gradient(90deg, #eab308, #f59e0b)"
                            : "linear-gradient(90deg, #22c55e, #16a34a)",
                    }}
                  />
                </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {tokenInfo.consumed} usadas · {tokenInfo.justified > 0 ? `${tokenInfo.justified} justificadas` : "0 justificadas"}
                  </span>
                  {tokenInfo.remaining !== null && tokenInfo.remaining <= 0 && (
                    <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-red-400">
                      {pendingDebts.length > 0
                        ? `Deuda: ${pendingDebts.length} ${pendingDebts.length === 1 ? "clase" : "clases"}`
                        : "Agotadas"}
                    </span>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="flex items-center gap-2 py-1">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                Cargando...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Deudas pendientes — siempre visible si existen */}
      {pendingDebts.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-red-400 text-[16px]">warning</span>
            <span className="font-[family-name:var(--font-headline-md)] text-[12px] uppercase tracking-wider text-red-400">
              Clases en deuda ({pendingDebts.length})
            </span>
          </div>
          <ul className="space-y-1">
            {pendingDebts.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                  {d.session?.schedule?.discipline?.name || "Clase"}
                </span>
                <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase text-on-surface-variant">
                  {d.session?.session_date
                    ? new Date(d.session.session_date + "T12:00:00").toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {pendingDebts.length > 3 && (
            <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant mt-1">
              y {pendingDebts.length - 3} más
            </p>
          )}
          <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant mt-2">
            El staff de la academia puede gestionar estas clases desde el panel de administración.
          </p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Inicio</span>
          <span className="text-on-surface">{formatDate(membership.start_date)}</span>
        </div>
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Vence</span>
          <span className="text-on-surface">{formatDate(membership.end_date)}</span>
        </div>
        {effectiveStatus === "activa" && (
          <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
            <span className="text-on-surface-variant">Días restantes</span>
            <span
              className={`font-medium ${
                daysLeft <= 7 ? "text-yellow-400" : "text-on-surface"
              }`}
            >
              {daysLeft} días
            </span>
          </div>
        )}
      </div>

      {/* Time progress bar */}
      <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            !isExpired ? "progress-glow" : ""
          }`}
          style={{
            width: `${progress}%`,
            background: isExpired
              ? "linear-gradient(90deg, #ef4444, #dc2626)"
              : isWarning
              ? "linear-gradient(90deg, #eab308, #f59e0b)"
              : "linear-gradient(90deg, #ff544c, #d32f2f)",
          }}
        />
      </div>

      {membership.plan?.benefits &&
        membership.plan.benefits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {membership.plan.benefits.map((b: string, i: number) => (
              <span
                key={i}
                className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] uppercase tracking-wider text-primary/70 bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10"
              >
                {b}
              </span>
            ))}
          </div>
        )}
    </div>
  );
}
