import type { PaymentData } from "@/lib/supabase/dashboard";
import StatusBadge from "@/components/admin/StatusBadge";

const methodConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  efectivo: { icon: "payments", label: "Efectivo", color: "text-green-400", bg: "bg-green-500/10" },
  transferencia: { icon: "account_balance", label: "Transferencia", color: "text-blue-400", bg: "bg-blue-500/10" },
  flow: { icon: "credit_card", label: "Flow", color: "text-purple-400", bg: "bg-purple-500/10" },
  otro: { icon: "help", label: "Otro", color: "text-on-surface-variant", bg: "bg-on-surface/10" },
};

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentRow({ payment }: { payment: PaymentData }) {
  const concept =
    payment.membership?.plan?.name || payment.concept || "Pago";
  const date = new Date(payment.created_at).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
  const config = methodConfig[payment.method] || methodConfig.otro;

  return (
    <div className="flex items-center gap-3 md:gap-4 py-3.5 border-b border-on-surface/5 last:border-b-0 flex-wrap sm:flex-nowrap hover:bg-on-surface/[0.02] transition-colors -mx-2 px-2 rounded-lg">
      <span className="font-[family-name:var(--font-label-sm)] text-[11px] md:text-[12px] text-on-surface-variant/70 w-14 md:w-16 shrink-0">
        {date}
      </span>

      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
        <span className={`material-symbols-outlined ${config.color} text-[16px]`}>
          {config.icon}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface truncate block">
          {concept}
        </span>
        <span className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] uppercase tracking-wider text-on-surface-variant/50">
          {config.label}
        </span>
      </div>

      <span className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface font-medium w-20 md:w-24 text-right shrink-0">
        {formatCLP(Number(payment.amount))}
      </span>

      <div className="w-18 md:w-20 shrink-0">
        <StatusBadge status={payment.status} />
      </div>

      {payment.receipt_url && (
        <a
          href={payment.receipt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-lg bg-on-surface/5 flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0 group"
        >
          <span className="material-symbols-outlined text-on-surface-variant/50 group-hover:text-primary text-[16px] transition-colors">
            download
          </span>
        </a>
      )}
    </div>
  );
}
