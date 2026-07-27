"use client";

import { useEffect, useState } from "react";
import {
  getUserNotifications,
  getPersonalNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationData,
  type UserNotification,
} from "@/lib/supabase/dashboard";
import NotificationItem from "@/components/dashboard/NotificationItem";
import { NotificationSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useSession } from "@/providers/SessionProvider";

type Filter = "all" | "aviso" | "recordatorio" | "comunicado" | "correo_masivo" | "personal";

interface UnifiedNotification {
  id: string;
  source: "global" | "personal";
  type: string;
  subject: string;
  content: string;
  created_at: string;
  read?: boolean;
}

export default function NotificacionesPage() {
  const { user } = useSession();
  const [globalNotifications, setGlobalNotifications] = useState<NotificationData[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<UserNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [markingRead, setMarkingRead] = useState(false);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const loadNotifications = async () => {
    setLoading(true);
    const [globalRes, personalRes] = await Promise.all([
      getUserNotifications(page, pageSize),
      user ? getPersonalNotifications(user.id) : Promise.resolve([]),
    ]);
    setGlobalNotifications(globalRes.data?.notifications || []);
    setPersonalNotifications(personalRes || []);
    setTotal((globalRes.data?.total || 0) + (personalRes?.length || 0));
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [page, user]);

  const unified: UnifiedNotification[] = [
    ...personalNotifications.map((n) => ({
      id: n.id,
      source: "personal" as const,
      type: "personal",
      subject: n.title,
      content: n.content,
      created_at: n.created_at,
      read: n.read,
    })),
    ...globalNotifications.map((n) => ({
      id: n.id,
      source: "global" as const,
      type: n.type,
      subject: n.subject,
      content: n.content,
      created_at: n.created_at,
    })),
  ];

  const filtered =
    filter === "all"
      ? unified
      : filter === "personal"
        ? unified.filter((n) => n.source === "personal")
        : unified.filter((n) => n.source === "global" && n.type === filter);

  const unreadPersonalCount = personalNotifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingRead(true);
    await markAllNotificationsAsRead(user.id);
    setPersonalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingRead(false);
  };

  const handleMarkRead = async (notification: UnifiedNotification) => {
    if (notification.source !== "personal" || notification.read) return;
    await markNotificationAsRead(notification.id);
    setPersonalNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "personal", label: `Personales${unreadPersonalCount > 0 ? ` (${unreadPersonalCount})` : ""}` },
    { key: "aviso", label: "Avisos" },
    { key: "recordatorio", label: "Recordatorios" },
    { key: "comunicado", label: "Comunicados" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
          Mis <span className="text-primary">Notificaciones</span>
        </h1>
        {unreadPersonalCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingRead}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {markingRead ? "Marcando..." : "Marcar todas leídas"}
          </button>
        )}
      </div>

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
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={`cursor-pointer ${n.source === "personal" && !n.read ? "bg-primary/5" : ""}`}
            >
              {n.source === "personal" ? (
                <PersonalNotificationItem notification={n} />
              ) : (
                <NotificationItem notification={n as unknown as NotificationData} />
              )}
            </div>
          ))
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

function PersonalNotificationItem({ notification }: { notification: UnifiedNotification }) {
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div className="py-4 border-b border-on-surface/5 last:border-b-0 hover:bg-on-surface/[0.02] transition-colors -mx-2 px-2 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[16px] text-green-400">token</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] uppercase tracking-wider text-on-surface-variant/60">
              Token
            </span>
            {!notification.read && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] text-on-surface-variant/40 ml-auto">
              {timeAgo}
            </span>
          </div>
          <h4 className="font-[family-name:var(--font-body-md)] text-[14px] md:text-[15px] text-on-surface font-medium mb-0.5">
            {notification.subject}
          </h4>
          <p className="font-[family-name:var(--font-body-md)] text-[12px] md:text-[13px] text-on-surface-variant line-clamp-2">
            {notification.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
