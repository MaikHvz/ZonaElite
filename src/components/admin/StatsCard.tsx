"use client";

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

export default function StatsCard({ icon, label, value, color = "primary" }: StatsCardProps) {
  const colorMap: Record<string, string> = {
    primary: "text-primary",
    green: "text-green-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
  };

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className={`material-symbols-outlined ${colorMap[color] || "text-primary"} text-[24px]`}>
          {icon}
        </span>
        <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
      </div>
      <p className="font-[family-name:var(--font-headline-lg)] text-[32px] text-on-surface">
        {value}
      </p>
    </div>
  );
}
