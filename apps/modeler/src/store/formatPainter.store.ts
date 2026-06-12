import { create } from 'zustand';
import type { NodeBorderStyle } from '../core/domain/vfs/vfs.types';

export interface CopiedNodeStyle {
  color: string | null;
  borderWidth: number | null;
  borderStyle: NodeBorderStyle | null;
  fontFamily: string | null;
  fontSize: number | null;
}

interface FormatPainterState {
  copied: CopiedNodeStyle | null;
  copyStyle: (style: CopiedNodeStyle) => void;
  clear: () => void;
}

export const useFormatPainterStore = create<FormatPainterState>((set) => ({
  copied: null,
  copyStyle: (style) => set({ copied: style }),
  clear: () => set({ copied: null }),
}));
