"use client";

import { useSession } from "@/providers/SessionProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserProfile, type UserProfile } from "@/lib/supabase/profile";

export default function DashboardPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getUserProfile().then(setProfile);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const firstName = (profile?.full_name || user.user_metadata?.full_name || "Atleta").split(" ")[0];

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1280px] mx-auto">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-on-surface uppercase tracking-tighter mb-2">
          Bienvenido, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-10">
          Tu zona de entrenamiento. Gestiona tu membresía, horarios y progreso.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/horarios"
            className="bg-surface-container border border-on-surface/5 rounded-2xl p-6 hover:border-primary/30 transition-colors group"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-3">calendar_month</span>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-1 group-hover:text-primary transition-colors">
              Horarios
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
              Consulta los horarios de clases disponibles.
            </p>
          </Link>

          <Link
            href="/perfil"
            className="bg-surface-container border border-on-surface/5 rounded-2xl p-6 hover:border-primary/30 transition-colors group"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-3">person</span>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-1 group-hover:text-primary transition-colors">
              Mi Perfil
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
              Administra tu información personal.
            </p>
          </Link>

          <Link
            href="/nosotros"
            className="bg-surface-container border border-on-surface/5 rounded-2xl p-6 hover:border-primary/30 transition-colors group"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-3">info</span>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase mb-1 group-hover:text-primary transition-colors">
              Sobre Nosotros
            </h3>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
              Conoce nuestra filosofía y disciplinas.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
