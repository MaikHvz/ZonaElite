import { formatPodiumDate } from "@/lib/sport-profile";
import type { AchievementKind, AchievementPost } from "@/lib/athlete-profile";

export const ACHIEVEMENT_BACKGROUND: Record<AchievementKind, string> = {
  campeonato: "linear-gradient(160deg, #3a2306 0%, #8a5a12 60%, #e6a53a 100%)",
  podio: "linear-gradient(160deg, #1c1b1b 0%, #3a2a1c 60%, #7a4a22 100%)",
  participacion: "linear-gradient(160deg, #131313 0%, #232222 100%)",
  cinturon: "linear-gradient(160deg, #131313 0%, #201f1f 100%)",
  trofeo: "linear-gradient(160deg, #2a0d06 0%, #7a1a0c 60%, #d93418 100%)",
};

// Tarjeta cuadrada de la cuadrícula de publicaciones (estilo Instagram).
export default function AchievementPostCard({
  post,
  onOpen,
}: {
  post: AchievementPost;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square w-full overflow-hidden text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      style={{ background: ACHIEVEMENT_BACKGROUND[post.kind] }}
      aria-label={`${post.title}, ${formatPodiumDate(post.date)}`}
    >
      {post.kind === "cinturon" && post.color && (
        <span
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[18%] opacity-90"
          style={{ backgroundColor: post.color }}
        />
      )}
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
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
    </button>
  );
}
