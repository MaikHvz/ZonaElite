"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import GuideHelpButton from "@/components/guide/GuideHelpButton";
import AccountSettings from "@/components/athletes/AccountSettings";

export default function PerfilPage() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.user_metadata?.full_name || "Sin nombre";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background pt-24 md:pt-28 pb-16 px-4 md:px-6">
      {/* Subtle decorative gradient */}
      <div className="fixed top-0 left-0 w-full h-[300px] pointer-events-none z-0 opacity-40 bg-gradient-to-b from-primary-container/5 via-transparent to-transparent" />

      <div className="max-w-[640px] mx-auto space-y-5 md:space-y-6 relative z-10">
        {/* Back link */}
        <Link
          href="/atletas/yo"
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Volver a mi perfil
        </Link>

        {/* Profile Header */}
        <div id="tour-profile-header" data-guide="perfil-header" className="glass-card bg-gradient-to-br from-primary-container/8 via-transparent to-transparent p-6 md:p-8 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 relative z-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-5 text-center sm:text-left">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl btn-primary-gradient flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(255,84,76,0.3)]">
                <span className="font-[family-name:var(--font-headline-lg)] text-white text-[28px] md:text-[32px]">
                  {initials}
                </span>
              </div>
              <div className="pt-1">
                <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] md:text-[36px] text-on-surface uppercase tracking-tighter leading-tight">
                  {displayName}
                </h1>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface-variant mt-1">
                  {user.email}
                </p>
              </div>
            </div>
            <GuideHelpButton tourId="perfil" pill />
          </div>
        </div>

        <AccountSettings />
      </div>
    </div>
  );
}
