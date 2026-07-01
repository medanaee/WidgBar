import { create } from 'zustand';

export interface SnapLine {
  type: 'vertical' | 'horizontal';
  position: number;
}

interface SnapState {
  lines: SnapLine[];
  setLines: (lines: SnapLine[]) => void;
  clearLines: () => void;
}

export const useSnapStore = create<SnapState>((set) => ({
  lines: [],
  setLines: (lines) => set({ lines }),
  clearLines: () => set({ lines: [] })
}));
