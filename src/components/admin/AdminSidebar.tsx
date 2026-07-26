"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { href: "/admin/blog", label: "Blog", icon: "article" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "notifications" },
  { href: "/admin/configuracion", label: "Configuración", icon: "settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col bg-surface-container border-r border-on-surface/5 transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-5 border-b border-on-surface/5">
        {!collapsed && (
          <span className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase tracking-tighter">
            Admin
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {sidebarLinks.map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
              {!collapsed && (
                <span className="font-[family-name:var(--font-body-md)] text-[14px]">{link.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
