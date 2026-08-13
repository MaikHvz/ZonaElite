"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUserPendingTransferCount } from "@/components/dashboard/UserPendingTransferProvider";

const tabs = [
  { label: "Resumen", href: "/dashboard", icon: "dashboard" },
  { label: "Membresías", href: "/dashboard/membresias", icon: "card_membership" },
  { label: "Pagos", href: "/dashboard/pagos", icon: "payments" },
  { label: "Mi Tienda", href: "/dashboard/tienda", icon: "storefront" },
  { label: "Cargas", href: "/dashboard/cargas", icon: "group" },
  { label: "Asistencia", href: "/dashboard/asistencia", icon: "fact_check" },
  { label: "Alertas", href: "/dashboard/notificaciones", icon: "notifications" },
  { label: "Reglamento", href: "/dashboard/reglamento", icon: "rule" },
];

// Tabs to show directly in mobile bottom nav (max 5 for good touch targets)
const MOBILE_PRIMARY_TABS = ["/dashboard", "/dashboard/membresias", "/dashboard/pagos", "/dashboard/cargas", "/dashboard/asistencia"];

export default function DashboardNav() {
  const pathname = usePathname();
  const { count: pendingTransferCount } = useUserPendingTransferCount();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs = tabs.filter((t) => MOBILE_PRIMARY_TABS.includes(t.href));
  const secondaryTabs = tabs.filter((t) => !MOBILE_PRIMARY_TABS.includes(t.href));

  // Check if the current route matches a secondary tab (to highlight "Más")
  const isSecondaryActive = secondaryTabs.some(
    (t) => pathname === t.href || (t.href !== "/dashboard" && pathname.startsWith(t.href))
  );

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
                {tab.href === "/dashboard/pagos" && pendingTransferCount > 0 && (
                  <span className="ml-auto flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white font-[family-name:var(--font-label-sm)] text-[11px] font-bold">
                    {pendingTransferCount > 99 ? "99+" : pendingTransferCount}
                  </span>
                )}
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

      {/* Mobile Bottom Nav — 5 primary tabs + "Más" overflow menu */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        {/* "Más" overflow panel */}
        {moreOpen && (
          <>
            {/* Backdrop to close the panel */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute bottom-full right-3 mb-2 z-50 glass-card !rounded-2xl p-2 min-w-[180px] shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
              {secondaryTabs.map((tab) => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-primary-container/15 text-primary"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {tab.icon}
                    </span>
                    <span className={`font-[family-name:var(--font-body-md)] text-[13px] ${isActive ? "font-medium" : ""}`}>
                      {tab.label}
                    </span>
                  </Link>
                );
              })}
              {/* Perfil link inside "Más" for mobile */}
              <Link
                href="/perfil"
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  pathname === "/perfil"
                    ? "bg-primary-container/15 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={pathname === "/perfil" ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  person
                </span>
                <span className={`font-[family-name:var(--font-body-md)] text-[13px] ${pathname === "/perfil" ? "font-medium" : ""}`}>
                  Mi Perfil
                </span>
              </Link>
            </div>
          </>
        )}

        <div className="mx-3 mb-3 glass-card !rounded-2xl px-1 py-2 flex items-center justify-around shadow-[0_-4px_30px_rgba(0,0,0,0.4)]">
          {primaryTabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/dashboard" && pathname.startsWith(tab.href));

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 relative min-w-[52px] ${
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
                {tab.href === "/dashboard/pagos" && pendingTransferCount > 0 && (
                  <span className="absolute -top-0.5 right-1 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white font-[family-name:var(--font-label-sm)] text-[9px] font-bold">
                    {pendingTransferCount > 9 ? "9+" : pendingTransferCount}
                  </span>
                )}
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

          {/* "Más" button for overflow tabs */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 relative min-w-[52px] cursor-pointer ${
              isSecondaryActive || moreOpen
                ? "text-primary"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
          >
            {isSecondaryActive && !moreOpen && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-primary-container" />
            )}
            <span
              className={`material-symbols-outlined transition-transform duration-300 ${
                moreOpen ? "text-[22px] rotate-45" : "text-[20px]"
              }`}
              style={isSecondaryActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {moreOpen ? "close" : "more_horiz"}
            </span>
            <span
              className={`font-[family-name:var(--font-label-sm)] leading-none ${
                isSecondaryActive || moreOpen ? "text-[9px]" : "text-[8px] opacity-70"
              }`}
            >
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
