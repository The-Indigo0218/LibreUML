import { edgeConfig } from "../config/theme.config";
import { MarkerType } from "reactflow";
import type { UmlRelationType } from "../types/diagram.types";
import type { DefaultEdgeOptions } from "reactflow";

export const getEdgeOptions = (type: UmlRelationType): DefaultEdgeOptions => {
  const config = edgeConfig.types[type] || edgeConfig.types.association;

  return {
    ...edgeConfig.base,
    style: { ...edgeConfig.base.style, ...config.style },
    zIndex: config.zIndex,
    markerEnd: {
      type:
        type === "inheritance" || type === "implementation"
          ? MarkerType.ArrowClosed
          : MarkerType.Arrow,
      ...config.marker,
    },
  };
};

export const getNoteEdgeOptions = (): DefaultEdgeOptions => {
  const config = edgeConfig.types.note;
  return {
    ...edgeConfig.base,
    style: { ...edgeConfig.base.style, ...config.style },
    zIndex: config.zIndex,
    markerEnd: {
      type: MarkerType.Arrow,
      ...config.marker,
    },
  };
};