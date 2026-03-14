import type { DomainNode } from '../../../core/domain/models/nodes';
import type { NodeView } from '../view-models/node-view.types';

/**
 * Maps a domain node type to its corresponding React Flow node type.
 * This determines which React component will render the node.
 */
function getDomainNodeReactFlowType(domainNodeType: string): string {
  const typeMap: Record<string, string> = {
    // Class Diagram nodes
    'CLASS': 'umlClass',
    'INTERFACE': 'umlClass',
    'ABSTRACT_CLASS': 'umlClass',
    'ENUM': 'umlClass',
    'NOTE': 'umlNote',
    
    // Use Case Diagram nodes
    'ACTOR': 'useCaseActor',
    'USE_CASE': 'useCaseElement',
    'SYSTEM_BOUNDARY': 'useCaseBoundary',
  };
  
  return typeMap[domainNodeType] || 'umlClass';
}

/**
 * Maps a domain node to a React Flow view node.
 * 
 * CRITICAL: This function passes the full domain node in the data property
 * so that React components can access all node properties for rendering.
 * 
 * @param domainNode - The domain entity (SSOT)
 * @param position - UI position {x, y}
 * @returns NodeView for React Flow consumption
 */
export function mapDomainNodeToView(
  domainNode: DomainNode,
  position: { x: number; y: number }
): NodeView {
  return {
    // Reference to domain entity
    domainId: domainNode.id,
    
    // React Flow required fields
    id: domainNode.id, // Use same ID for simplicity
    type: getDomainNodeReactFlowType(domainNode.type),
    
    // UI-specific properties
    position: {
      x: position.x,
      y: position.y,
    },
    
    // React Flow data payload (contains full domain node for rendering)
    data: domainNode as any, // Pass full domain node so components can access all properties
  };
}

/**
 * Updates the position of a view node without touching the domain.
 * Useful for drag operations where we only need to update UI state.
 * 
 * @param viewNode - The existing view node
 * @param newPosition - New UI position {x, y}
 * @returns Updated NodeView with new position
 */
export function updateViewPosition(
  viewNode: NodeView,
  newPosition: { x: number; y: number }
): NodeView {
  return {
    ...viewNode,
    position: {
      x: newPosition.x,
      y: newPosition.y,
    },
  };
}

/**
 * Batch maps multiple domain nodes to view nodes.
 * 
 * @param domainNodes - Array of domain nodes
 * @param positionMap - Map of node ID to position {x, y}
 * @returns Array of NodeView for React Flow
 */
export function mapDomainNodesToViews(
  domainNodes: DomainNode[],
  positionMap: Record<string, { x: number; y: number }>
): NodeView[] {
  return domainNodes.map((domainNode) => {
    const position = positionMap[domainNode.id] || { x: 0, y: 0 };
    return mapDomainNodeToView(domainNode, position);
  });
}

/**
 * Extracts position data from view nodes into a position map.
 * Useful for persisting UI state separately from domain state.
 * 
 * @param viewNodes - Array of view nodes
 * @returns Map of node ID to position
 */
export function extractPositionMap(
  viewNodes: NodeView[]
): Record<string, { x: number; y: number }> {
  const positionMap: Record<string, { x: number; y: number }> = {};
  
  viewNodes.forEach((viewNode) => {
    positionMap[viewNode.id] = {
      x: viewNode.position.x,
      y: viewNode.position.y,
    };
  });
  
  return positionMap;
}
