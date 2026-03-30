import { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import GridPattern from './engine/GridPattern';
import { useViewport } from './engine/useViewport';
import { useSettingsStore } from '../store/settingsStore';
import { useVFSCanvasController } from '../features/diagram/hooks/useVFSCanvasController';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import KonvaEdge from './edges/KonvaEdge';
import SelectionRect from './selection/SelectionRect';
import { useSelection } from './interactions/useSelection';
import { isNoteViewModel, type NodeViewModel, type NoteViewModel } from '../adapters/react-flow/view-models/node.view-model';
import type { NodeBounds } from './edges/geometry';

export default function KonvaCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const showGrid = useSettingsStore((s) => s.showGrid);
  const { stageRef, stageProps, viewport } = useViewport();

  const { nodes, edges } = useVFSCanvasController();

  // Build id → NodeBounds map so KonvaEdge can route between shapes
  // and useSelection can test lasso intersection in world space.
  const boundsMap = useMemo((): Map<string, NodeBounds> => {
    const map = new Map<string, NodeBounds>();
    for (const node of nodes) {
      const { x, y } = node.position;
      const vm = node.data;
      if (isNoteViewModel(vm)) {
        const { width, height } = getNoteShapeSize(vm);
        map.set(node.id, { x, y, width, height });
      } else {
        const { width, height } = getClassShapeSize(vm as NodeViewModel);
        map.set(node.id, { x, y, width, height });
      }
    }
    return map;
  }, [nodes]);

  const { selectedIds, lassoRect, onNodeClick, stageHandlers } = useSelection({
    stageRef,
    boundsMap,
  });

  // Track container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    ro.observe(container);
    setSize({ width: container.clientWidth, height: container.clientHeight });

    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-canvas-base">
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          {...stageProps}
          onMouseDown={stageHandlers.onMouseDown}
          onMouseMove={stageHandlers.onMouseMove}
          onMouseUp={stageHandlers.onMouseUp}
          onClick={stageHandlers.onClick}
        >
          {/* ── Background layer — grid ───────────────────────────── */}
          <Layer>
            {showGrid && (
              <GridPattern
                viewport={viewport}
                stageWidth={size.width}
                stageHeight={size.height}
              />
            )}
          </Layer>

          {/* ── Edges layer ──────────────────────────────────────── */}
          <Layer name="edges">
            {edges.map((edge) => {
              const sourceBounds = boundsMap.get(edge.source);
              const targetBounds = boundsMap.get(edge.target);
              if (!sourceBounds || !targetBounds) return null;
              return (
                <KonvaEdge
                  key={edge.id}
                  kind={edge.data.kind}
                  sourceBounds={sourceBounds}
                  targetBounds={targetBounds}
                />
              );
            })}
          </Layer>

          {/* ── Nodes layer ──────────────────────────────────────── */}
          <Layer name="nodes">
            {nodes.map((node) => {
              const { x, y } = node.position;
              const vm = node.data;
              if (isNoteViewModel(vm)) {
                return (
                  <NoteShape
                    key={node.id}
                    viewModel={vm}
                    x={x}
                    y={y}
                    selected={selectedIds.has(node.id)}
                    onNodeClick={onNodeClick}
                  />
                );
              }
              return (
                <ClassShape
                  key={node.id}
                  viewModel={vm as NodeViewModel}
                  x={x}
                  y={y}
                  selected={selectedIds.has(node.id)}
                  onNodeClick={onNodeClick}
                />
              );
            })}
          </Layer>

          {/* ── Selection layer — lasso rect ─────────────────────── */}
          <Layer name="selection">
            {lassoRect && (
              <SelectionRect
                x={lassoRect.x}
                y={lassoRect.y}
                width={lassoRect.width}
                height={lassoRect.height}
              />
            )}
          </Layer>

          {/* ── Interaction layer ────────────────────────────────── */}
          <Layer name="interaction" />
        </Stage>
      )}
    </div>
  );
}
