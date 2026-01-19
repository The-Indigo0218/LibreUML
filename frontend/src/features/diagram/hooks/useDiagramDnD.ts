import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";
import { checkCollision } from "../../..//util/geometry";
import { NODE_WIDTH, NODE_HEIGHT } from "../../../config/theme.config";
import type { stereotype } from "../../../types/diagram.types";

export const useDiagramDnD = () => {
  const { screenToFlowPosition } = useReactFlow();

  const addNode = useDiagramStore((state) => state.addNode);

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const rawPos = screenToFlowPosition({ x: clientX, y: clientY });
      return {
        x: rawPos.x - NODE_WIDTH / 2,
        y: rawPos.y - NODE_HEIGHT / 2,
      };
    },
    [screenToFlowPosition],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault(); 
      event.dataTransfer.dropEffect = "move";

      const position = getCenteredPosition(event.clientX, event.clientY);

      const currentNodes = useDiagramStore.getState().nodes;

      const isColliding = checkCollision(position, currentNodes);

      if (isColliding) {
        event.dataTransfer.dropEffect = "none";
      }
    },
    [getCenteredPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow",
      ) as stereotype;

      if (!type) return;

      const position = getCenteredPosition(event.clientX, event.clientY);
      const currentNodes = useDiagramStore.getState().nodes;

      if (checkCollision(position, currentNodes)) {
        return;
      }

      addNode(position, type);
    },
    [addNode, getCenteredPosition],
  );

  return { onDragOver, onDrop };
};
