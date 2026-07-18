import type { NotificationData } from "@/lib/supabase/dashboard";

const typeIcons: Record<string, string> = {
  aviso: "notifications",
  recordatorio: "event",
  comunicado: "campaign",
  correo_masivo: "mail",
};

const typeLabels: Record<string, string> = {
  aviso: "Aviso",
  recordatorio: "Recordatorio",
  comunicado: "Comunicado",
  correo_masivo: "Correo masivo",
};

export default function NotificationItem({
  notification,
}: {
  notification: NotificationData;
}) {
  const icon = typeIcons[notification.type] || "notifications";
  const label = typeLabels[notification.type] || notification.type;

  return (
    <div className="py-4 border-b border-on-surface/5 last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="material-symbols-outlined text-primary text-[18px]">
          {icon}
        </span>
        <span className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-primary/70">
          {label}
        </span>
      </div>
      <h4 className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface font-medium mb-1">
        {notification.subject}
      </h4>
      <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant line-clamp-2 mb-1.5">
        {notification.content}
      </p>
      <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant/60">
        {new Date(notification.created_at).toLocaleDateString("es-CL", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
    </div>
  );
}
