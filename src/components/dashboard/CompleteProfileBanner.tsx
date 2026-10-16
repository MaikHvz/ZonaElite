"use client";

import Link from "next/link";
import { useSession } from "@/providers/SessionProvider";

// Una cuenta por persona (migración 037): el RUT identifica al alumno y la
// fecha de nacimiento define su categoría. Avisa a perfiles antiguos que no
// los tienen.
export default function CompleteProfileBanner() {
  const { profile } = useSession();
  if (!profile) return null;

  const missing: string[] = [];
  if (!profile.rut) missing.push("RUT");
  if (!profile.birth_date) missing.push("fecha de nacimiento");
  if (missing.length === 0) return null;

  return (
    <div className="glass-card !rounded-xl bg-gradient-to-r from-amber-950/30 to-transparent border-l-[3px] !border-l-amber-500 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-amber-400 text-[20px]">badge</span>
        </div>
        <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface">
          Completa tu {missing.join(" y ")} en tu perfil para mantener tu cuenta al día.
        </p>
      </div>
      <Link
        href="/perfil"
        className="shrink-0 btn-primary-gradient font-[family-name:var(--font-label-sm)] text-[10px] md:text-[11px] uppercase tracking-wider text-white px-4 py-2 rounded-lg"
      >
        Completar
      </Link>
    </div>
  );
}
