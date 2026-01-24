import { BaseEdge, getSmoothStepPath, Position } from 'reactflow';
import type { EdgeProps } from 'reactflow';

/**
 * Edge personalizado que dibuja los marcadores UML directamente
 * Los markers siguen la dirección real del path usando targetPosition
 */
export default function CustomUmlEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  const edgeType = data?.type || 'association';

  // Para diagnosticar
  const positionNames = {
    [Position.Top]: 'Top',
    [Position.Bottom]: 'Bottom',
    [Position.Left]: 'Left',
    [Position.Right]: 'Right',
  };
  
  console.log('Edge coords:', { 
    targetX, 
    targetY, 
    targetPosition: positionNames[targetPosition] || 'undefined',
    edgeType 
  });

  // Mapear targetPosition a ángulo de rotación correcto
  // El triángulo debe apuntar HACIA DENTRO del nodo
  const getMarkerRotation = () => {
    switch (targetPosition) {
      case Position.Top:
        return 90; // Entra por arriba → apunta hacia abajo
      case Position.Left:
        return 0; // Entra por izquierda → apunta hacia la derecha
      case Position.Bottom:
        return -90; // Entra por abajo → apunta hacia arriba
      case Position.Right:
        return 180; // Entra por derecha → apunta hacia la izquierda
      default:
        return 0;
    }
  };

  const rotation = getMarkerRotation();

  // Colores desde CSS
  const canvasBase = 'var(--canvas-base)';
  const edgeInheritance = 'var(--edge-inheritance)';
  const edgeImplementation = 'var(--edge-implementation)';
  const edgeAssociation = 'var(--edge-association)';

  // Renderizar el marker correcto
  const renderMarker = () => {
    switch (edgeType) {
      case 'inheritance':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            {/* Triángulo hueco - punta en (0,0) para que coincida exactamente con la línea */}
            <path
              d="M -15,-5 L -15,5 L 0,0 Z"
              fill={canvasBase}
              stroke={edgeInheritance}
              strokeWidth="2.5"
              strokeLinejoin="miter"
            />
          </g>
        );

      case 'implementation':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            {/* Triángulo hueco */}
            <path
              d="M -15,-5 L -15,5 L 0,0 Z"
              fill={canvasBase}
              stroke={edgeImplementation}
              strokeWidth="2.5"
              strokeLinejoin="miter"
            />
          </g>
        );

      case 'aggregation':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            {/* Rombo hueco - centrado en la línea */}
            <path
              d="M -18,0 L -9,-6 L 0,0 L -9,6 Z"
              fill={canvasBase}
              stroke={edgeAssociation}
              strokeWidth="2.5"
              strokeLinejoin="miter"
            />
          </g>
        );

      case 'composition':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            {/* Rombo relleno - centrado en la línea */}
            <path
              d="M -18,0 L -9,-6 L 0,0 L -9,6 Z"
              fill={edgeAssociation}
              stroke={edgeAssociation}
              strokeWidth="2.5"
              strokeLinejoin="miter"
            />
          </g>
        );

      default:
        // Para dependency, association y note usamos el marker por defecto
        return null;
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {renderMarker()}
    </>
  );
}