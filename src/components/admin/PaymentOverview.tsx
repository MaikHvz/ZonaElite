"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface StatusCount { status: string; count: number; label: string; color: string; bg: string; }

export default function PaymentOverview() {
  const [data, setData] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pagado: { label: "Pagado", color: "text-green-400", bg: "bg-green-500" },
    pendiente: { label: "Pendiente", color: "text-yellow-400", bg: "bg-yellow-500" },
    rechazado: { label: "Rechazado", color: "text-red-400", bg: "bg-red-500" },
    expirado: { label: "Expirado", color: "text-red-400", bg: "bg-red-500" },
  };

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("payments")
      .select("status")
      .then(({ data: payments }) => {
        const counts: Record<string, number> = {};
        (payments || []).forEach((p) => {
          counts[p.status] = (counts[p.status] || 0) + 1;
        });
        const chartData: StatusCount[] = Object.entries(counts)
          .map(([status, count]) => ({
            status,
            count,
            label: statusConfig[status]?.label || status,
            color: statusConfig[status]?.color || "text-on-surface-variant",
            bg: statusConfig[status]?.bg || "bg-on-surface/20",
          }))
          .sort((a, b) => b.count - a.count);
        setData(chartData);
        setTotal(chartData.reduce((sum, d) => sum + d.count, 0));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-5">
      <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter mb-4">Estado de Pagos</h3>
      {total > 0 && (
        <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4">
          {data.map((d) => (
            <div key={d.status} className={`${d.bg} rounded-full`} style={{ width: `${(d.count / total) * 100}%` }} />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.status} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${d.bg}`} />
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{d.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">{d.count}</span>
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant/50">{total > 0 ? `${((d.count / total) * 100).toFixed(0)}%` : "0%"}</span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/50 italic">Sin pagos registrados</p>
        )}
      </div>
    </div>
  );
}
