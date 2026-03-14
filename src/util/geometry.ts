import { Position } from "reactflow";
import type { Node, Edge } from "reactflow";
import { NODE_WIDTH, NODE_HEIGHT } from "../config/theme.config";

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

  return { 
    sourceHandle: bestSourceHandle, 
    targetHandle: bestTargetHandle
  };
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

export const checkCollision = (
  position: { x: number; y: number },
  nodes: Node[],
) => {
  return nodes.some((node) => {
    const nodeW = node.width || NODE_WIDTH;
    const nodeH = node.height || NODE_HEIGHT;
    return (
      position.x < node.position.x + nodeW &&
      position.x + NODE_WIDTH > node.position.x &&
      position.y < node.position.y + nodeH &&
      position.y + NODE_HEIGHT > node.position.y
    );
  });
};

export const updateSyncedEdges = (
  movedNode: Node,
  allNodes: Node[],
  allEdges: Edge[]
): Edge[] => {
  const connectionMap = new Set<string>();

  return allEdges.reduce((acc, edge) => {
    const isSource = edge.source === movedNode.id;
    const isTarget = edge.target === movedNode.id;

    if (!isSource && !isTarget) {
      const key = `${edge.source}-${edge.target}`;
      if (connectionMap.has(key)) return acc; 
      connectionMap.add(key);
      acc.push(edge);
      return acc;
    }

    const sourceNode = isSource
      ? movedNode
      : allNodes.find((n) => n.id === edge.source);
    const targetNode = isTarget
      ? movedNode
      : allNodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) return acc;

    const key = `${sourceNode.id}-${targetNode.id}`;
    if (connectionMap.has(key)) {
      return acc; 
    }
    connectionMap.add(key);

    const { sourceHandle, targetHandle } = getSmartEdgeHandles(
      sourceNode,
      targetNode
    );

    acc.push({
      ...edge,
      sourceHandle,
      targetHandle,
    });

    return acc;
  }, [] as Edge[]);
};

// --- Floating Edge Intersection Utilities ---

function getNodeIntersection(intersectionNode: Node, targetNode: Node) {
  const intersectionNodeWidth = intersectionNode.width || 250;
  const intersectionNodeHeight = intersectionNode.height || 200;
  const intersectionNodePosition = intersectionNode.positionAbsolute || intersectionNode.position;
  const targetPosition = targetNode.positionAbsolute || targetNode.position;

  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + ((targetNode.width || 250) / 2);
  const y1 = targetPosition.y + ((targetNode.height || 200) / 2);

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

function getEdgePosition(node: Node, intersectionPoint: { x: number, y: number }) {
  const n = { ...(node.positionAbsolute || node.position), ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + (n.width || 250) - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= n.y + (n.height || 200) - 1) return Position.Bottom;

  return Position.Top;
}

export function getEdgeParams(source: Node, target: Node) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}