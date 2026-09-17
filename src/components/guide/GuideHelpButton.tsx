"use client";

import { useGuide } from "./GuideContext";

interface GuideHelpButtonProps {
  /** Which tour to start */
  tourId: string;
  /** Optional: className overrides */
  className?: string;
  /** Show as a pill with text instead of just icon */
  showLabel?: boolean;
  /** Alias for showLabel */
  pill?: boolean;
  /** Label text (default: "¿Cómo usar?") */
  label?: string;
}

export default function GuideHelpButton({
  tourId,
  className,
  showLabel = false,
  pill = false,
  label = "¿Cómo usar?",
}: GuideHelpButtonProps) {
  const { startTour, activeTour } = useGuide();

  // Don't show while a tour is active
  if (activeTour) return null;

  const isPill = showLabel || pill;

  if (isPill) {
    return (
      <button
        type="button"
        onClick={() => startTour(tourId)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-[family-name:var(--font-label-sm)] uppercase tracking-wider bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${className || ""}`}
        aria-label={label}
        title="Ver guía interactiva"
      >
        <span className="material-symbols-outlined text-[15px]">help_outline</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startTour(tourId)}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${className || ""}`}
      aria-label="Ayuda"
      title="Ver guía interactiva de esta sección"
    >
      <span className="material-symbols-outlined text-[17px]">help_outline</span>
    </button>
  );
}
