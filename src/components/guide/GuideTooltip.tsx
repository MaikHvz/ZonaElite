"use client";

import { type GuideStep } from "./guide-data";

interface GuideTooltipProps {
  step: GuideStep;
  currentStep: number;
  totalSteps: number;
  tourTitle: string;
  tourIcon: string;
  position: { top: number; left: number };
  placement: "top" | "bottom" | "left" | "right";
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export default function GuideTooltip({
  step,
  currentStep,
  totalSteps,
  tourTitle,
  tourIcon,
  position,
  placement,
  onNext,
  onPrev,
  onClose,
}: GuideTooltipProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  // Arrow classes based on placement
  const arrowClass = (() => {
    switch (placement) {
      case "top":
        return "guide-tooltip-arrow-bottom";
      case "bottom":
        return "guide-tooltip-arrow-top";
      case "left":
        return "guide-tooltip-arrow-right";
      case "right":
        return "guide-tooltip-arrow-left";
      default:
        return "guide-tooltip-arrow-top";
    }
  })();

  return (
    <div
      className="guide-tooltip"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 10002,
      }}
    >
      {/* Arrow */}
      <div className={arrowClass} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[16px]">
              {step.icon || tourIcon}
            </span>
          </div>
          <div>
            <p className="font-[family-name:var(--font-label-sm)] text-[9px] uppercase tracking-wider text-on-surface-variant/60">
              {tourTitle}
            </p>
            <h3 className="font-[family-name:var(--font-headline-md)] text-[14px] text-on-surface leading-tight">
              {step.title}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-on-surface/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          aria-label="Cerrar guía"
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            close
          </span>
        </button>
      </div>

      {/* Description */}
      <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant leading-relaxed mb-4">
        {step.description}
      </p>

      {/* Footer: progress + navigation */}
      <div className="flex items-center justify-between gap-2">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-5 h-1.5 bg-primary"
                  : i < currentStep
                    ? "w-1.5 h-1.5 bg-primary/40"
                    : "w-1.5 h-1.5 bg-on-surface/15"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
            >
              Anterior
            </button>
          )}
          <button
            onClick={isLast ? onClose : onNext}
            className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-white bg-primary hover:bg-primary/90 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            {isLast ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
