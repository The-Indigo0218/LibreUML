import { useCallback } from "react";
import type { Node } from "reactflow";

/**
 * Node dragging hook - SSOT Version
 * 
 * The legacy version used temporal (zundo) for history snapshots and
 * recalculated edge connections on drag. In the new SSOT architecture:
 * - Position changes are persisted via useDiagram.onNodesChange
 * - Edge connections are computed from domain data (no recalculation needed)
 * - Undo/redo will be re-implemented as a future feature
 */
export const useNodeDragging = () => {
  const onNodeDragStart = useCallback(() => {
    // Future: trigger history snapshot for undo/redo
  }, []);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      // Position is already persisted by useDiagram.onNodesChange
      // Edge recalculation is handled by the view mapper
    },
    []
  );

  return { onNodeDragStart, onNodeDragStop };
};