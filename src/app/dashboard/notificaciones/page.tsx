"use client";

import { useEffect, useState } from "react";
import {
  getUserNotifications,
  type NotificationData,
} from "@/lib/supabase/dashboard";
import NotificationItem from "@/components/dashboard/NotificationItem";
import { NotificationSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Filter = "all" | "aviso" | "recordatorio" | "comunicado" | "correo_masivo";

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    setLoading(true);
    getUserNotifications(page, pageSize).then(({ data }) => {
      setNotifications(data?.notifications || []);
      setTotal(data?.total || 0);
      setLoading(false);
    });
  }, [page]);

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "aviso", label: "Avisos" },
    { key: "recordatorio", label: "Recordatorios" },
    { key: "comunicado", label: "Comunicados" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Notificaciones</span>
      </h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-2 rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-on-surface-variant border-on-surface/10 hover:border-on-surface/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container border border-on-surface/5 rounded-2xl px-5">
        {loading ? (
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
              notifications_none
            </span>
            <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant">
              No tienes notificaciones
            </p>
          </div>
        ) : (
          filtered.map((n) => <NotificationItem key={n.id} notification={n} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-4 py-2 rounded-lg hover:border-on-surface/20 transition-colors disabled:opacity-30 cursor-pointer"
          >
            ← Anterior
          </button>
          <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant border border-on-surface/10 px-4 py-2 rounded-lg hover:border-on-surface/20 transition-colors disabled:opacity-30 cursor-pointer"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
