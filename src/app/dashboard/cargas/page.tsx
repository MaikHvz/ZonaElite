"use client";

import { useSession } from "@/providers/SessionProvider";
import { useEffect, useState, useCallback } from "react";
import {
  getUserDependents,
  type DependentData,
} from "@/lib/supabase/dashboard";
import DependentCard from "@/components/dashboard/DependentCard";
import TutorSportCard from "@/components/dashboard/TutorSportCard";
import EditDependentModal from "@/components/dashboard/EditDependentModal";
import { MembershipCardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import GuideHelpButton from "@/components/guide/GuideHelpButton";

export default function CargasPage() {
  const { user } = useSession();
  const [dependents, setDependents] = useState<DependentData[]>([]);
  const [loading, setLoading] = useState(true);
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
        <div data-guide="cargas-header">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter">
            Mis <span className="text-primary">Cargas</span>
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant mt-1">
            Personas que has inscrito como tus dependientes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GuideHelpButton tourId="cargas" pill />
        </div>
      </div>

      {/* Una cuenta por alumno (migración 040): ya no se crean cargas nuevas. */}
      <div
        data-guide="cargas-agregar"
        className="glass-card !rounded-xl bg-gradient-to-r from-blue-950/30 to-transparent border-l-[3px] !border-l-blue-500 p-4 flex items-start gap-3"
      >
        <span className="material-symbols-outlined text-blue-400 text-[20px] shrink-0">info</span>
        <p className="font-[family-name:var(--font-body-md)] text-[13px] md:text-[14px] text-on-surface">
          Ahora cada alumno tiene su propia cuenta. Para inscribir a un hijo o familiar, crea una cuenta con su
          correo desde <strong>Registrarse</strong> o pide a la academia que la cree. Las cargas que ya tienes se
          trasladarán a la cuenta de cada alumno con todo su historial.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <MembershipCardSkeleton />
          <MembershipCardSkeleton />
        </div>
      ) : (
        <>
          <div id="tour-tutor-sport-card" data-guide="cargas-tutor-sport">
            <TutorSportCard />
          </div>
          {dependents.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <span className="material-symbols-outlined text-on-surface/20 text-[48px] mb-4 block">
                group
              </span>
              <p className="font-[family-name:var(--font-body-md)] text-on-surface-variant mb-2">
                No tienes dependientes registrados
              </p>
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant/60">
                Cada alumno se inscribe con su propia cuenta.
              </p>
            </div>
          ) : (
            <div id="tour-dependents-list" data-guide="cargas-card" className="space-y-4">
              {dependents.map((d) => (
                <DependentCard
                  key={d.id}
                  dependent={d}
                  onEdit={() => setEditingDependent(d)}
                />
              ))}
            </div>
          )}
        </>
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
