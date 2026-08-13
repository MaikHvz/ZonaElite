"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";
import { signOut } from "@/lib/supabase/auth";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/context/CartContext";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/quienes-somos", label: "Quiénes Somos" },
  { href: "/#disciplinas", label: "Disciplinas" },
  { href: "/horarios", label: "Horarios" },
  { href: "/#membresias", label: "Membresías" },
  { href: "/productos", label: "Tienda" },
  { href: "/eventos", label: "Eventos" },
  { href: "/blog", label: "Blog" },
];

const logoUrl = "/logo.png";

export default function Navbar() {
  const { user, loading, isAdmin } = useSession();
  const { totalItems } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(({ count }) => setNotifCount(count || 0));
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  if (pathname.startsWith("/admin")) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    setMobileOpen(false);
    await signOut();
    router.push("/auth");
  };

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b border-on-surface/10 ${
          scrolled
            ? "bg-surface/95 shadow-lg shadow-black/20"
            : "bg-surface/90 shadow-md shadow-primary/10"
        }`}
      >
        {/* Desktop */}
        <div className="hidden lg:flex justify-between items-center px-6 py-4 max-w-[1280px] mx-auto">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-10 w-10 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] uppercase tracking-tighter text-primary">
              ZONAELITE
            </span>
          </Link>

          <div className="flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => {
              const isHashLink = link.href.includes("#");
              if (isHashLink) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-on-surface hover:text-primary transition-colors duration-300 font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] tracking-[0.05em] uppercase whitespace-nowrap"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors duration-300 font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] tracking-[0.05em] uppercase whitespace-nowrap ${
                    pathname === link.href
                      ? "text-primary"
                      : "text-on-surface hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/carrito"
              className="relative text-on-surface-variant hover:text-primary transition-colors"
              title="Carrito"
            >
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/notificaciones"
                  className="relative text-on-surface-variant hover:text-primary transition-colors"
                  title="Notificaciones"
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  {notifCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard"
                  className="text-on-surface hover:text-primary transition-colors duration-300 font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider"
                >
                  Mi Panel
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-on-surface hover:text-primary transition-colors duration-300 font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/perfil"
                  className="flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-sm px-6 py-2 rounded-[0.25rem] hover:opacity-80 transition-opacity uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)]"
                >
                  <span className="material-symbols-outlined text-lg">person</span>
                  Perfil
                </Link>
              </div>
            ) : (
              <Link
                href="/auth"
                className="btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-sm px-6 py-2 rounded-[0.25rem] hover:opacity-80 transition-opacity uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)]"
              >
                Únete Ahora
              </Link>
            )
          )}
          </div>
        </div>

        {/* Tablet (md breakpoint) — show logo + hamburger */}
        <div className="hidden md:flex lg:hidden justify-between items-center px-5 py-4 w-full">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-9 w-9 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-md)] text-[22px] leading-[26px] uppercase tracking-tighter text-primary">
              ZONAELITE
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/carrito"
              className="relative text-on-surface-variant hover:text-primary transition-colors"
              title="Carrito"
            >
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>
            {!loading && user && (
              <Link
                href="/dashboard/notificaciones"
                className="relative text-on-surface-variant hover:text-primary transition-colors"
                title="Notificaciones"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {notifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-on-surface p-2 relative w-10 h-10 flex items-center justify-center"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <span
                className={`material-symbols-outlined transition-transform duration-300 ${
                  mobileOpen ? "rotate-90" : "rotate-0"
                }`}
                style={{ fontSize: 26 }}
              >
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile (sm breakpoint) */}
        <div className="flex md:hidden justify-between items-center px-4 py-3 w-full">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-8 w-8 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-md)] text-[20px] leading-[24px] uppercase tracking-tighter text-primary">
              ZONAELITE
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/carrito"
              className="relative text-on-surface-variant hover:text-primary transition-colors p-1"
              title="Carrito"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>
            {!loading && user && (
              <Link
                href="/dashboard/notificaciones"
                className="relative text-on-surface-variant hover:text-primary transition-colors p-1"
                title="Notificaciones"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-on-surface p-1.5 relative w-9 h-9 flex items-center justify-center"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <span
                className={`material-symbols-outlined transition-transform duration-300 ${
                  mobileOpen ? "rotate-90" : "rotate-0"
                }`}
                style={{ fontSize: 24 }}
              >
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay — always in DOM, controlled by CSS transitions */}
      <div
        className={`mobile-overlay ${
          mobileOpen ? "is-open" : ""
        } fixed inset-0 z-[45] bg-surface-container-lowest/98 flex flex-col items-center overflow-y-auto pt-24 pb-12 px-6`}
      >
        <div className="flex flex-col items-center gap-5 w-full max-w-sm">
          {navLinks.map((link, index) => {
            const isHashLink = link.href.includes("#");
            const commonClasses = `text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-2xl uppercase tracking-wide transition-colors duration-200 ${
              !isHashLink && pathname === link.href ? "text-primary" : ""
            }`;

            return isHashLink ? (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className={`${commonClasses} ${mobileOpen ? "menu-item-animate" : ""}`}
                style={mobileOpen ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className={`${commonClasses} ${mobileOpen ? "menu-item-animate" : ""}`}
                style={mobileOpen ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-16 h-px bg-on-surface/10 my-2" />

          <Link
            href="/carrito"
            onClick={closeMobile}
            className={`flex items-center gap-3 text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-xl uppercase tracking-wide transition-colors ${
              mobileOpen ? "menu-item-animate" : ""
            }`}
            style={mobileOpen ? { animationDelay: `${navLinks.length * 40}ms` } : undefined}
          >
            <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
            Carrito
            {totalItems > 0 && (
              <span className="bg-primary text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>

          {!loading && (
            user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-xl uppercase tracking-wide transition-colors ${
                    mobileOpen ? "menu-item-animate" : ""
                  }`}
                  style={mobileOpen ? { animationDelay: `${(navLinks.length + 1) * 40}ms` } : undefined}
                >
                  <span className="material-symbols-outlined text-[24px]">dashboard</span>
                  Mi Panel
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={closeMobile}
                    className={`flex items-center gap-3 text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-xl uppercase tracking-wide transition-colors ${
                      mobileOpen ? "menu-item-animate" : ""
                    }`}
                    style={mobileOpen ? { animationDelay: `${(navLinks.length + 2) * 40}ms` } : undefined}
                  >
                    <span className="material-symbols-outlined text-[24px]">shield_person</span>
                    Admin
                  </Link>
                )}

                {/* Divider */}
                <div className="w-16 h-px bg-on-surface/10 my-1" />

                <Link
                  href="/perfil"
                  onClick={closeMobile}
                  className={`flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-3 rounded-xl uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)] transition-opacity hover:opacity-90 ${
                    mobileOpen ? "menu-item-animate" : ""
                  }`}
                  style={mobileOpen ? { animationDelay: `${(navLinks.length + 3) * 40}ms` } : undefined}
                >
                  <span className="material-symbols-outlined text-xl">person</span>
                  Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={`text-red-400 font-[family-name:var(--font-headline-md)] text-base uppercase hover:text-red-300 transition-colors disabled:opacity-50 mt-2 ${
                    mobileOpen ? "menu-item-animate" : ""
                  }`}
                  style={mobileOpen ? { animationDelay: `${(navLinks.length + 4) * 40}ms` } : undefined}
                >
                  {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                onClick={closeMobile}
                className={`mt-4 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-lg px-8 py-3 rounded-xl uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)] transition-opacity hover:opacity-90 ${
                  mobileOpen ? "menu-item-animate" : ""
                }`}
                style={mobileOpen ? { animationDelay: `${(navLinks.length + 1) * 40}ms` } : undefined}
              >
                Únete Ahora
              </Link>
            )
          )}
        </div>
      </div>
    </>
  );
}
