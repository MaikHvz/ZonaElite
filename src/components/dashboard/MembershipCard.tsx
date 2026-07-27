"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/admin/StatusBadge";
import type { MembershipData, TokenInfo } from "@/lib/supabase/dashboard";
import { getRemainingTokens } from "@/lib/supabase/dashboard";

function getProgress(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now >= e) return 100;
  if (now <= s) return 0;
  return Math.round(((now - s) / (e - s)) * 100);
}

function getDaysRemaining(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", {
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
  const progress = getProgress(membership.start_date, membership.end_date);
  const daysRemaining = getDaysRemaining(membership.end_date);
  const isExpired = membership.status === "vencida";
  const isWarning = daysRemaining <= 7 && membership.status === "activa";
  const beneficiaryName = membership.beneficiary?.dependent
    ? membership.beneficiary.dependent.full_name
    : null;

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  useEffect(() => {
    if (membership.status === "activa" && membership.plan?.tokens !== null && membership.plan?.tokens !== undefined) {
      getRemainingTokens(membership.beneficiary_id, membership.id).then((info) => {
        setTokenInfo(info);
      });
    }
  }, [membership.beneficiary_id, membership.id, membership.status, membership.plan?.tokens]);

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
            {membership.status === "activa" && membership.plan?.tokens !== null && membership.plan?.tokens !== undefined && (
              <div className="mt-1">
                {tokenInfo ? (
                  <span className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    tokenInfo.is_unlimited
                      ? "bg-green-500/10 text-green-400"
                      : tokenInfo.remaining !== null && tokenInfo.remaining > 0
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-red-500/10 text-red-400"
                  }`}>
                    {tokenInfo.is_unlimited
                      ? "Clases ilimitadas"
                      : `${tokenInfo.remaining}/${tokenInfo.total} tokens`
                    }
                  </span>
                ) : (
                  <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant/60">
                    Cargando tokens...
                  </span>
                )}
              </div>
            )}
            {membership.status === "activa" && (membership.plan?.tokens === null || membership.plan?.tokens === undefined) && (
              <div className="mt-1">
                <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                  Clases ilimitadas
                </span>
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={membership.status} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Inicio</span>
          <span className="text-on-surface">{formatDate(membership.start_date)}</span>
        </div>
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
          <span className="text-on-surface-variant">Vence</span>
          <span className="text-on-surface">{formatDate(membership.end_date)}</span>
        </div>
        {membership.status === "activa" && (
          <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px]">
            <span className="text-on-surface-variant">Días restantes</span>
            <span
              className={`font-medium ${
                daysRemaining <= 7 ? "text-yellow-400" : "text-on-surface"
              }`}
            >
              {daysRemaining} días
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

      {/* Token progress bar — only for limited plans */}
      {membership.status === "activa" && tokenInfo && !tokenInfo.is_unlimited && tokenInfo.total !== null && tokenInfo.total > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant/60">
              Tokens
            </span>
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant/60">
              {tokenInfo.consumed} usados / {tokenInfo.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, (tokenInfo.consumed / tokenInfo.total) * 100))}%`,
                background: tokenInfo.remaining !== null && tokenInfo.remaining < 0
                  ? "linear-gradient(90deg, #ef4444, #dc2626)"
                  : tokenInfo.remaining !== null && tokenInfo.remaining <= Math.ceil(tokenInfo.total * 0.25)
                    ? "linear-gradient(90deg, #ef4444, #dc2626)"
                    : tokenInfo.remaining !== null && tokenInfo.remaining <= Math.ceil(tokenInfo.total * 0.5)
                      ? "linear-gradient(90deg, #eab308, #f59e0b)"
                      : "linear-gradient(90deg, #22c55e, #16a34a)",
            }}
          />
        </div>
        </div>
      )}

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
