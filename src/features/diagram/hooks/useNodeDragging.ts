import { useCallback } from "react";
import { type Node } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";

export const useNodeDragging = () => {
  const triggerHistorySnapshot = useDiagramStore((s) => s.triggerHistorySnapshot);
  const recalculateNodeConnections = useDiagramStore((s) => s.recalculateNodeConnections);
  
  const temporal = useDiagramStore.temporal.getState();

  const onNodeDragStart = useCallback(() => {

    triggerHistorySnapshot();

    temporal.pause();
  }, [triggerHistorySnapshot, temporal]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      recalculateNodeConnections(node.id);

      temporal.resume();
    },
    [recalculateNodeConnections, temporal]
  );

  return { onNodeDragStart, onNodeDragStop };
};