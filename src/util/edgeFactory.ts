import { edgeConfig } from "../config/theme.config";
import { MarkerType } from "reactflow";
import type { UmlRelationType } from "../features/diagram/types/diagram.types";
import type { DefaultEdgeOptions } from "reactflow";


const getDefaultLabel = (type: UmlRelationType): string | undefined => {
  switch (type) {
    case "inheritance": return "relationship_labels.inheritance";
    case "implementation": return "relationship_labels.implementation";
    case "composition": return "relationship_labels.composition"; 
    case "aggregation": return "relationship_labels.aggregation"; 
    case "dependency": return "relationship_labels.dependency"; 
    default: return undefined; 
  }
};

export const getEdgeOptions = (type: UmlRelationType): DefaultEdgeOptions => {
  const config = edgeConfig.types[type as keyof typeof edgeConfig.types] || edgeConfig.types.association;
  const strokeColor = config.style.stroke || "var(--edge-base)";

  const baseOptions: DefaultEdgeOptions = {
    ...edgeConfig.base,
    style: { ...edgeConfig.base.style, ...config.style },
    zIndex: config.zIndex,
    label: getDefaultLabel(type), 
    
    data: {
      type: type, 
    }
  };

  switch (type) {
    case "inheritance":
    case "implementation":
    case "aggregation":
    case "composition":
      return {
        ...baseOptions,
        type: "umlEdge",
      };

    case "dependency":
    case "association":
    default:
      return {
        ...baseOptions,
        type: "umlEdge", 
        markerEnd: {
          type: MarkerType.Arrow, 
          width: 20,
          height: 20,
          color: strokeColor,
          strokeWidth: 1.5,
        },
      };
  }
};

export const getNoteEdgeOptions = (): DefaultEdgeOptions => {
  const config = edgeConfig.types.note;
  return {
    ...edgeConfig.base,
    style: { ...edgeConfig.base.style, ...config.style },
    zIndex: config.zIndex,
    type: "umlEdge",
    markerEnd: {
      type: MarkerType.Arrow,
      width: 15,
      height: 15,
      color: "var(--edge-note)",
    },
  };
};