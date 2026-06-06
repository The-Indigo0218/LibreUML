/**
 * useRelationShortcuts — single-key activation of relation/connection tools.
 *
 * Mirrors what clicking a connection item in ToolPalette does: it sets the
 * active connection mode for the current tab. The mode is stored UPPERCASE
 * (same convention as ToolPalette.setConnectionMode) so useConnectionDraw and
 * the sequence message path read it consistently.
 *
 * Diagram-awareness: only keys whose candidate tool exists in the active
 * diagram's registry fire (see relationShortcuts.ts). A key with no valid tool
 * for the current diagram is ignored (event left untouched).
 *
 * Guards: ignores events while focus is in a text input / textarea /
 * contentEditable (e.g. inline node editor) and when a modifier is held.
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { getDiagramRegistry } from '../../core/registry/diagram-registry';
import { resolveRelationShortcut } from './relationShortcuts';

export function useRelationShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip modifier combos — those belong to the global Ctrl/Cmd shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Skip while typing in any editable surface.
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const tabId = useWorkspaceStore.getState().activeTabId;
      if (!tabId) return;

      const project = useVFSStore.getState().project;
      const node = project?.nodes[tabId];
      const diagramType =
        node?.type === 'FILE' && node.diagramType ? node.diagramType : 'CLASS_DIAGRAM';

      let availableToolIds: string[];
      try {
        availableToolIds = getDiagramRegistry(diagramType).tools.edges.map((tool) => tool.id);
      } catch {
        return;
      }

      const toolId = resolveRelationShortcut(e.key, availableToolIds);
      if (!toolId) return;

      e.preventDefault();
      useWorkspaceStore.getState().setTabConnectionMode(tabId, toolId.toUpperCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
