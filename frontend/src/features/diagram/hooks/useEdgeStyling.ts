import { useMemo, useState } from "react";
import { edgeConfig } from "../../../config/theme.config";
import { useDiagramStore } from "../../../store/diagramStore";

export const useEdgeStyling = () => {
  const edges = useDiagramStore((s) => s.edges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const displayEdges = useMemo(() => {
    if (!hoveredNodeId && !hoveredEdgeId) return edges;

    return edges.map((edge) => {
      const isConnectedToNode =
        hoveredNodeId &&
        (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
      const isHoveredEdge = hoveredEdgeId && edge.id === hoveredEdgeId;

      if (isConnectedToNode || isHoveredEdge) {
        const type = edge.data?.type || "default";
        const configTypes = edgeConfig.types as Record<string, { highlight?: string }>;
        
        const highlightColor = configTypes[type]?.highlight || "var(--edge-base)";

        return {
          ...edge,
          animated: false,
          
          data: {
            ...edge.data,
            isHovered: isHoveredEdge, 
          },

          style: {
            ...edge.style,
            stroke: highlightColor,
            strokeWidth: 3, 
            zIndex: 999,    
          },
        };
      }

      return {
        ...edge,
        style: { ...edge.style, opacity: 0.2 },
      };
    });
  }, [edges, hoveredNodeId, hoveredEdgeId]);

  return {
    displayEdges,
    setHoveredNodeId,
    setHoveredEdgeId,
  };
};