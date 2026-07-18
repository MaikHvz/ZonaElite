"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getUserMemberships,
  type MembershipData,
} from "@/lib/supabase/dashboard";
import MembershipCard from "@/components/dashboard/MembershipCard";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Filter = "all" | "activa" | "vencida" | "cancelada";

export default function MembresiasPage() {
  const { user } = useSession();
  const [memberships, setMemberships] = useState<MembershipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    getUserMemberships(user.id).then(({ data }) => {
      setMemberships(data?.memberships || []);
      setLoading(false);
    });
  }, [user]);

  const filtered =
    filter === "all"
      ? memberships
      : memberships.filter((m) => m.status === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "activa", label: "Activas" },
    { key: "vencida", label: "Vencidas" },
    { key: "cancelada", label: "Canceladas" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
        Mis <span className="text-primary">Membresías</span>
      </h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-4 py-2 rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-on-surface-variant border-on-surface/10 hover:border-on-surface/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <MembershipCardSkeleton />
          <MembershipCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            card_membership
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-4">
            {filter === "all"
              ? "Aún no tienes membresías"
              : "No hay membresías con este filtro"}
          </p>
          <Link
            href="/#membresias"
            className="inline-block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            Ver planes de membresía →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MembershipCard key={m.id} membership={m} />
          ))}
        </div>
      )}
    </div>
  );
}
