import { useCallback } from "react";
import { useReactFlow, type Node } from "reactflow";
import { useDiagram } from "../../workspace/hooks/useDiagram";
import { checkCollision } from "../../../util/geometry";
import { NODE_WIDTH, NODE_HEIGHT } from "../../../config/theme.config";
import type { stereotype } from "../types/diagram.types";

const stereotypeToNodeType: Record<stereotype, string> = {
  class: 'CLASS',
  interface: 'INTERFACE',
  abstract: 'ABSTRACT_CLASS',
  enum: 'ENUM',
  note: 'NOTE',
};

export const useDiagramDnD = () => {
  const { screenToFlowPosition } = useReactFlow();
  const { addNodeToDiagram, nodes } = useDiagram();

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
      const isColliding = checkCollision(position, nodes as Node[]);

      if (isColliding) {
        event.dataTransfer.dropEffect = "none";
      }
    },
    [getCenteredPosition, nodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const stereotype = event.dataTransfer.getData(
        "application/reactflow",
      ) as stereotype;

      if (!stereotype) return;

      const position = getCenteredPosition(event.clientX, event.clientY);

      if (checkCollision(position, nodes as Node[])) {
        return;
      }

      const nodeType = stereotypeToNodeType[stereotype];
      if (!nodeType) {
        console.warn(`Unknown stereotype: ${stereotype}`);
        return;
      }

      addNodeToDiagram(nodeType, position);
    },
    [addNodeToDiagram, getCenteredPosition, nodes],
  );

  return { onDragOver, onDrop };
};
