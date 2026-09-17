"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { GUIDE_TOURS } from "./guide-data";

interface GuideState {
  /** Currently active tour ID, or null */
  activeTour: string | null;
  /** Current step index (0-based) */
  currentStep: number;
  /** Start a tour by ID */
  startTour: (tourId: string) => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
  /** End the current tour */
  endTour: () => void;
  /** Jump to a specific step */
  goToStep: (step: number) => void;
  /** Total steps in current tour */
  totalSteps: number;
}

const GuideContext = createContext<GuideState>({
  activeTour: null,
  currentStep: 0,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  endTour: () => {},
  goToStep: () => {},
  totalSteps: 0,
});

export function useGuide() {
  return useContext(GuideContext);
}

interface GuideProviderProps {
  children: ReactNode;
}

export function GuideProvider({ children }: GuideProviderProps) {
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = activeTour ? (GUIDE_TOURS[activeTour]?.steps.length ?? 0) : 0;

  const startTour = useCallback((tourId: string) => {
    setActiveTour(tourId);
    setCurrentStep(0);
  }, []);

  const endTour = useCallback(() => {
    if (activeTour) {
      try {
        localStorage.setItem(`ze_guide_viewed_${activeTour}`, "1");
      } catch {
        // localStorage fallback
      }
    }
    setActiveTour(null);
    setCurrentStep(0);
  }, [activeTour]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const tourLength = activeTour ? (GUIDE_TOURS[activeTour]?.steps.length ?? 0) : 0;
      if (prev + 1 >= tourLength) {
        if (activeTour) {
          try {
            localStorage.setItem(`ze_guide_viewed_${activeTour}`, "1");
          } catch {
            // ignore
          }
        }
        setActiveTour(null);
        return 0;
      }
      return prev + 1;
    });
  }, [activeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      const tourLength = activeTour ? (GUIDE_TOURS[activeTour]?.steps.length ?? 0) : 0;
      setCurrentStep(Math.max(0, Math.min(step, Math.max(0, tourLength - 1))));
    },
    [activeTour]
  );

  return (
    <GuideContext.Provider
      value={{
        activeTour,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        endTour,
        goToStep,
        totalSteps,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
}

