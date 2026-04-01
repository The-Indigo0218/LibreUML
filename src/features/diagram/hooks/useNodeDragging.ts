import { useCallback, useRef } from "react";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore, withoutUndo } from "../../../store/project-vfs.store";
import { isDiagramView } from "./useVFSCanvasController";
import type { VFSFile, DiagramView } from "../../../core/domain/vfs/vfs.types";

/** Minimal node descriptor — only position and id are accessed during drag. */
interface PositionedNode {
  id: string;
  position: { x: number; y: number };
}

/**
 * Pre-drag position snapshot — saved on drag start, available for undo.
 * Maps node ID → { x, y } from the ViewNode before the drag began.
 */
export interface DragSnapshot {
  tabId: string;
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Node dragging hook — VFS architecture.
 *
 * - onNodeDragStart: captures pre-drag positions of ALL dragged nodes into a ref.
 * - onNodeDragStop: persists final positions to VFSStore and exposes the snapshot
 *   for future undo integration.
 *
 * POSITION FLOW:
 *   During drag → onNodesChange (in useVFSCanvasController) writes intermediate
 *                 positions to VFSStore so the controlled ReactFlow rerenders correctly.
 *   Drag end   → onNodeDragStop writes the final positions (authoritative commit)
 *                 and stores the pre-drag snapshot for undo.
 *
 * The intermediate writes in onNodesChange are necessary because ReactFlow is
 * fully controlled (nodes come from VFSStore via useMemo). Without them the
 * visual drag wouldn't work.
 */
export const useNodeDragging = () => {
  /** Pre-drag snapshot — persists across the drag lifecycle. */
  const dragSnapshotRef = useRef<DragSnapshot | null>(null);

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: PositionedNode, draggedNodes: PositionedNode[]) => {
      const tabId = useWorkspaceStore.getState().activeTabId;
      if (!tabId) return;

      // Capture pre-drag positions for all nodes being dragged.
      const positions = new Map<string, { x: number; y: number }>();
      for (const n of draggedNodes) {
        positions.set(n.id, { x: n.position.x, y: n.position.y });
      }
      dragSnapshotRef.current = { tabId, positions };
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: PositionedNode, draggedNodes: PositionedNode[]) => {
      const tabId = useWorkspaceStore.getState().activeTabId;
      if (!tabId) return;

      // Persist final positions to VFSStore.
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[tabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;

      // Build a lookup for quick position update
      const finalPositions = new Map<string, { x: number; y: number }>();
      for (const n of draggedNodes) {
        finalPositions.set(n.id, { x: n.position.x, y: n.position.y });
      }

      const updatedNodes = currentView.nodes.map((vn) => {
        const pos = finalPositions.get(vn.id);
        return pos ? { ...vn, x: pos.x, y: pos.y } : vn;
      });

      withoutUndo(() => {
        useVFSStore.getState().updateFileContent(tabId, {
          ...currentView,
          nodes: updatedNodes,
        });
      });

      dragSnapshotRef.current = null;
    },
    [],
  );

  return { onNodeDragStart, onNodeDragStop, dragSnapshotRef };
};
