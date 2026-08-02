"use client";

import AdminGuard from "@/components/admin/AdminGuard";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { signOut } from "@/lib/supabase/auth";
import { useSession } from "@/providers/SessionProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    router.push("/auth");
  };

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-on-surface/5 bg-surface/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
                aria-label="Abrir menú"
              >
                <span className="material-symbols-outlined text-[24px]">menu</span>
              </button>
              <span className="material-symbols-outlined text-primary text-[24px]">shield_person</span>
              <span className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface uppercase tracking-wider">
                Panel de Administración
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant hover:text-primary transition-colors"
              >
                Ver sitio
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href="/perfil"
                  className="w-8 h-8 rounded-full btn-primary-gradient flex items-center justify-center"
                  aria-label="Ver perfil"
                >
                  <span className="material-symbols-outlined text-white text-[16px]">person</span>
                </Link>
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface hidden lg:block">
                  {profile?.full_name || "Admin"}
                </span>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-on-surface-variant hover:text-primary transition-colors p-1 cursor-pointer disabled:opacity-50"
                  aria-label="Cerrar sesión"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
