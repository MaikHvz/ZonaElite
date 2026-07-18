"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Resumen", href: "/dashboard" },
  { label: "Membresías", href: "/dashboard/membresias" },
  { label: "Pagos", href: "/dashboard/pagos" },
  { label: "Cargas", href: "/dashboard/cargas" },
  { label: "Asistencia", href: "/dashboard/asistencia" },
  { label: "Notificaciones", href: "/dashboard/notificaciones" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-px -mb-px scrollbar-hide">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`font-[family-name:var(--font-body-md)] text-[14px] px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "text-primary border-primary"
                : "text-on-surface-variant border-transparent hover:text-on-surface"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
