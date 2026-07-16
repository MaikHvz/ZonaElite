"use client";

import AdminGuard from "@/components/admin/AdminGuard";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useSession } from "@/providers/SessionProvider";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-6 py-4 border-b border-on-surface/5 bg-surface/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
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
                <div className="w-8 h-8 rounded-full btn-primary-gradient flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[16px]">person</span>
                </div>
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface hidden lg:block">
                  {profile?.full_name || "Admin"}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
