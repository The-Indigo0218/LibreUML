import { useCallback } from "react";
import type { Node } from "reactflow";

export const useNodeDragging = () => {
  const onNodeDragStart = useCallback(() => {
    console.log('[NodeDrag] Started');
  }, []);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      console.log('[NodeDrag] Stopped');
    },
    []
  );

  return { onNodeDragStart, onNodeDragStop };
};