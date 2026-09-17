"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useGuide } from "./GuideContext";
import { GUIDE_TOURS, type GuideStep } from "./guide-data";
import GuideTooltip from "./GuideTooltip";

const PADDING = 8; // px padding around spotlight
const TOOLTIP_GAP = 12; // px gap between spotlight and tooltip
const TOOLTIP_WIDTH = 320; // tooltip width
const TOOLTIP_MOBILE_WIDTH = 280;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getElementRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computePlacement(
  targetRect: Rect,
  preferredPosition: GuideStep["position"],
  viewW: number,
  viewH: number
): { placement: "top" | "bottom" | "left" | "right"; tooltipPos: { top: number; left: number } } {
  const isMobile = viewW < 768;
  const tw = isMobile ? TOOLTIP_MOBILE_WIDTH : TOOLTIP_WIDTH;
  const estimatedTooltipH = 180;

  // Helper: check if placement fits
  const fits = (p: "top" | "bottom" | "left" | "right") => {
    switch (p) {
      case "bottom":
        return targetRect.top + targetRect.height + PADDING + TOOLTIP_GAP + estimatedTooltipH < viewH;
      case "top":
        return targetRect.top - PADDING - TOOLTIP_GAP - estimatedTooltipH > 0;
      case "right":
        return targetRect.left + targetRect.width + PADDING + TOOLTIP_GAP + tw < viewW;
      case "left":
        return targetRect.left - PADDING - TOOLTIP_GAP - tw > 0;
    }
  };

  const order: Array<"top" | "bottom" | "left" | "right"> =
    preferredPosition && preferredPosition !== "auto"
      ? [preferredPosition, "bottom", "top", "right", "left"]
      : ["bottom", "top", "right", "left"];

  const placement = order.find(fits) || "bottom";

  // Compute tooltip position
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = targetRect.top + targetRect.height + PADDING + TOOLTIP_GAP;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      break;
    case "top":
      top = targetRect.top - PADDING - TOOLTIP_GAP - estimatedTooltipH;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      break;
    case "right":
      top = targetRect.top + targetRect.height / 2 - estimatedTooltipH / 2;
      left = targetRect.left + targetRect.width + PADDING + TOOLTIP_GAP;
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - estimatedTooltipH / 2;
      left = targetRect.left - PADDING - TOOLTIP_GAP - tw;
      break;
  }

  // Clamp within viewport
  left = Math.max(12, Math.min(left, viewW - tw - 12));
  top = Math.max(12, Math.min(top, viewH - estimatedTooltipH - 12));

  return { placement, tooltipPos: { top, left } };
}

export default function GuideTour() {
  const { activeTour, currentStep, nextStep, prevStep, endTour } = useGuide();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const tour = activeTour ? GUIDE_TOURS[activeTour] : null;
  const step = tour?.steps[currentStep] ?? null;

  // Compute position
  const updatePosition = useCallback(() => {
    if (!step) return;

    const rect = getElementRect(step.targetSelector);
    if (!rect) {
      // Element not found — still show tooltip centered
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      setTargetRect(null);
      setPlacement("bottom");
      setTooltipPos({
        top: viewH / 2 - 90,
        left: viewW / 2 - (viewW < 768 ? TOOLTIP_MOBILE_WIDTH : TOOLTIP_WIDTH) / 2,
      });
      return;
    }

    setTargetRect(rect);

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const { placement: p, tooltipPos: tp } = computePlacement(
      rect,
      step.position,
      viewW,
      viewH
    );
    setPlacement(p);
    setTooltipPos(tp);
  }, [step]);

  // Scroll target into view and update position
  useEffect(() => {
    if (!step) {
      setVisible(false);
      return;
    }

    // Small delay so DOM updates settle before we query elements
    const timer = setTimeout(() => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Wait for scroll to finish
        setTimeout(() => {
          updatePosition();
          setVisible(true);
        }, 400);
      } else {
        updatePosition();
        setVisible(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [step, updatePosition]);

  // Re-compute on resize and scroll
  useEffect(() => {
    if (!activeTour) return;

    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [activeTour, updatePosition]);

  // ESC to close
  useEffect(() => {
    if (!activeTour) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeTour, endTour]);

  // Lock body scroll while tour is active (only if needed or omit to allow scrolling)
  useEffect(() => {
    if (!activeTour) return;
    updatePosition();
    setVisible(true);
  }, [activeTour, updatePosition]);

  if (!activeTour || !tour || !step || !visible) return null;

  // Spotlight clip: create a massive shadow with a clear window over the target
  const spotlightStyle: React.CSSProperties = targetRect
    ? {
        position: "fixed",
        top: Math.max(0, targetRect.top - PADDING),
        left: Math.max(0, targetRect.left - PADDING),
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
        borderRadius: "12px",
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.78)",
        zIndex: 10000,
        pointerEvents: "none" as const,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.78)",
        zIndex: 10000,
        pointerEvents: "none" as const,
      };

  return createPortal(
    <>
      {/* Overlay backdrop — clicking closes the tour */}
      <div
        className="guide-overlay"
        onClick={endTour}
        aria-hidden="true"
      />

      {/* Spotlight window */}
      <div className={targetRect ? "guide-spotlight-box" : ""} style={spotlightStyle} />

      {/* Tooltip */}
      <GuideTooltip
        step={step}
        currentStep={currentStep}
        totalSteps={tour.steps.length}
        tourTitle={tour.pageTitle}
        tourIcon={tour.icon}
        position={tooltipPos}
        placement={placement}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
      />
    </>,
    document.body
  );
}
