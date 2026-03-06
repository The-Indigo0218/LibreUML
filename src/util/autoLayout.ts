import dagre from "dagre";
import type { Node, Edge } from "reactflow";
import type { UmlClassData } from "../features/diagram/types/diagram.types";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_HEIGHT = 300;

/**
 * Applies dagre layout algorithm to arrange nodes hierarchically
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges
 * @param direction - Layout direction: TB (top-bottom), LR (left-right), BT (bottom-top), RL (right-left)
 * @returns Object containing layouted nodes and edges
 */
export function getLayoutedElements(
  nodes: Node<UmlClassData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): { nodes: Node<UmlClassData>[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR" || direction === "RL";

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 100 : 80,
    ranksep: isHorizontal ? 150 : 120,
    edgesep: 50,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph with their dimensions
  nodes.forEach((node) => {
    const width = node.width || DEFAULT_NODE_WIDTH;
    const height = node.height || DEFAULT_NODE_HEIGHT;
    
    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Dagre returns center position, we need top-left corner
    const x = nodeWithPosition.x - (node.width || DEFAULT_NODE_WIDTH) / 2;
    const y = nodeWithPosition.y - (node.height || DEFAULT_NODE_HEIGHT) / 2;

    return {
      ...node,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}
