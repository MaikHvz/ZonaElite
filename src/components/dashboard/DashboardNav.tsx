"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Resumen", href: "/dashboard", icon: "dashboard" },
  { label: "Membresías", href: "/dashboard/membresias", icon: "card_membership" },
  { label: "Pagos", href: "/dashboard/pagos", icon: "payments" },
  { label: "Cargas", href: "/dashboard/cargas", icon: "group" },
  { label: "Asistencia", href: "/dashboard/asistencia", icon: "fact_check" },
  { label: "Alertas", href: "/dashboard/notificaciones", icon: "notifications" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 sticky top-28 self-start h-fit">
        <div className="glass-card p-3 space-y-1">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
                  isActive
                    ? "bg-primary-container/15 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-container animate-glow" />
                )}
                <span
                  className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`font-[family-name:var(--font-body-md)] text-[13px] ${
                    isActive ? "font-medium" : ""
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Perfil link */}
        <Link
          href="/perfil"
          className="glass-card mt-3 px-4 py-3 flex items-center gap-3 text-on-surface-variant hover:text-on-surface transition-colors group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:scale-105 transition-transform">
            person
          </span>
          <span className="font-[family-name:var(--font-body-md)] text-[13px]">
            Mi Perfil
          </span>
        </Link>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-3 mb-3 glass-card !rounded-2xl px-2 py-2 flex items-center justify-around shadow-[0_-4px_30px_rgba(0,0,0,0.4)]">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 relative min-w-[48px] ${
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant/60 hover:text-on-surface-variant"
                }`}
              >
                {isActive && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-primary-container" />
                )}
                <span
                  className={`material-symbols-outlined transition-transform duration-300 ${
                    isActive ? "text-[22px] scale-110" : "text-[20px]"
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {tab.icon}
                </span>
                <span
                  className={`font-[family-name:var(--font-label-sm)] leading-none ${
                    isActive ? "text-[9px]" : "text-[8px] opacity-70"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
