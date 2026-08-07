"use client";

import { useEffect, useState } from "react";
import { getChileToday } from "@/lib/dates";
import { daysRemaining } from "@/lib/membership-status";
import type { MembershipData, TokenInfo, PersonalizedPackData } from "@/lib/supabase/dashboard";
import { getRemainingTokens } from "@/lib/supabase/dashboard";

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface InscriptionInfo {
  hasActive: boolean;
  planName: string | null;
  endDate: string | null;
}

export interface BeneficiaryCardProps {
  beneficiaryId: string;
  name: string;
  isSelf: boolean;
  inscription: InscriptionInfo;
  activeMembership: MembershipData | null;
  packs: PersonalizedPackData[];
  hasEnrollmentPlans: boolean;
  hasPersonalizedPlans: boolean;
  onBuyInscription: () => void;
  onBuyPack: (beneficiaryId: string) => void;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const AVATAR_PALETTE = [
  "#ff544c", "#ff7043", "#e91e63", "#9c27b0",
  "#3f51b5", "#2196f3", "#00897b", "#ff9800",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = ((h * 31) + ch.charCodeAt(0)) & 0xff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function shortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function timeProgress(start: string, end: string, today: string): number {
  const s = +new Date(start + "T12:00:00");
  const e = +new Date(end + "T12:00:00");
  const n = +new Date(today + "T12:00:00");
  if (n >= e) return 100;
  if (n <= s) return 0;
  return Math.round(((n - s) / (e - s)) * 100);
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function SectionLabel({ icon, label, iconColor }: { icon: string; label: string; iconColor?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="material-symbols-outlined text-[15px]"
        style={{ color: iconColor || "var(--on-surface-variant)" }}
      >
        {icon}
      </span>
      <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: "green" | "amber" | "red" | "gray";
}) {
  const styles = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    gray: "bg-on-surface/5 text-on-surface-variant border-on-surface/10",
  };
  return (
    <span
      className={`shrink-0 font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[variant]}`}
    >
      {label}
    </span>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

export default function BeneficiaryCard({
  beneficiaryId,
  name,
  isSelf,
  inscription,
  activeMembership,
  packs,
  hasEnrollmentPlans,
  hasPersonalizedPlans,
  onBuyInscription,
  onBuyPack,
}: BeneficiaryCardProps) {
  const today = getChileToday();
  const color = avatarColor(name);

  /* Token info for active membership */
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    if (activeMembership) {
      setTokenInfo(null);
      setTokenLoading(true);
      getRemainingTokens(activeMembership.beneficiary_id, activeMembership.id)
        .then((info) => { setTokenInfo(info); })
        .finally(() => setTokenLoading(false));
    }
  }, [activeMembership]);

  /* ── Inscription computed ── */
  const inscDaysLeft = inscription.endDate ? daysRemaining(inscription.endDate, today) : null;
  const inscExpiringSoon = inscription.hasActive && inscDaysLeft !== null && inscDaysLeft <= 30;

  /* ── Membership computed ── */
  const memberDaysLeft = activeMembership ? daysRemaining(activeMembership.end_date, today) : 0;
  const memberExpiringSoon = !!activeMembership && memberDaysLeft <= 7;
  const memberProgress = activeMembership
    ? timeProgress(activeMembership.start_date, activeMembership.end_date, today)
    : 0;

  /* ── Packs computed ── */
  const activePacks = packs.filter((p) => {
    if (p.status === "cancelada") return false;
    const eff = p.status === "activa" && p.end_date < today ? "vencida" : p.status;
    return eff === "activa";
  });
  const hasPacks = packs.some((p) => p.status !== "cancelada");
  const packClassesLeft = activePacks.reduce((s, p) => s + Math.max(0, p.total_classes - p.used_classes), 0);
  const packUsed = activePacks.reduce((s, p) => s + p.used_classes, 0);
  const packTotal = activePacks.reduce((s, p) => s + p.total_classes, 0);
  const packProgress = packTotal > 0 ? Math.round((packUsed / packTotal) * 100) : 0;
  const showPacksSection = hasPacks || hasPersonalizedPlans;

  /* ── Overall card state ── */
  const hasMembership = !!activeMembership;
  const cardState = inscription.hasActive && hasMembership
    ? "full"
    : inscription.hasActive || hasMembership
      ? "partial"
      : "none";
  const accentColor =
    cardState === "full" ? "#22c55e"
    : cardState === "partial" ? "#eab308"
    : "#ef4444";

  /* ── Token bar color ── */
  function tokenBarColor(rem: number | null, total: number | null): string {
    if (rem === null || total === null) return "linear-gradient(90deg, #22c55e, #16a34a)";
    if (rem <= 0) return "linear-gradient(90deg, #ef4444, #dc2626)";
    if (rem <= Math.ceil(total * 0.25)) return "linear-gradient(90deg, #ef4444, #dc2626)";
    if (rem <= Math.ceil(total * 0.5)) return "linear-gradient(90deg, #eab308, #f59e0b)";
    return "linear-gradient(90deg, #22c55e, #16a34a)";
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-surface-container-low border border-on-surface/5 transition-all duration-300 hover:shadow-lg hover:border-on-surface/10 flex flex-col"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {/* Top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(to right, ${accentColor}50, transparent 70%)` }}
      />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-[family-name:var(--font-headline-md)] text-[15px] text-white uppercase select-none"
            style={{
              backgroundColor: color,
              boxShadow: `0 4px 14px ${color}45`,
            }}
          >
            {initials(name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tight truncate">
                {name}
              </h3>
              <span
                className={`shrink-0 font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                  isSelf
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-on-surface/5 text-on-surface-variant border-on-surface/10"
                }`}
              >
                {isSelf ? "Titular" : "Carga"}
              </span>
            </div>
            {/* Coverage label */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span
                className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider"
                style={{ color: accentColor }}
              >
                {cardState === "full" ? "Cobertura completa"
                  : cardState === "partial" ? "Cobertura parcial"
                  : "Sin cobertura activa"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-on-surface/5" />

      {/* ── INSCRIPCIÓN ─────────────────────────────────────────────── */}
      <div className="p-5 pb-4">
        <SectionLabel
          icon="badge"
          label="Inscripción Academia"
          iconColor={inscription.hasActive ? "#4ade80" : undefined}
        />

        {inscription.hasActive ? (
          <div className="flex items-start justify-between gap-2">
            <div>
              {inscription.planName && (
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                  {inscription.planName}
                </p>
              )}
              {inscription.endDate && (
                <p
                  className={`font-[family-name:var(--font-body-sm)] text-[11px] mt-0.5 ${
                    inscExpiringSoon ? "text-amber-400" : "text-on-surface-variant"
                  }`}
                >
                  {inscExpiringSoon ? "⚠ " : ""}Vence {shortDate(inscription.endDate)}
                  {inscDaysLeft !== null && (
                    <span className="opacity-70"> · {inscDaysLeft}d restantes</span>
                  )}
                </p>
              )}
            </div>
            <StatusPill label={inscExpiringSoon ? "Pronto" : "Vigente"} variant={inscExpiringSoon ? "amber" : "green"} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 italic">
              Sin inscripción activa
            </p>
            {hasEnrollmentPlans && (
              <button
                onClick={onBuyInscription}
                className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-amber-400 border border-amber-400/30 px-2.5 py-1 rounded-full hover:bg-amber-400/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[12px]">add</span>
                Inscribirse
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mx-5 h-px bg-on-surface/5" />

      {/* ── MEMBRESÍA ───────────────────────────────────────────────── */}
      <div className="p-5 pb-4">
        <SectionLabel
          icon="card_membership"
          label="Membresía"
          iconColor={activeMembership ? "var(--primary)" : undefined}
        />

        {activeMembership ? (
          <>
            {/* Plan header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface font-medium truncate">
                  {activeMembership.plan?.name || "Plan"}
                </p>
                <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant mt-0.5">
                  {shortDate(activeMembership.start_date)} → {shortDate(activeMembership.end_date)}
                </p>
              </div>
              <StatusPill
                label={memberExpiringSoon ? `⚠ ${memberDaysLeft}d` : `${memberDaysLeft}d`}
                variant={memberExpiringSoon ? "amber" : "green"}
              />
            </div>

            {/* Time progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-[family-name:var(--font-label-sm)] text-[9px] text-on-surface-variant/50 uppercase tracking-wider">
                  Tiempo transcurrido
                </span>
                <span className="font-[family-name:var(--font-label-sm)] text-[9px] text-on-surface-variant/50">
                  {memberProgress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${memberProgress}%`,
                    background: memberExpiringSoon
                      ? "linear-gradient(90deg, #eab308, #f59e0b)"
                      : "linear-gradient(90deg, #ff544c, #d32f2f)",
                  }}
                />
              </div>
            </div>

            {/* Token info panel */}
            <div className="p-3 rounded-xl bg-surface-container-lowest/60 border border-on-surface/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[14px]">
                  confirmation_number
                </span>
                {tokenLoading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="animate-spin w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
                    <span className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant">
                      Cargando clases...
                    </span>
                  </div>
                ) : tokenInfo ? (
                  tokenInfo.is_unlimited ? (
                    <span className="font-[family-name:var(--font-body-md)] text-[12px] text-green-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                      Clases ilimitadas
                    </span>
                  ) : (
                    <span className="font-[family-name:var(--font-body-md)] text-[12px]">
                      <span
                        className={`font-bold text-[15px] ${
                          (tokenInfo.remaining ?? 0) <= 0 ? "text-red-400" : "text-on-surface"
                        }`}
                      >
                        {Math.max(0, tokenInfo.remaining ?? 0)}
                      </span>
                      {tokenInfo.total !== null && (
                        <span className="text-on-surface-variant">
                          {" "}/ {tokenInfo.total} clases disponibles
                        </span>
                      )}
                    </span>
                  )
                ) : null}
              </div>

              {/* Token bar */}
              {tokenInfo && !tokenInfo.is_unlimited && tokenInfo.total !== null && tokenInfo.total > 0 && (
                <>
                  <div className="mt-2 h-1 rounded-full bg-on-surface/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((tokenInfo.total - tokenInfo.consumed) / tokenInfo.total) * 100))}%`,
                        background: tokenBarColor(tokenInfo.remaining, tokenInfo.total),
                      }}
                    />
                  </div>
                  <p className="mt-1.5 font-[family-name:var(--font-label-sm)] text-[9px] text-on-surface-variant/50 uppercase tracking-wider">
                    {tokenInfo.consumed} usadas
                    {tokenInfo.justified > 0 && ` · ${tokenInfo.justified} justificadas`}
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-body-sm)] text-[12px] text-on-surface-variant/60 italic">
              Sin membresía activa
            </p>
            <a
              href="/#membresias"
              className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-primary border border-primary/30 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">add</span>
              Ver planes
            </a>
          </div>
        )}
      </div>

      {/* ── CLASES PERSONALIZADAS ───────────────────────────────────── */}
      {showPacksSection && (
        <>
          <div className="mx-5 h-px bg-on-surface/5" />
          <div className="p-5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[15px]"
                  style={{ color: packClassesLeft > 0 ? "var(--primary)" : "var(--on-surface-variant)" }}
                >
                  workspace_premium
                </span>
                <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Clases Personalizadas
                </span>
              </div>
              {hasPersonalizedPlans && (
                <button
                  onClick={() => onBuyPack(beneficiaryId)}
                  className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-primary border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  + Pack
                </button>
              )}
            </div>

            {activePacks.length > 0 ? (
              <div className="p-3 rounded-xl bg-surface-container-lowest/60 border border-on-surface/5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">
                      <span
                        className={`font-bold text-[16px] ${packClassesLeft === 0 ? "text-red-400" : "text-primary"}`}
                      >
                        {packClassesLeft}
                      </span>
                      <span className="text-on-surface-variant text-[11px]"> clases disponibles</span>
                    </p>
                    <p className="font-[family-name:var(--font-body-sm)] text-[10px] text-on-surface-variant mt-0.5">
                      {activePacks.length} {activePacks.length === 1 ? "pack activo" : "packs activos"}
                      {" · "}{packUsed}/{packTotal} usadas
                    </p>
                  </div>
                  {packClassesLeft === 0 && (
                    <StatusPill label="Agotado" variant="red" />
                  )}
                </div>
                {/* Pack usage bar: shows remaining, not used */}
                <div className="mt-2.5 h-1 rounded-full bg-on-surface/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${100 - packProgress}%`,
                      background:
                        packClassesLeft === 0
                          ? "linear-gradient(90deg, #ef4444, #dc2626)"
                          : packClassesLeft <= Math.ceil(packTotal * 0.25)
                            ? "linear-gradient(90deg, #eab308, #f59e0b)"
                            : "linear-gradient(90deg, #ff544c, #d32f2f)",
                    }}
                  />
                </div>
              </div>
            ) : hasPacks ? (
              <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 italic">
                Packs agotados o vencidos
              </p>
            ) : (
              <p className="font-[family-name:var(--font-body-sm)] text-[11px] text-on-surface-variant/60 italic">
                Sin packs asignados
              </p>
            )}
          </div>
        </>
      )}

      {/* ── FOOTER SPACER ───────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* Bottom accent */}
      <div
        className="h-px mx-5 mb-0"
        style={{
          background: `linear-gradient(to right, ${accentColor}30, transparent)`,
        }}
      />
    </div>
  );
}
