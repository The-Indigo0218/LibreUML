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

  // --- Data Extraction ---
  const edgeType = data?.type || 'association';
  const isHovered = data?.isHovered; 
  
  const sourceMultiplicity = data?.sourceMultiplicity || ""; 
  const targetMultiplicity = data?.targetMultiplicity || "";

  // --- Styling ---
  const strokeColor = style.stroke || 'var(--edge-base)';
  const canvasBase = 'var(--canvas-base)'; 

  const textStyleClass = `
    nodrag nopan 
    text-[11px] font-mono font-medium 
    text-slate-500 dark:text-slate-300 
    bg-canvas-base 
    px-1 rounded 
    select-none 
    transition-colors
  `;

  // --- Marker Rendering & Geometry ---
  const getMarkerRotation = () => {
    switch (targetPosition) {
      case Position.Top: return 90;
      case Position.Left: return 0;
      case Position.Bottom: return   -90;
      case Position.Right: return 180;
      default: return 0;
    }
  };
  const rotation = getMarkerRotation();

  const hasBigMarker = ['inheritance', 'implementation', 'composition', 'aggregation'].includes(edgeType);

  const renderMarker = () => {
    switch (edgeType) {
      case 'inheritance':
      case 'implementation':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            <path d="M -16,-8 L -16,8 L 0,0 Z" fill={canvasBase} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
      case 'aggregation':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            <path d="M 0,0 L -12,6 L -24,0 L -12,-6 Z" fill={canvasBase} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
      case 'composition':
        return (
          <g transform={`translate(${targetX}, ${targetY}) rotate(${rotation})`}>
            <path d="M 0,0 L -12,6 L -24,0 L -12,-6 Z" fill={strokeColor} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
      default: 
        return null; 
    }
  };

  const effectiveMarkerEnd = hasBigMarker ? undefined : markerEnd;

  const getLabelStyle = (x: number, y: number, pos: Position, offset: number) => {
    const style: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
    
    switch (pos) {
      case Position.Top: 
        style.transform = `translate(5px, -100%) translate(${x}px, ${y - offset}px)`;
        break;
      case Position.Bottom: 
        style.transform = `translate(5px, 0%) translate(${x}px, ${y + offset}px)`;
        break;
      case Position.Left: 
        style.transform = `translate(-100%, -100%) translate(${x - offset}px, ${y - 3}px)`; 
        break;
      case Position.Right: 
        style.transform = `translate(0%, -100%) translate(${x + offset}px, ${y - 3}px)`;
        break;
    }
    return style;
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={effectiveMarkerEnd} />
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
             <div className="bg-surface-primary text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-in fade-in zoom-in duration-150 mb-1 select-none">
               {t(`connections.${edgeType}`, { defaultValue: edgeType })}
             </div>
          )}

          {label && (
            <div className={textStyleClass}>
              {t(String(label), { defaultValue: String(label) })}
            </div>
          )}
        </div>

        {sourceMultiplicity && (
          <div
            style={getLabelStyle(sourceX, sourceY, sourcePosition, 10)}
            className={`${textStyleClass} z-10`} 
          >
            {sourceMultiplicity}
          </div>
        )}

        {targetMultiplicity && (
          <div
            style={getLabelStyle(targetX, targetY, targetPosition, hasBigMarker ? 28 : 12)} 
            className={`${textStyleClass} z-10`} 
          >
            {targetMultiplicity}
          </div>
        )}

      </EdgeLabelRenderer>
    </>
  );
}