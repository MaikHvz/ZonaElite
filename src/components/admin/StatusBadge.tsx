const statusConfig: Record<string, { label: string; className: string }> = {
  activa: { label: "Activa", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  activo: { label: "Activo", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  publicado: { label: "Publicado", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  pagado: { label: "Pagado", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  confirmado: { label: "Confirmado", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  vencida: { label: "Vencida", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  vencido: { label: "Vencido", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  programado: { label: "Programado", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  pendiente: { label: "Pendiente", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  borrador: { label: "Borrador", className: "bg-on-surface/10 text-on-surface-variant border-on-surface/10" },
  cancelada: { label: "Cancelada", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelado: { label: "Cancelado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  rechazado: { label: "Rechazado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  enviado: { label: "Enviado", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  expirado: { label: "Expirado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-on-surface/10 text-on-surface-variant border-on-surface/10" };

  return (
    <span className={`inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}
