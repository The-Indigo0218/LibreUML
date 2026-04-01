/**
 * useCanvasKeyboard — canvas-level keyboard shortcuts.
 *
 * Shortcuts handled:
 *   Delete / Backspace  → delete all selected nodes (view-only) and edges (cascade)
 *   Ctrl+A / Cmd+A      → select all nodes on the diagram
 *
 * Escape is handled separately in useSelection (clears selection).
 * Ctrl+C/V/D (copy/paste/duplicate) are out of scope — see MAG-01.8+.
 * Undo/redo (Ctrl+Z/Y) are handled by useKeyboardShortcuts at the feature level.
 * Space+drag pan works via Konva's native stage.draggable (already wired in useViewport).
 *
 * Guards:
 *   - Ignores events originating from HTMLInputElement or HTMLTextAreaElement.
 *   - Does NOT fire when the user is typing in an inline editor (MAG-01.10).
 */

import { useEffect } from 'react';
import { useSelectionStore } from '../../store/selection.store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseCanvasKeyboardOptions {
  /** All node IDs currently in the diagram (for Ctrl+A). */
  allNodeIds: string[];
  /** Called with selected node IDs when Delete/Backspace is pressed. */
  onDeleteNodes: (nodeIds: string[]) => void;
  /** Called with selected edge IDs when Delete/Backspace is pressed. */
  onDeleteEdges: (edgeIds: string[]) => void;
  /** Called with all node IDs when Ctrl+A is pressed. */
  onSelectAll: (nodeIds: string[]) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCanvasKeyboard({
  allNodeIds,
  onDeleteNodes,
  onDeleteEdges,
  onSelectAll,
}: UseCanvasKeyboardOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is inside a text input (e.g., inline editor, rename field).
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ── Delete / Backspace: remove selected nodes + edges ──────────────
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedNodeIds, selectedEdgeIds } = useSelectionStore.getState();
        if (selectedEdgeIds.length > 0) onDeleteEdges(selectedEdgeIds);
        if (selectedNodeIds.length > 0) onDeleteNodes(selectedNodeIds);
        return;
      }

      // ── Ctrl+A / Cmd+A: select all nodes ──────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        onSelectAll(allNodeIds);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allNodeIds, onDeleteNodes, onDeleteEdges, onSelectAll]);
}
