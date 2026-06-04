import { create } from 'zustand';

/**
 * Visual style subset that the format painter (R10) copies between nodes.
 * Currently just the per-node color override (the only stored visual style);
 * extend here as more style props become persistable (stroke, font, …).
 */
export interface CopiedNodeStyle {
  /** Color override (ViewNode.color); null means "explicitly no color" (clears). */
  color: string | null;
}

interface FormatPainterState {
  /** The last copied style, or null when the clipboard is empty. */
  copied: CopiedNodeStyle | null;
  /** Store a style copied from a source node. */
  copyStyle: (style: CopiedNodeStyle) => void;
  /** Clear the clipboard. */
  clear: () => void;
}

/**
 * Format-painter clipboard. Lives outside the undo system: copying is not an
 * edit, only pasting (applyNodeStyle) mutates the document.
 */
export const useFormatPainterStore = create<FormatPainterState>((set) => ({
  copied: null,
  copyStyle: (style) => set({ copied: style }),
  clear: () => set({ copied: null }),
}));
