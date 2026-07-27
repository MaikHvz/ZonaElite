"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/providers/SessionProvider";
import { signOut } from "@/lib/supabase/auth";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/nosotros", label: "Nosotros" },
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setNotifCount(count || 0));
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setMobileOpen(false);
    await signOut();
    router.push("/auth");
  };

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b border-on-surface/10 shadow-md shadow-primary/10 ${
          scrolled
            ? "bg-surface/80 backdrop-blur-xl"
            : "bg-transparent backdrop-blur-xl bg-surface/5"
        }`}
      >
        {/* Desktop */}
        <div className="hidden md:flex justify-between items-center px-6 py-4 max-w-[1280px] mx-auto">
          <a href="/" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-10 w-10 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] uppercase tracking-tighter text-primary">
              ZONAELITE
            </span>
          </a>

          <div className="flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-on-surface hover:text-primary transition-colors duration-300 font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] tracking-[0.05em] uppercase"
              >
                {link.label}
              </a>
            ))}
          </div>

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

        {/* Mobile */}
        <div className="flex md:hidden justify-between items-center px-5 py-4 w-full">
          <a href="/" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="ZonaElite Logo"
              className="h-8 w-8 object-contain"
            />
            <span className="font-[family-name:var(--font-headline-lg-mobile)] text-[32px] leading-[36px] uppercase tracking-tighter text-primary">
              ZONAELITE
            </span>
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-on-surface p-2"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 28 }}
            >
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-surface-container-lowest/95 backdrop-blur-xl z-40 ${
          mobileOpen ? "flex" : "hidden"
        } flex-col items-center justify-center gap-8 pt-20`}
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className="text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-2xl uppercase"
          >
            {link.label}
          </a>
        ))}

        {!loading && (
          user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-2xl uppercase"
              >
                Mi Panel
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="text-on-surface hover:text-primary font-[family-name:var(--font-headline-md)] text-2xl uppercase"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/perfil"
                onClick={() => setMobileOpen(false)}
                className="mt-4 flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-xl px-8 py-3 rounded-[0.25rem] uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)]"
              >
                <span className="material-symbols-outlined text-xl">person</span>
                Perfil
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-red-400 font-[family-name:var(--font-headline-md)] text-lg uppercase hover:text-red-300 transition-colors disabled:opacity-50"
              >
                {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMobileOpen(false)}
              className="mt-8 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-xl px-8 py-3 rounded-[0.25rem] uppercase tracking-wider shadow-[0_0_20px_rgba(229,57,53,0.3)]"
            >
              Únete Ahora
            </Link>
          )
        )}
      </div>
    </>
  );
}
