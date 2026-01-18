import { Position } from "reactflow";
import type { Node } from "reactflow";

const VALID_SOURCE_HANDLES = [
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
];

const VALID_TARGET_HANDLES = [
  { id: "top", position: Position.Top },
  { id: "left", position: Position.Left },
];

export const getSmartEdgeHandles = (sourceNode: Node, targetNode: Node) => {

  let minDistance = Infinity;
  let bestSourceHandle = "right";
  let bestTargetHandle = "left";

  VALID_SOURCE_HANDLES.forEach((srcHandle) => {
    VALID_TARGET_HANDLES.forEach((tgtHandle) => {
      const srcPos = getHandlePosition(sourceNode, srcHandle.position);
      const tgtPos = getHandlePosition(targetNode, tgtHandle.position);

      const distance = Math.hypot(srcPos.x - tgtPos.x, srcPos.y - tgtPos.y);

      if (distance < minDistance) {
        minDistance = distance;
        bestSourceHandle = srcHandle.id;
        bestTargetHandle = tgtHandle.id;
      }
    });
  });

  return { sourceHandle: bestSourceHandle, targetHandle: bestTargetHandle };
};

const getHandlePosition = (node: Node, position: Position) => {
  const x = node.position.x;
  const y = node.position.y;
  const w = node.width || 250;
  const h = node.height || 200;

  switch (position) {
    case Position.Top:
      return { x: x + w / 2, y: y };
    case Position.Bottom:
      return { x: x + w / 2, y: y + h };
    case Position.Left:
      return { x: x, y: y + h / 2 };
    case Position.Right:
      return { x: x + w, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
};