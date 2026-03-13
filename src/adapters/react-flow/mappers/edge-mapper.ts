import type { DomainEdge } from '../../../core/domain/models/edges';
import type { EdgeView } from '../view-models/edge-view.types';
import { MarkerType } from 'reactflow';

/**
 * Edge styling configuration based on domain edge type.
 * Maps domain edge types to React Flow visual properties.
 */
interface EdgeStyleConfig {
  type: string; // React Flow edge type
  style: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
  animated?: boolean;
  markerEnd?: {
    type: string;
    width?: number;
    height?: number;
    color?: string;
  } | string;
}

/**
 * Gets the React Flow styling configuration for a domain edge type.
 */
function getEdgeStyleConfig(domainEdgeType: string): EdgeStyleConfig {
  const baseColor = 'var(--edge-base, #64748b)';
  
  const configs: Record<string, EdgeStyleConfig> = {
    // === Class Diagram Edges ===
    'ASSOCIATION': {
      type: 'umlEdge',
      style: {
        stroke: baseColor,
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 20,
        height: 20,
        color: baseColor,
      },
    },
    
    'INHERITANCE': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-inheritance, #10b981)',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 24,
        height: 24,
        color: 'var(--edge-inheritance, #10b981)',
      },
    },
    
    'IMPLEMENTATION': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-implementation, #3b82f6)',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 24,
        height: 24,
        color: 'var(--edge-implementation, #3b82f6)',
      },
    },
    
    'DEPENDENCY': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-dependency, #f59e0b)',
        strokeWidth: 1.5,
        strokeDasharray: '5,5',
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 18,
        height: 18,
        color: 'var(--edge-dependency, #f59e0b)',
      },
    },
    
    'AGGREGATION': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-aggregation, #8b5cf6)',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 20,
        height: 20,
        color: 'var(--edge-aggregation, #8b5cf6)',
      },
    },
    
    'COMPOSITION': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-composition, #ec4899)',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 20,
        height: 20,
        color: 'var(--edge-composition, #ec4899)',
      },
    },
    
    'NOTE_LINK': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-note, #94a3b8)',
        strokeWidth: 1,
        strokeDasharray: '2,2',
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 15,
        height: 15,
        color: 'var(--edge-note, #94a3b8)',
      },
    },
    
    // === Use Case Diagram Edges ===
    'INCLUDE': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-include, #06b6d4)',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 20,
        height: 20,
        color: 'var(--edge-include, #06b6d4)',
      },
    },
    
    'EXTEND': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-extend, #f97316)',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 20,
        height: 20,
        color: 'var(--edge-extend, #f97316)',
      },
    },
    
    'GENERALIZATION': {
      type: 'umlEdge',
      style: {
        stroke: 'var(--edge-generalization, #10b981)',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        width: 24,
        height: 24,
        color: 'var(--edge-generalization, #10b981)',
      },
    },
  };
  
  // Default fallback
  return configs[domainEdgeType] || configs['ASSOCIATION'];
}

/**
 * Maps a domain edge to a React Flow view edge.
 * 
 * CRITICAL: This function does NOT duplicate domain data.
 * It only creates a lightweight UI wrapper with styling and rendering metadata.
 * 
 * @param domainEdge - The domain entity (SSOT)
 * @returns EdgeView for React Flow consumption
 */
export function mapDomainEdgeToView(domainEdge: DomainEdge): EdgeView {
  const styleConfig = getEdgeStyleConfig(domainEdge.type);
  
  return {
    // Reference to domain entity
    domainId: domainEdge.id,
    
    // React Flow required fields
    id: domainEdge.id, // Use same ID for simplicity
    source: domainEdge.sourceNodeId,
    target: domainEdge.targetNodeId,
    type: styleConfig.type,
    
    // UI-specific styling
    style: styleConfig.style,
    animated: styleConfig.animated,
    markerEnd: styleConfig.markerEnd,
    
    // React Flow data payload (contains domain reference)
    data: {
      domainId: domainEdge.id,
      isHovered: false,
    },
  };
}

/**
 * Updates the hover state of a view edge without touching the domain.
 * Useful for interactive highlighting.
 * 
 * @param viewEdge - The existing view edge
 * @param isHovered - New hover state
 * @returns Updated EdgeView with new hover state
 */
export function updateEdgeHoverState(
  viewEdge: EdgeView,
  isHovered: boolean
): EdgeView {
  return {
    ...viewEdge,
    data: {
      domainId: viewEdge.data?.domainId || viewEdge.domainId,
      isHovered,
    },
  };
}

/**
 * Updates the selection state of a view edge.
 * 
 * @param viewEdge - The existing view edge
 * @param isSelected - New selection state
 * @returns Updated EdgeView with new selection state
 */
export function updateEdgeSelectionState(
  viewEdge: EdgeView,
  isSelected: boolean
): EdgeView {
  return {
    ...viewEdge,
    selected: isSelected,
  };
}

/**
 * Batch maps multiple domain edges to view edges.
 * 
 * @param domainEdges - Array of domain edges
 * @returns Array of EdgeView for React Flow
 */
export function mapDomainEdgesToViews(domainEdges: DomainEdge[]): EdgeView[] {
  return domainEdges.map(mapDomainEdgeToView);
}

/**
 * Updates edge handles (connection points) for a view edge.
 * Useful when recalculating optimal connection points after node movement.
 * 
 * @param viewEdge - The existing view edge
 * @param sourceHandle - New source handle ID
 * @param targetHandle - New target handle ID
 * @returns Updated EdgeView with new handles
 */
export function updateEdgeHandles(
  viewEdge: EdgeView,
  sourceHandle: string | null,
  targetHandle: string | null
): EdgeView {
  return {
    ...viewEdge,
    sourceHandle,
    targetHandle,
  };
}
