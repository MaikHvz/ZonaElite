"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePendingTransferCount } from "@/components/admin/PendingTransferProvider";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/productos", label: "Productos", icon: "inventory_2" },
  { href: "/admin/eventos", label: "Eventos", icon: "emoji_events" },
  { href: "/admin/horarios", label: "Horarios", icon: "calendar_month" },
  { href: "/admin/tipos-clase", label: "Tipos de Clase", icon: "category" },
  { href: "/admin/asistencia", label: "Asistencia", icon: "fact_check" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "group" },
  { href: "/admin/membresias", label: "Membresías", icon: "card_membership" },
  { href: "/admin/inscripciones", label: "Inscripciones", icon: "badge" },
  { href: "/admin/deudas", label: "Deudas", icon: "account_balance_wallet" },
  { href: "/admin/ventas", label: "Ventas", icon: "receipt_long" },
  { href: "/admin/blog", label: "Blog", icon: "article" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "notifications" },
  { href: "/admin/reglamento", label: "Reglamento", icon: "menu_book" },
  { href: "/admin/changelog", label: "Changelog", icon: "update" },
  { href: "/admin/configuracion", label: "Configuración", icon: "settings" },
];

export default function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { count: pendingCount } = usePendingTransferCount();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-surface-container border-r border-on-surface/5 transition-all duration-300 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[72px]" : "md:w-[260px]"} w-[260px]`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-on-surface/5">
          <span className={`font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter ${collapsed ? "md:hidden" : ""}`}>
            Admin
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="md:hidden text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
              aria-label="Cerrar menú"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
              aria-label="Colapsar menú"
            >
              <span className="material-symbols-outlined text-[20px]">
                {collapsed ? "chevron_right" : "chevron_left"}
              </span>
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                } ${collapsed ? "md:justify-center" : ""}`}
              >
                <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
                <span className={`font-[family-name:var(--font-body-md)] text-[14px] ${collapsed ? "md:hidden" : ""}`}>
                  {link.label}
                </span>
                {link.href === "/admin/ventas" && pendingCount > 0 && (
                  <span
                    className={`ml-auto flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white font-[family-name:var(--font-label-md)] text-[11px] font-bold ${
                      collapsed ? "md:hidden" : ""
                    }`}
                    title={`${pendingCount} ${pendingCount === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`}
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
