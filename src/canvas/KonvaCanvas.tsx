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
import { useDragHandler } from './interactions/useDragHandler';
import {
  isNoteViewModel,
  type NodeViewModel,
} from '../adapters/react-flow/view-models/node.view-model';
import type { NodeBounds } from './edges/geometry';

export default function KonvaCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const showGrid = useSettingsStore((s) => s.showGrid);
  const { stageRef, stageProps, viewport } = useViewport();

  const { nodes, edges } = useVFSCanvasController();

  // ── Bounds map ref ────────────────────────────────────────────────────────
  // useSelection reads this ref at event-handler time, so it always sees the
  // latest drag-adjusted positions even though it is called before boundsMap
  // is computed below.
  const boundsMapRef = useRef<Map<string, NodeBounds>>(new Map());

  // ── Selection ─────────────────────────────────────────────────────────────
  const { selectedIds, lassoRect, onNodeClick, stageHandlers } = useSelection({
    stageRef,
    boundsMapRef,
  });

  // ── Drag handler ──────────────────────────────────────────────────────────
  const { positionOverrides, dragPositions, ghostNodes, dragHandlers } = useDragHandler({
    stageRef,
    selectedIds,
    nodes,
  });

  // ── Bounds map ────────────────────────────────────────────────────────────
  // Priority: dragPositions (live, ~20 fps) > positionOverrides (post-drag) > node.position
  //
  // dragPositions is non-null only during active drags (50 ms debounced updates).
  // This makes edges re-route in real-time while a node is being dragged.
  //
  // The map is also written into `boundsMapRef` every render so the lasso
  // selection in useSelection always uses the most up-to-date positions.
  const boundsMap = useMemo((): Map<string, NodeBounds> => {
    const map = new Map<string, NodeBounds>();
    for (const node of nodes) {
      const pos =
        dragPositions?.get(node.id) ??
        positionOverrides.get(node.id) ??
        node.position;
      const vm = node.data;
      if (isNoteViewModel(vm)) {
        const { width, height } = getNoteShapeSize(vm);
        map.set(node.id, { x: pos.x, y: pos.y, width, height });
      } else {
        const { width, height } = getClassShapeSize(vm as NodeViewModel);
        map.set(node.id, { x: pos.x, y: pos.y, width, height });
      }
    }
    return map;
  }, [nodes, positionOverrides, dragPositions]);

  // Keep ref in sync so lasso always uses the latest positions.
  boundsMapRef.current = boundsMap;

  // ── Container resize ──────────────────────────────────────────────────────
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
              const isSelfLoop = edge.source === edge.target;
              const sourceBounds = boundsMap.get(edge.source);
              const targetBounds = isSelfLoop
                ? sourceBounds                         // same node
                : boundsMap.get(edge.target);
              if (!sourceBounds || !targetBounds) return null;

              // Obstacles = every node except this edge's source and target.
              // Used by the orthogonal router to detour around blocking nodes.
              const obstacles = isSelfLoop
                ? []
                : [...boundsMap.entries()]
                    .filter(([id]) => id !== edge.source && id !== edge.target)
                    .map(([, b]) => b);

              return (
                <KonvaEdge
                  key={edge.id}
                  kind={edge.data.kind}
                  sourceBounds={sourceBounds}
                  targetBounds={targetBounds}
                  isSelfLoop={isSelfLoop}
                  obstacles={obstacles}
                />
              );
            })}
          </Layer>

          {/* ── Nodes layer ──────────────────────────────────────── */}
          <Layer name="nodes">
            {nodes.map((node) => {
              const pos = positionOverrides.get(node.id) ?? node.position;
              const vm = node.data;
              if (isNoteViewModel(vm)) {
                return (
                  <NoteShape
                    key={node.id}
                    viewModel={vm}
                    x={pos.x}
                    y={pos.y}
                    selected={selectedIds.has(node.id)}
                    draggable
                    onDragStart={dragHandlers.onDragStart}
                    onDragMove={dragHandlers.onDragMove}
                    onDragEnd={dragHandlers.onDragEnd}
                    onNodeClick={onNodeClick}
                  />
                );
              }
              return (
                <ClassShape
                  key={node.id}
                  viewModel={vm as NodeViewModel}
                  x={pos.x}
                  y={pos.y}
                  selected={selectedIds.has(node.id)}
                  draggable
                  onDragStart={dragHandlers.onDragStart}
                  onDragMove={dragHandlers.onDragMove}
                  onDragEnd={dragHandlers.onDragEnd}
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

          {/* ── Interaction layer — ghost shapes during drag ──────── */}
          <Layer name="interaction">
            {ghostNodes.map((ghost) => {
              const vm = ghost.data;
              if (isNoteViewModel(vm)) {
                return (
                  <NoteShape
                    key={'ghost-' + ghost.id}
                    viewModel={vm}
                    x={ghost.x}
                    y={ghost.y}
                    opacity={0.3}
                  />
                );
              }
              return (
                <ClassShape
                  key={'ghost-' + ghost.id}
                  viewModel={vm as NodeViewModel}
                  x={ghost.x}
                  y={ghost.y}
                  opacity={0.3}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
