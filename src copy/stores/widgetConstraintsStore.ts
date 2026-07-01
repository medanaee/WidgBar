import { create } from 'zustand';
import { useCallback } from 'react';

export interface WidgetConstraints {
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
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
        [id]: constraints
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
