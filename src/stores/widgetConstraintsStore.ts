import { create } from 'zustand';
import { useCallback } from 'react';

export interface WidgetConstraints {
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  aspectRatio?: number;
  barPadding?: number;
  /** Hide this widget instance from the Bar shell */
  hiddenInBar?: boolean;
  /** Hide this widget instance from the desktop Area shell */
  hiddenInArea?: boolean;
  /** Popup stays above other windows (default false) */
  alwaysOnTop?: boolean;
  /** Hide popup when it loses focus (default true) */
  closeOnBlur?: boolean;
}

interface WidgetConstraintsState {
  constraints: Record<string, WidgetConstraints>;
  setConstraints: (id: string, constraints: WidgetConstraints) => void;
}

export const useWidgetConstraintsStore = create<WidgetConstraintsState>((set) => ({
  constraints: {},
  setConstraints: (id, constraints) => 
    set((state) => ({
      constraints: {
        ...state.constraints,
        [id]: {
          ...state.constraints[id],
          ...constraints,
        }
      }
    }))
}));

// Helper hook for widgets to use inside their components
export function useUpdateWidgetConstraints(id: string) {
  const setConstraints = useWidgetConstraintsStore(state => state.setConstraints);
  return useCallback((constraints: WidgetConstraints) => {
    setConstraints(id, constraints);
  }, [id, setConstraints]);
}
