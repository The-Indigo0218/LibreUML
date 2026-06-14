import { create } from 'zustand';
import type { FragmentKind } from '../core/domain/vfs/vfs.types';

/**
 * Armed-tool state for the StarUML-style "draw a fragment" gesture (G-a).
 *
 * Clicking a fragment operator in the sidebar arms it instead of inserting
 * immediately. While armed, dragging a rectangle on the sequence canvas creates
 * the fragment covering whatever lifelines/messages fall inside; a plain click
 * (no drag) falls back to the legacy "cover every lifeline" insert. Escape, a
 * successful draw, or the fallback insert all disarm.
 */
interface SequenceToolState {
  armedFragmentKind: FragmentKind | null;
  arm: (kind: FragmentKind) => void;
  disarm: () => void;
  /** Arms the kind, or disarms it when it's already the armed one (toggle). */
  toggleArm: (kind: FragmentKind) => void;
}

export const useSequenceToolStore = create<SequenceToolState>((set) => ({
  armedFragmentKind: null,
  arm: (kind) => set({ armedFragmentKind: kind }),
  disarm: () => set({ armedFragmentKind: null }),
  toggleArm: (kind) =>
    set((s) => ({ armedFragmentKind: s.armedFragmentKind === kind ? null : kind })),
}));
