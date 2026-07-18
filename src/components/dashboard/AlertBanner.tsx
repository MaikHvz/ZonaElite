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
      <div className="glass-panel rounded-xl p-4 border-l-4 border-red-500 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-red-400 text-[22px]">
            warning
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            {expired.length === 1
              ? `Tu membresía "${expired[0].plan?.name}" ha vencido`
              : `Tienes ${expired.length} membresías vencidas`}
          </p>
        </div>
        <Link
          href="https://wa.me/56900000000?text=Hola,%20quiero%20renovar%20mi%20membres%C3%ADa"
          target="_blank"
          className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors whitespace-nowrap"
        >
          Renovar
        </Link>
      </div>
    );
  }

  if (expiring.length > 0) {
    const days = getDaysRemaining(expiring[0].end_date);
    return (
      <div className="glass-panel rounded-xl p-4 border-l-4 border-yellow-500 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-yellow-400 text-[22px]">
            schedule
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            {expiring.length === 1
              ? `Tu membresía "${expiring[0].plan?.name}" vence en ${days} días`
              : `${expiring.length} membresías vencen pronto`}
          </p>
        </div>
        <Link
          href="https://wa.me/56900000000?text=Hola,%20quiero%20renovar%20mi%20membres%C3%ADa"
          target="_blank"
          className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-lg hover:bg-yellow-500/10 transition-colors whitespace-nowrap"
        >
          Renovar
        </Link>
      </div>
    );
  }

  if (active.length === 0 && memberships.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-4 border-l-4 border-primary flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[22px]">
            info
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">
            Aún no tienes una membresía activa
          </p>
        </div>
        <Link
          href="/#membresias"
          className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors whitespace-nowrap"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  return null;
}
