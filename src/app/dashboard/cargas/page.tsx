"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback } from "react";
import {
  getUserDependents,
  type DependentData,
} from "@/lib/supabase/dashboard";
import DependentCard from "@/components/dashboard/DependentCard";
import AddDependentModal from "@/components/dashboard/AddDependentModal";
import EditDependentModal from "@/components/dashboard/EditDependentModal";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function CargasPage() {
  const { user } = useSession();
  const [dependents, setDependents] = useState<DependentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDependent, setEditingDependent] = useState<DependentData | null>(null);

  const fetchDependents = useCallback(async () => {
    if (!user) return;
    const { data } = await getUserDependents(user.id);
    setDependents(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDependents();
  }, [fetchDependents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
            Mis <span className="text-primary">Cargas</span>
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
            Personas que has inscrito como tus dependientes.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 flex items-center gap-2 btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Agregar carga
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <MembershipCardSkeleton />
          <MembershipCardSkeleton />
        </div>
      ) : dependents.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
            group
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-2">
            No tienes dependientes registrados
          </p>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60 mb-4">
            Agrega una carga para inscribir a un familiar o dependiente
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary border border-primary/30 px-6 py-2 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            Agregar primera carga
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dependents.map((d) => (
            <DependentCard
              key={d.id}
              dependent={d}
              onEdit={() => setEditingDependent(d)}
            />
          ))}
        </div>
      )}

      {user && (
        <AddDependentModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onAdded={fetchDependents}
          tutorId={user.id}
        />
      )}

      <EditDependentModal
        open={!!editingDependent}
        onClose={() => setEditingDependent(null)}
        onUpdated={fetchDependents}
        dependent={editingDependent}
      />
    </div>
  );
}
