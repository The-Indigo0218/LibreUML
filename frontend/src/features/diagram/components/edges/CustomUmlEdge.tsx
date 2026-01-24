import { BaseEdge, getSmoothStepPath, Position, EdgeLabelRenderer } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { useTranslation } from 'react-i18next';

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
  label,
}: EdgeProps) {
  
  const { t } = useTranslation();
  
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  const edgeType = data?.type || 'association';
  const isHovered = data?.isHovered; 

  const strokeColor = style.stroke || 'var(--edge-base)';
  const canvasBase = 'var(--canvas-base)'; 

  const getMarkerRotation = () => {
    switch (targetPosition) {
      case Position.Top: return 90;
      case Position.Left: return 0;
      case Position.Bottom: return -90;
      case Position.Right: return 180;
      default: return 0;
    }
  };
  const rotation = getMarkerRotation();

  // --- Marker Rendering ---
  const renderMarker = () => {
    switch (edgeType) {
      case 'inheritance':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            <path 
              d="M -16,-8 L -16,8 L 0,0 Z" 
              fill={canvasBase} 
              stroke={strokeColor} 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />
          </g>
        );
      case 'implementation':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            <path 
              d="M -16,-8 L -16,8 L 0,0 Z" 
              fill={canvasBase} 
              stroke={strokeColor} 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />
          </g>
        );
      default: 
        return null; 
    }
  };

  const hasCustomMarker = ['inheritance', 'implementation', 'composition', 'aggregation'].includes(edgeType);
  const effectiveMarkerEnd = hasCustomMarker ? undefined : markerEnd;

  // --- Render ---
  return (
    <>
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={style} 
        markerEnd={effectiveMarkerEnd} 
      />

      {renderMarker()}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 5}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex flex-col items-center gap-1"
        >
          {isHovered && (
             <div className="
                bg-surface-primary text-primary border border-primary/30 
                text-[10px] font-bold px-2 py-0.5 rounded shadow-lg 
                animate-in fade-in zoom-in duration-150 mb-1 select-none
             ">
               {t(`connections.${edgeType}`, { defaultValue: edgeType })}
             </div>
          )}

          {label && (
            <div className={`
              text-[11px] font-mono font-medium px-1.5 py-0.5 rounded transition-colors duration-200
              ${isHovered ? 'text-primary font-bold' : 'text-text-secondary'}
              bg-canvas-base/80 select-none
            `}>
              {t(String(label), { defaultValue: String(label) })}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}