function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function QuickStats({
  activeCount,
  paidThisMonth,
  dependentsCount,
}: {
  activeCount: number;
  paidThisMonth: number;
  dependentsCount: number;
}) {
  const stats = [
    {
      icon: "card_membership",
      label: "Membresías activas",
      value: activeCount,
      color: "text-primary",
    },
    {
      icon: "payments",
      label: "Pagos este mes",
      value: formatCLP(paidThisMonth),
      color: "text-green-400",
    },
    {
      icon: "group",
      label: "Cargas",
      value: dependentsCount,
      color: "text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-surface-container border border-on-surface/5 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`material-symbols-outlined ${stat.color} text-[24px]`}
            >
              {stat.icon}
            </span>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              {stat.label}
            </span>
          </div>
          <p className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
