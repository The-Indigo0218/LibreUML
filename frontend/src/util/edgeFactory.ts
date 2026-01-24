import { edgeConfig } from "../config/theme.config";
import { MarkerType } from "reactflow";
import type { UmlRelationType } from "../features/diagram/types/diagram.types";
import type { DefaultEdgeOptions } from "reactflow";

export const getEdgeOptions = (type: UmlRelationType): DefaultEdgeOptions => {
  const config = edgeConfig.types[type as keyof typeof edgeConfig.types] || edgeConfig.types.association;

  // Configuración base para todos los edges
  const baseOptions: DefaultEdgeOptions = {
    ...edgeConfig.base,
    style: { ...edgeConfig.base.style, ...config.style },
    zIndex: config.zIndex,
  };

  // Para los edges UML custom (inheritance, implementation, aggregation, composition)
  // usamos nuestro CustomUmlEdge que dibuja los markers directamente
  switch (type) {
    case "inheritance":
    case "implementation":
    case "aggregation":
    case "composition":
      return {
        ...baseOptions,
        type: "umlEdge", // Usa el edge custom
      };

    case "dependency":
    case "association":
    default:
      // Para estos usamos el edge por defecto con marker nativo
      return {
        ...baseOptions,
        type: "umlEdge", // También usa custom para consistencia
        markerEnd: {
          type: MarkerType.Arrow,
          ...config.marker,
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
    type: "umlEdge", // Usa custom edge
    markerEnd: {
      type: MarkerType.Arrow,
      ...config.marker,
    },
  };
};