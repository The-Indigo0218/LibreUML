import { useEffect } from "react";
import dagre from "dagre";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useProjectStore } from "../../../store/project.store";

/**
 * Keyboard shortcuts hook - SSOT Version
 * 
 * The legacy version used useDiagramStore.temporal for undo/redo and
 * applyAutoLayout. These features are not yet available in the new SSOT
 * architecture. The hook skeleton is kept for future re-implementation.
 */
export const useKeyboardShortcuts = () => {
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);
  const getNodes = useProjectStore((s) => s.getNodes);
  const getEdges = useProjectStore((s) => s.getEdges);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      // Future: Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        // TODO: Re-implement undo/redo with SSOT-compatible history
      }

      // Future: Redo (Ctrl+Y / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        // TODO: Re-implement undo/redo with SSOT-compatible history
      }

      // Auto Layout (Ctrl+L)
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        
        if (!activeFileId) return;
        const file = getFile(activeFileId);
        if (!file) return;

        const nodes = getNodes(file.nodeIds);
        const edges = getEdges(file.edgeIds);

        const g = new dagre.graphlib.Graph();
        g.setGraph({
          rankdir: "TB", 
          nodesep: 100, 
          ranksep: 100 
        });
        g.setDefaultEdgeLabel(() => ({}));

        // Add nodes to dagre
        nodes.forEach((node) => {
          // Approximate width/height, could be refined if stored in domain metadata
          const width = 250;
          const height = 300;
          g.setNode(node.id, { width, height });
        });

        // Add edges to dagre
        edges.forEach((edge: any) => {
          g.setEdge(edge.sourceNodeId, edge.targetNodeId);
        });

        // Run layout algorithm
        dagre.layout(g);

        // Map new positions
        const positionMap = (file.metadata as any)?.positionMap || {};
        const newPositionMap = { ...positionMap };

        nodes.forEach((node) => {
          const nodeWithPosition = g.node(node.id);
          newPositionMap[node.id] = {
            x: nodeWithPosition.x - nodeWithPosition.width / 2,
            y: nodeWithPosition.y - nodeWithPosition.height / 2,
          };
        });

        // Update file
        updateFile(activeFileId, {
          metadata: {
            ...file.metadata,
            positionMap: newPositionMap,
          } as any,
        });
        markFileDirty(activeFileId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFileId, getFile, updateFile, markFileDirty, getNodes, getEdges]);
};