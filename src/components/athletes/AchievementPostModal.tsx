"use client";

import { useEffect, useRef } from "react";
import AthleteAvatar from "./AthleteAvatar";
import { ACHIEVEMENT_BACKGROUND } from "./AchievementPostCard";
import {
  ACHIEVEMENT_KIND_LABEL,
  formatAchievementDate,
  type AchievementPost,
} from "@/lib/athlete-profile";

// Visor de una publicación (como abrir un post en Instagram):
// tarjeta grande + datos, con flechas/teclado para recorrerlas.
export default function AchievementPostModal({
  posts,
  index,
  onIndexChange,
  onClose,
  athleteName,
  athleteAlias,
  ringColor,
}: {
  posts: AchievementPost[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  athleteName: string;
  athleteAlias: string;
  ringColor: string | null;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const open = index !== null && index >= 0 && index < posts.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index! > 0) onIndexChange(index! - 1);
      if (e.key === "ArrowRight" && index! < posts.length - 1) onIndexChange(index! + 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "auto";
    };
  }, [open, index, posts.length, onClose, onIndexChange]);

  if (!open) return null;
  const post = posts[index!];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={post.title}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-[30px]">close</span>
      </button>

      {index! > 0 && (
        <button
          onClick={() => onIndexChange(index! - 1)}
          className="hidden md:flex absolute left-6 w-10 h-10 rounded-full bg-white/90 text-black items-center justify-center cursor-pointer hover:bg-white"
          aria-label="Anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}
      {index! < posts.length - 1 && (
        <button
          onClick={() => onIndexChange(index! + 1)}
          className="hidden md:flex absolute right-6 w-10 h-10 rounded-full bg-white/90 text-black items-center justify-center cursor-pointer hover:bg-white"
          aria-label="Siguiente"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}

      <div className="w-full max-w-[860px] bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col md:flex-row border border-on-surface/10">
        <div
          className="relative md:w-[58%] aspect-square flex flex-col items-center justify-center p-8 text-center"
          style={{ background: ACHIEVEMENT_BACKGROUND[post.kind] }}
        >
          {post.kind === "cinturon" && post.color && (
            <span
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[16%] opacity-90"
              style={{ backgroundColor: post.color }}
            />
          )}
          <span className="relative text-[72px] md:text-[96px] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {post.emoji}
          </span>
          <p className="relative mt-5 font-[family-name:var(--font-headline-md)] text-[22px] md:text-[28px] leading-tight uppercase text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
            {post.title}
          </p>
        </div>

        <div className="md:w-[42%] flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-on-surface/10">
            <AthleteAvatar name={athleteName} ringColor={ringColor} size="sm" />
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-body-md)] text-[14px] font-semibold text-on-surface truncate">
                {athleteAlias}
              </p>
              <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant truncate">
                {athleteName}
              </p>
            </div>
          </div>
          <div className="p-4 space-y-3 flex-1">
            <span className="inline-block font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">
              {ACHIEVEMENT_KIND_LABEL[post.kind]}
            </span>
            <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface">
              {post.title}
            </p>
            {post.subtitle && (
              <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                {post.subtitle}
              </p>
            )}
            {post.detail && (
              <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface/90 whitespace-pre-line">
                {post.detail}
              </p>
            )}
          </div>
          <div className="px-4 py-3 border-t border-on-surface/10 flex items-center justify-between">
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">
              {formatAchievementDate(post.date)}
            </span>
            <span className="font-[family-name:var(--font-label-sm)] text-[11px] text-on-surface-variant">
              {index! + 1} / {posts.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
