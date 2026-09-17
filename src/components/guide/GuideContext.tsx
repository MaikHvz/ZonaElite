"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
  /** Map of tourId → number of steps (passed from parent for decoupling) */
  tourStepCounts?: Record<string, number>;
}

export function GuideProvider({ children, tourStepCounts }: GuideProviderProps) {
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = activeTour && tourStepCounts ? (tourStepCounts[activeTour] ?? 0) : 0;

  const startTour = useCallback(
    (tourId: string) => {
      setActiveTour(tourId);
      setCurrentStep(0);
    },
    []
  );

  const endTour = useCallback(() => {
    if (activeTour) {
      // Mark tour as viewed in localStorage
      try {
        localStorage.setItem(`ze_guide_viewed_${activeTour}`, "1");
      } catch {
        // localStorage may be unavailable
      }
    }
    setActiveTour(null);
    setCurrentStep(0);
  }, [activeTour]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev + 1 >= totalSteps) {
        // Tour completed
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
  }, [totalSteps, activeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps]
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
