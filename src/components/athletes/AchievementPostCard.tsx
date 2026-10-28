import { formatPodiumDate } from "@/lib/sport-profile";
import type { AchievementKind, AchievementPost } from "@/lib/athlete-profile";

export const ACHIEVEMENT_BACKGROUND: Record<AchievementKind, string> = {
  campeonato: "linear-gradient(160deg, #3a2306 0%, #8a5a12 60%, #e6a53a 100%)",
  podio: "linear-gradient(160deg, #1c1b1b 0%, #3a2a1c 60%, #7a4a22 100%)",
  participacion: "linear-gradient(160deg, #131313 0%, #232222 100%)",
  cinturon: "linear-gradient(160deg, #131313 0%, #201f1f 100%)",
  trofeo: "linear-gradient(160deg, #2a0d06 0%, #7a1a0c 60%, #d93418 100%)",
  hito: "linear-gradient(160deg, #10141f 0%, #1e2a44 60%, #3c5a8a 100%)",
  publicacion: "linear-gradient(160deg, #1a1a1a 0%, #262424 100%)",
};

// Tarjeta cuadrada de la cuadrícula de publicaciones (estilo Instagram).
export default function AchievementPostCard({
  post,
  pinned,
  onOpen,
}: {
  post: AchievementPost;
  pinned: boolean;
  onOpen: () => void;
}) {
  const isText = post.kind === "publicacion";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square w-full overflow-hidden text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      style={{ background: ACHIEVEMENT_BACKGROUND[post.kind] }}
      aria-label={`${post.title}, ${formatPodiumDate(post.date)}${post.verified ? ", verificado por ZonaElite" : ""}${pinned ? ", fijada" : ""}`}
    >
      {post.kind === "cinturon" && post.color && (
        <span
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[18%] opacity-90"
          style={{ backgroundColor: post.color }}
        />
      )}

      {isText ? (
        <div className="relative z-10 h-full flex flex-col justify-center p-3 md:p-5">
          <span className="text-[16px] md:text-[22px] leading-none mb-1.5 md:mb-3">{post.emoji}</span>
          <p className="font-[family-name:var(--font-body-md)] text-[10px] md:text-[14px] leading-snug text-on-surface/90 line-clamp-4 md:line-clamp-5">
            {post.title}
          </p>
        </div>
      ) : (
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-2 md:p-4 text-center">
          <span className="text-[28px] md:text-[44px] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            {post.emoji}
          </span>
          <p className="mt-1.5 md:mt-3 font-[family-name:var(--font-headline-md)] text-[10px] md:text-[15px] leading-tight uppercase text-white line-clamp-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
            {post.title}
          </p>
          <p className="hidden md:block mt-1 font-[family-name:var(--font-body-md)] text-[11px] text-white/70 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
            {formatPodiumDate(post.date)}
          </p>
        </div>
      )}

      {/* Insignias: verificado (abajo) y fijada (arriba), como en Instagram */}
      {post.verified && (
        <span
          className="absolute z-20 bottom-1.5 left-1.5 md:bottom-2 md:left-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-gold text-background flex items-center justify-center"
          title="Verificado por ZonaElite"
        >
          <span className="material-symbols-outlined text-[11px] md:text-[14px] font-bold">check</span>
        </span>
      )}
      {pinned && (
        <span className="absolute z-20 top-1.5 right-1.5 md:top-2 md:right-2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" title="Fijada">
          <span className="material-symbols-outlined text-[16px] md:text-[20px]">push_pin</span>
        </span>
      )}
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
    </button>
  );
}
