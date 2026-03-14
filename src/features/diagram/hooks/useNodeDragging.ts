import { useCallback } from "react";
import type { Node } from "reactflow";
import { useHistoryActions } from "./actions/useHistoryActions";

/**
 * Node dragging hook - SSOT Version with History
 * 
 * Manages node drag lifecycle with history tracking:
 * - onDragStart: Pause history to prevent pixel-by-pixel spam
 * - onDragStop: Resume history and commit final position
 * 
 * This ensures only the final position is recorded in history,
 * not every intermediate pixel during the drag operation.
 * 
 * Architecture:
 * - Position changes are persisted via useDiagram.onNodesChange
 * - Edge connections are computed from domain data
 * - History tracking is debounced to drag stop event
 */
export const useNodeDragging = () => {
  const { pauseTracking, resumeTracking } = useHistoryActions();

  const onNodeDragStart = useCallback(() => {
    // Pause history tracking to prevent recording every pixel
    pauseTracking();
    console.log('[NodeDrag] Started - History tracking paused');
  }, [pauseTracking]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      // Resume history tracking - the final position will be recorded
      resumeTracking();
      console.log('[NodeDrag] Stopped - History tracking resumed');
      
      // Position is already persisted by useDiagram.onNodesChange
      // The next state change will create a history entry with the final position
    },
    [resumeTracking]
  );

  return { onNodeDragStart, onNodeDragStop };
};