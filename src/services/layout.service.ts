import dagre from 'dagre';
import type { DomainNode } from '../core/domain/models/nodes';
import type { DomainEdge } from '../core/domain/models/edges';

/**
 * Position Map Type
 * Maps node IDs to their X,Y coordinates
 */
export type PositionMap = Record<string, { x: number; y: number }>;

/**
 * Layout Direction
 * - TB: Top to Bottom (vertical)
 * - LR: Left to Right (horizontal)
 */
export type LayoutDirection = 'TB' | 'LR';

/**
 * Layout Configuration
 */
interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  rankSep: number; // Separation between ranks (levels)
  nodeSep: number; // Separation between nodes in same rank
  edgeSep: number; // Separation between edges
  marginX: number; // Margin around the graph
  marginY: number;
}

/**
 * Default layout configuration
 */
const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 250,
  nodeHeight: 200,
  rankSep: 100, // Vertical spacing between levels
  nodeSep: 80,  // Horizontal spacing between nodes
  edgeSep: 20,
  marginX: 50,
  marginY: 50,
};

/**
 * Layout Service
 * 
 * Provides automatic graph layout using the Dagre algorithm.
 * Handles both connected and disconnected nodes gracefully.
 * 
 * Architecture:
 * - Uses Dagre for directed graph layout
 * - Supports Top-Bottom and Left-Right directions
 * - Handles disconnected nodes (places them in a grid)
 * - Returns position map for WorkspaceStore
 */
export class LayoutService {
  /**
   * Apply automatic layout to nodes based on their edges
   * 
   * @param nodes - Domain nodes to layout
   * @param edges - Domain edges defining connections
   * @param direction - Layout direction (TB or LR)
   * @param config - Optional layout configuration
   * @returns Position map with new coordinates for all nodes
   */
  static applyAutoLayout(
    nodes: DomainNode[],
    edges: DomainEdge[],
    direction: LayoutDirection = 'TB',
    config: Partial<LayoutConfig> = {}
  ): PositionMap {
    const layoutConfig = { ...DEFAULT_CONFIG, ...config };

    if (nodes.length === 0) {
      return {};
    }

    // Single node - center it
    if (nodes.length === 1) {
      return {
        [nodes[0].id]: { x: 0, y: 0 },
      };
    }

    // Separate connected and disconnected nodes
    const { connectedNodes, disconnectedNodes } = this.separateNodes(nodes, edges);

    // Layout connected nodes using Dagre
    const connectedPositions = connectedNodes.length > 0
      ? this.layoutConnectedNodes(connectedNodes, edges, direction, layoutConfig)
      : {};

    // Layout disconnected nodes in a grid
    const disconnectedPositions = disconnectedNodes.length > 0
      ? this.layoutDisconnectedNodes(
          disconnectedNodes,
          connectedPositions,
          direction,
          layoutConfig
        )
      : {};

    // Merge positions
    return { ...connectedPositions, ...disconnectedPositions };
  }

  /**
   * Separate nodes into connected and disconnected groups
   */
  private static separateNodes(
    nodes: DomainNode[],
    edges: DomainEdge[]
  ): { connectedNodes: DomainNode[]; disconnectedNodes: DomainNode[] } {
    const connectedNodeIds = new Set<string>();

    // Mark all nodes that have at least one edge
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.sourceNodeId);
      connectedNodeIds.add(edge.targetNodeId);
    });

    const connectedNodes = nodes.filter((node) => connectedNodeIds.has(node.id));
    const disconnectedNodes = nodes.filter((node) => !connectedNodeIds.has(node.id));

    return { connectedNodes, disconnectedNodes };
  }

  /**
   * Layout connected nodes using Dagre algorithm
   */
  private static layoutConnectedNodes(
    nodes: DomainNode[],
    edges: DomainEdge[],
    direction: LayoutDirection,
    config: LayoutConfig
  ): PositionMap {
    // Create a new directed graph
    const graph = new dagre.graphlib.Graph();

    // Set graph configuration
    graph.setGraph({
      rankdir: direction,
      ranksep: config.rankSep,
      nodesep: config.nodeSep,
      edgesep: config.edgeSep,
      marginx: config.marginX,
      marginy: config.marginY,
    });

    // Default to assigning a new object as a label for each new edge
    graph.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph
    nodes.forEach((node) => {
      graph.setNode(node.id, {
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    });

    // Add edges to graph
    edges.forEach((edge) => {
      // Only add edge if both nodes exist in the graph
      if (graph.hasNode(edge.sourceNodeId) && graph.hasNode(edge.targetNodeId)) {
        graph.setEdge(edge.sourceNodeId, edge.targetNodeId);
      }
    });

    // Run the layout algorithm
    dagre.layout(graph);

    // Extract positions from graph
    const positions: PositionMap = {};

    nodes.forEach((node) => {
      const graphNode = graph.node(node.id);
      if (graphNode) {
        // Dagre returns center coordinates, we need top-left
        positions[node.id] = {
          x: graphNode.x - config.nodeWidth / 2,
          y: graphNode.y - config.nodeHeight / 2,
        };
      }
    });

    return positions;
  }

  /**
   * Layout disconnected nodes in a grid below/beside the connected graph
   */
  private static layoutDisconnectedNodes(
    nodes: DomainNode[],
    connectedPositions: PositionMap,
    direction: LayoutDirection,
    config: LayoutConfig
  ): PositionMap {
    const positions: PositionMap = {};

    // Calculate bounds of connected graph
    const connectedBounds = this.calculateBounds(connectedPositions, config);

    // Grid configuration
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = config.nodeSep + config.nodeWidth;

    // Starting position (below or to the right of connected graph)
    let startX: number;
    let startY: number;

    if (direction === 'TB') {
      // Place disconnected nodes below the connected graph
      startX = connectedBounds.minX;
      startY = connectedBounds.maxY + config.rankSep * 2;
    } else {
      // Place disconnected nodes to the right of the connected graph
      startX = connectedBounds.maxX + config.rankSep * 2;
      startY = connectedBounds.minY;
    }

    // Layout nodes in a grid
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      positions[node.id] = {
        x: startX + col * spacing,
        y: startY + row * spacing,
      };
    });

    return positions;
  }

  /**
   * Calculate bounding box of positioned nodes
   */
  private static calculateBounds(
    positions: PositionMap,
    config: LayoutConfig
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    const nodeIds = Object.keys(positions);

    if (nodeIds.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodeIds.forEach((nodeId) => {
      const pos = positions[nodeId];
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + config.nodeWidth);
      maxY = Math.max(maxY, pos.y + config.nodeHeight);
    });

    return { minX, minY, maxX, maxY };
  }

  /**
   * Center the layout around origin (0, 0)
   * Useful for better viewport fitting
   */
  static centerLayout(positions: PositionMap, config: LayoutConfig): PositionMap {
    const bounds = this.calculateBounds(positions, config);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const centeredPositions: PositionMap = {};

    Object.entries(positions).forEach(([nodeId, pos]) => {
      centeredPositions[nodeId] = {
        x: pos.x - centerX,
        y: pos.y - centerY,
      };
    });

    return centeredPositions;
  }
}
