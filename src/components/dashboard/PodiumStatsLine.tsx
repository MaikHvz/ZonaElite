import type { SportPodiumData } from "@/lib/sport-profile";
import {
  computePodiumStats,
  podiumPositionMeta,
} from "@/lib/sport-profile";

interface PodiumStatsLineProps {
  podiums: SportPodiumData[];
  className?: string;
}

/**
 * Resumen de podios: total + medallas. Usado en las cards deportivas
 * (titular y cargas). Las estadísticas se calculan en runtime desde los
 * registros; nunca se persisten como columnas.
 */
export default function PodiumStatsLine({
  podiums,
  className = "",
}: PodiumStatsLineProps) {
  if (!podiums || podiums.length === 0) return null;

  const stats = computePodiumStats(podiums);
  const medals: { emoji: string; count: number }[] = [];
  if (stats.first > 0) medals.push({ emoji: podiumPositionMeta("1").emoji, count: stats.first });
  if (stats.second > 0) medals.push({ emoji: podiumPositionMeta("2").emoji, count: stats.second });
  if (stats.third > 0) medals.push({ emoji: podiumPositionMeta("3").emoji, count: stats.third });

  return (
    <div className={`flex items-center justify-between font-[family-name:var(--font-body-md)] text-[13px] ${className}`}>
      <span className="text-on-surface-variant">Podios</span>
      <span className="text-on-surface flex items-center gap-2">
        <span className="text-amber-400 font-semibold">{stats.total}</span>
        {medals.map((m, i) => (
          <span key={i} className="text-[12px]" title={`${m.count} podios`}>
            {m.emoji} {m.count}
          </span>
        ))}
      </span>
    </div>
  );
}
