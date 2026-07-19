import type { NotificationData } from "@/lib/supabase/dashboard";

const typeConfig: Record<string, { icon: string; label: string; dotColor: string; bg: string }> = {
  aviso: { icon: "notifications", label: "Aviso", dotColor: "bg-primary", bg: "bg-primary/10" },
  recordatorio: { icon: "event", label: "Recordatorio", dotColor: "bg-yellow-400", bg: "bg-yellow-500/10" },
  comunicado: { icon: "campaign", label: "Comunicado", dotColor: "bg-blue-400", bg: "bg-blue-500/10" },
  correo_masivo: { icon: "mail", label: "Correo masivo", dotColor: "bg-purple-400", bg: "bg-purple-500/10" },
};

export default function NotificationItem({
  notification,
}: {
  notification: NotificationData;
}) {
  const config = typeConfig[notification.type] || typeConfig.aviso;

  return (
    <div className="py-4 border-b border-on-surface/5 last:border-b-0 hover:bg-on-surface/[0.02] transition-colors -mx-2 px-2 rounded-lg">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
          <span className={`material-symbols-outlined text-[16px] ${
            config.dotColor === "bg-primary" ? "text-primary" :
            config.dotColor === "bg-yellow-400" ? "text-yellow-400" :
            config.dotColor === "bg-blue-400" ? "text-blue-400" : "text-purple-400"
          }`}>
            {config.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0`} />
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] uppercase tracking-wider text-on-surface-variant/60">
              {config.label}
            </span>
            <span className="font-[family-name:var(--font-label-sm)] text-[9px] md:text-[10px] text-on-surface-variant/40 ml-auto">
              {new Date(notification.created_at).toLocaleDateString("es-CL", {
                day: "numeric",
                month: "short",
              })}
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
