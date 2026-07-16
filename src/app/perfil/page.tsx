"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/supabase/auth";
import { getUserProfile, type UserProfile } from "@/lib/supabase/profile";

export default function PerfilPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getUserProfile().then(setProfile);
    }
  }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    router.push("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile?.full_name || user.user_metadata?.full_name || "Sin nombre";

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1280px] mx-auto">
        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-on-surface uppercase tracking-tighter mb-10">
          Mi <span className="text-primary">Perfil</span>
        </h1>

        <div className="max-w-2xl">
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 mb-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full btn-primary-gradient flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-3xl">person</span>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase">
                  {displayName}
                </h2>
                <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-on-surface/5">
                <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px]">
                  Nombre completo
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] text-on-surface">
                  {displayName}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-on-surface/5">
                <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px]">
                  Correo electrónico
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] text-on-surface">
                  {user.email}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-on-surface/5">
                <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px]">
                  Teléfono
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] text-on-surface">
                  {profile?.phone || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-on-surface/5">
                <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px]">
                  Cuenta verificada
                </span>
                <span className={`font-[family-name:var(--font-body-md)] text-[16px] ${user.email_confirmed_at ? "text-green-400" : "text-yellow-400"}`}>
                  {user.email_confirmed_at ? "Sí" : "Pendiente"}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px]">
                  Miembro desde
                </span>
                <span className="font-[family-name:var(--font-body-md)] text-[16px] text-on-surface">
                  {new Date(profile?.created_at || user.created_at).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full border border-red-500/30 text-red-400 font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
