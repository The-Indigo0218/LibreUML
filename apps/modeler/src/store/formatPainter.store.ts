import { create } from 'zustand';
import type { NodeBorderStyle } from '../core/domain/vfs/vfs.types';

/**
 * Visual style subset that the format painter copies between nodes.
 * Each field is captured from the source node; `null` means "explicitly none"
 * so pasting clears it on the target. Extend here as more style props become
 * persistable (font, …).
 */
export interface CopiedNodeStyle {
  /** Color override (ViewNode.color); null means "explicitly no color" (clears). */
  color: string | null;
  /** Border width override (ViewNode.borderWidth); null = shape default. */
  borderWidth: number | null;
  /** Border line style override (ViewNode.borderStyle); null = solid. */
  borderStyle: NodeBorderStyle | null;
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
