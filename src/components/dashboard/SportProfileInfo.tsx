import type { SportProfileData, SportPodiumData } from "@/lib/sport-profile";
import PodiumStatsLine from "./PodiumStatsLine";

interface SportProfileInfoProps {
  profile: SportProfileData | null;
  podiums: SportPodiumData[];
  className?: string;
}

/**
 * Bloque "Perfil deportivo" reutilizable (tarjeta del titular y de las
 * cargas): disciplina + grado/cinturón + resumen de podios.
 * Sin perfil registrado muestra un estado neutro.
 */
export default function SportProfileInfo({
  profile,
  podiums,
  className = "",
}: SportProfileInfoProps) {
  const discipline = profile?.disciplines ?? null;
  const grade = profile?.belt_grades ?? null;

  return (
    <div className={`${className}`}>
      <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px] gap-4 pt-2 border-t border-on-surface/5">
        <span className="text-on-surface-variant shrink-0">Disciplina</span>
        <span className="text-on-surface text-right">
          {discipline ? discipline.name : "Sin asignar"}
        </span>
      </div>

      {grade && (
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px] gap-4">
          <span className="text-on-surface-variant shrink-0">Grado</span>
          <span className="text-on-surface text-right flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border border-on-surface/20"
              style={{ backgroundColor: grade.color }}
            />
            {grade.name}
          </span>
        </div>
      )}

      <PodiumStatsLine podiums={podiums} />
    </div>
  );
}
