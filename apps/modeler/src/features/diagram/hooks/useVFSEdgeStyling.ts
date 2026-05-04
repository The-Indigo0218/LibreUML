import { useMemo, useState } from 'react';
import type { RelationKind } from '../../../core/domain/vfs/vfs.types';
import type { VFSReactFlowEdge } from './useVFSCanvasController';
import { useSettingsStore } from '../../../store/settingsStore';

const KIND_HIGHLIGHT: Record<string, string> = {
  GENERALIZATION: 'var(--edge-inheritance)',
  REALIZATION:    'var(--edge-implementation)',
  DEPENDENCY:     'var(--edge-dependency)',
  USAGE:          'var(--edge-dependency)',
  ASSOCIATION:    'var(--edge-association)',
  AGGREGATION:    'var(--edge-aggregation)',
  COMPOSITION:    'var(--edge-composition)',
  INCLUDE:        'var(--edge-implementation)',
  EXTEND:         'var(--edge-dependency)',
};

function highlightFor(kind: RelationKind): string {
  return KIND_HIGHLIGHT[kind as string] ?? 'var(--edge-base)';
}

const HIGHLIGHT_STYLE = {
  strokeWidth: 3,
  opacity: 1,
  transition: 'stroke 0.2s ease, stroke-width 0.15s ease, opacity 0.2s ease',
} as const;

const DIM_STYLE = {
  opacity: 0.15,
  transition: 'opacity 0.2s ease',
} as const;

export function useVFSEdgeStyling(edges: VFSReactFlowEdge[], modalEdgeId?: string | null) {
  const showAllEdges = useSettingsStore((s) => s.showAllEdges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Combine hover state with modal editing state
  const effectiveHoveredEdgeId = hoveredEdgeId || modalEdgeId;

  const styledEdges = useMemo((): VFSReactFlowEdge[] => {
    if (showAllEdges) {
      return edges.map((edge) => ({
        ...edge,
        data: { ...edge.data, isHovered: true },
        style: {
          stroke: highlightFor(edge.data.kind),
          ...HIGHLIGHT_STYLE,
        },
      }));
    }

    if (!hoveredNodeId && !effectiveHoveredEdgeId) return edges;

    return edges.map((edge) => {
      const connectedToNode = hoveredNodeId
        ? edge.source === hoveredNodeId || edge.target === hoveredNodeId
        : false;
      const isHoveredEdge = effectiveHoveredEdgeId === edge.id;
      const highlight = connectedToNode || isHoveredEdge;

      if (highlight) {
        return {
          ...edge,
          data: { ...edge.data, isHovered: true },
          style: {
            stroke: highlightFor(edge.data.kind),
            ...HIGHLIGHT_STYLE,
          },
        };
      }

      return {
        ...edge,
        data: { ...edge.data, isHovered: false },
        style: DIM_STYLE,
      };
    });
  }, [edges, hoveredNodeId, effectiveHoveredEdgeId, showAllEdges]);

  return { styledEdges, setHoveredNodeId, setHoveredEdgeId };
}
