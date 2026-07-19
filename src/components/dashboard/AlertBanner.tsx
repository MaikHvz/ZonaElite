import Link from "next/link";
import type { MembershipData } from "@/lib/supabase/dashboard";

function getDaysRemaining(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function AlertBanner({
  memberships,
}: {
  memberships: MembershipData[];
}) {
  const active = memberships.filter((m) => m.status === "activa");
  const expired = memberships.filter((m) => m.status === "vencida");
  const expiring = active.filter((m) => getDaysRemaining(m.end_date) <= 7);

  if (expired.length > 0) {
    return (
      <div className="glass-card !rounded-xl bg-gradient-to-r from-red-950/30 to-transparent border-l-[3px] !border-l-red-500 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0 animate-pulse">
            <span className="material-symbols-outlined text-red-400 text-[20px]">
              warning
            </span>
          </div>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface truncate">
            {expired.length === 1
              ? `Tu membresía "${expired[0].plan?.name}" ha vencido`
              : `Tienes ${expired.length} membresías vencidas`}
          </p>
        </div>
        <Link
          href="https://wa.me/56900000000?text=Hola,%20quiero%20renovar%20mi%20membres%C3%ADa"
          target="_blank"
          className="shrink-0 btn-primary-gradient font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-white px-4 py-2 rounded-lg shadow-[0_0_12px_rgba(255,84,76,0.2)]"
        >
          Renovar
        </Link>
      </div>
    );
  }

  if (expiring.length > 0) {
    const days = getDaysRemaining(expiring[0].end_date);
    return (
      <div className="glass-card !rounded-xl bg-gradient-to-r from-yellow-950/20 to-transparent border-l-[3px] !border-l-yellow-500 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-yellow-400 text-[20px]">
              schedule
            </span>
          </div>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface truncate">
            {expiring.length === 1
              ? `Tu membresía "${expiring[0].plan?.name}" vence en ${days} días`
              : `${expiring.length} membresías vencen pronto`}
          </p>
        </div>
        <Link
          href="https://wa.me/56900000000?text=Hola,%20quiero%20renovar%20mi%20membres%C3%ADa"
          target="_blank"
          className="shrink-0 font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-lg hover:bg-yellow-500/10 transition-colors whitespace-nowrap"
        >
          Renovar
        </Link>
      </div>
    );
  }

  if (active.length === 0 && memberships.length === 0) {
    return (
      <div className="glass-card !rounded-xl bg-gradient-to-r from-primary-container/8 to-transparent border-l-[3px] !border-l-primary-container p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[20px]">
              info
            </span>
          </div>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface">
            Aún no tienes una membresía activa
          </p>
        </div>
        <Link
          href="/#membresias"
          className="shrink-0 font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors whitespace-nowrap"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  return null;
}
