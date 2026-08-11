import type { SportProfileData, SportPodiumData } from "@/lib/sport-profile";
import PodiumStatsLine from "./PodiumStatsLine";

interface SportProfileInfoProps {
  profiles: SportProfileData[];
  podiums: SportPodiumData[];
  className?: string;
}

/**
 * Bloque "Perfil deportivo" reutilizable (tarjeta del titular y de las
 * cargas): lista de disciplinas entrenadas con su grado/cinturón +
 * resumen de podios. Un alumno puede entrenar varias disciplinas, cada
 * una con su propio cinturón.
 */
export default function SportProfileInfo({
  profiles,
  podiums,
  className = "",
}: SportProfileInfoProps) {
  return (
    <div className={`${className}`}>
      {profiles.length === 0 ? (
        <div className="flex justify-between font-[family-name:var(--font-body-md)] text-[13px] gap-4 pt-2 border-t border-on-surface/5">
          <span className="text-on-surface-variant shrink-0">Disciplinas</span>
          <span className="text-on-surface text-right">Sin asignar</span>
        </div>
      ) : (
        <div className="pt-2 border-t border-on-surface/5 space-y-1.5">
          <span className="block font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
            Perfil deportivo
          </span>
          {profiles.map((p) => {
            const discipline = p.disciplines ?? null;
            const grade = p.belt_grades ?? null;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 font-[family-name:var(--font-body-md)] text-[13px]"
              >
                <span className="text-on-surface-variant truncate">
                  {discipline?.name ?? "Sin disciplina"}
                </span>
                {grade ? (
                  <span className="text-on-surface text-right flex items-center gap-1.5 shrink-0">
                    <span
                      className="inline-block w-3 h-3 rounded-full border border-on-surface/20"
                      style={{ backgroundColor: grade.color }}
                    />
                    {grade.name}
                  </span>
                ) : (
                  <span className="text-on-surface-variant text-right shrink-0">Sin grado</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PodiumStatsLine podiums={podiums} />
    </div>
  );
}
