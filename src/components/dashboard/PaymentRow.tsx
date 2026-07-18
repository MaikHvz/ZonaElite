import type { PaymentData } from "@/lib/supabase/dashboard";
import StatusBadge from "@/components/admin/StatusBadge";

const methodIcons: Record<string, string> = {
  efectivo: "payments",
  transferencia: "account_balance",
  flow: "credit_card",
  otro: "help",
};

const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  flow: "Flow",
  otro: "Otro",
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

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-on-surface/5 last:border-b-0 flex-wrap sm:flex-nowrap">
      <span className="font-[family-name:var(--font-label-sm)] text-[12px] text-on-surface-variant w-16 shrink-0">
        {date}
      </span>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">
          {methodIcons[payment.method] || "help"}
        </span>
        <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface truncate">
          {concept}
        </span>
      </div>

      <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface font-medium w-24 text-right shrink-0">
        {formatCLP(Number(payment.amount))}
      </span>

      <div className="w-20 shrink-0">
        <StatusBadge status={payment.status} />
      </div>

      {payment.receipt_url && (
        <a
          href={payment.receipt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="material-symbols-outlined text-on-surface-variant/50 hover:text-primary text-[18px] transition-colors shrink-0"
        >
          download
        </a>
      )}
    </div>
  );
}
