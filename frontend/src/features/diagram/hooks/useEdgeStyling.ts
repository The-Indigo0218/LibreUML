import { useMemo, useState } from "react";
import { edgeConfig } from "../../../config/theme.config";
import { useDiagramStore } from "../../../store/diagramStore";

export const useEdgeStyling = () => {
  const edges = useDiagramStore((s) => s.edges);
  const nodes = useDiagramStore((s) => s.nodes); 
  const showAllEdges = useDiagramStore((s) => s.showAllEdges);
  
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const displayEdges = useMemo(() => {
    const selectedNodeIds = nodes
      .filter(n => n.selected)
      .map(n => n.id);
    
    const hasSelection = selectedNodeIds.length > 0;

    if (!hoveredNodeId && !hoveredEdgeId && !showAllEdges && !hasSelection) return edges;

    return edges.map((edge) => {
      const isConnectedToHoveredNode =
        hoveredNodeId &&
        (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
      
      const isHoveredEdge = hoveredEdgeId && edge.id === hoveredEdgeId;

      const isConnectedToSelectedNode = hasSelection && 
        (selectedNodeIds.includes(edge.source) || selectedNodeIds.includes(edge.target));

      const shouldHighlight = showAllEdges || isConnectedToHoveredNode || isHoveredEdge || isConnectedToSelectedNode;

      if (shouldHighlight) {
        const type = edge.data?.type || "default";
        const configTypes = edgeConfig.types as Record<string, { highlight?: string }>;
        
        let highlightColor = configTypes[type]?.highlight || "var(--edge-base)";
        if (isConnectedToSelectedNode && !showAllEdges) {
            highlightColor = "#06b6d4"; 
        }

        return {
          ...edge,
          animated: false,
          data: { ...edge.data, isHovered: true },
          style: {
            ...edge.style,
            stroke: highlightColor,
            strokeWidth: 3, 
            zIndex: 999,    
            opacity: 1,
            transition: 'all 0.3s ease' ,
          },
        };
      }

      return {
        ...edge,
        style: { ...edge.style, opacity: 0.2, transition: 'all 0.3s ease' },
      };
    });
  }, [edges, nodes, hoveredNodeId, hoveredEdgeId, showAllEdges]); 

  return {
    displayEdges,
    setHoveredNodeId,
    setHoveredEdgeId,
  };
};