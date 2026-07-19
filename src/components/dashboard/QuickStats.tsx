function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statConfig = [
  {
    icon: "card_membership",
    label: "Membresías activas",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-l-primary-container",
  },
  {
    icon: "payments",
    label: "Pagos este mes",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-l-green-500",
  },
  {
    icon: "group",
    label: "Cargas",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-l-blue-500",
  },
];

export default function QuickStats({
  activeCount,
  paidThisMonth,
  dependentsCount,
}: {
  activeCount: number;
  paidThisMonth: number;
  dependentsCount: number;
}) {
  const values = [activeCount, formatCLP(paidThisMonth), dependentsCount];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
      {statConfig.map((stat, i) => (
        <div
          key={stat.label}
          className={`glass-card !rounded-xl border-l-[3px] ${stat.borderColor} p-4 md:p-5 group hover:scale-[1.02] transition-transform duration-300`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-9 h-9 rounded-lg ${stat.bgColor} flex items-center justify-center`}
            >
              <span
                className={`material-symbols-outlined ${stat.color} text-[20px]`}
              >
                {stat.icon}
              </span>
            </div>
            <span className="font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-on-surface-variant">
              {stat.label}
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[26px] md:text-[30px] text-on-surface">
            {values[i]}
          </p>
        </div>
      ))}
    </div>
  );
}
