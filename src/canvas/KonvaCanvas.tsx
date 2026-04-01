import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import GridPattern from './engine/GridPattern';
import { useViewport } from './engine/useViewport';
import { useSettingsStore } from '../store/settingsStore';
import { useKonvaCanvasController } from './hooks/useKonvaCanvasController';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import KonvaEdge from './edges/KonvaEdge';
import SelectionRect from './selection/SelectionRect';
import { useSelection } from './interactions/useSelection';
import { useDragHandler } from './interactions/useDragHandler';
import type { CanvasNode } from './interactions/useDragHandler';
import { useConnectionDraw } from './interactions/useConnectionDraw';
import { useCanvasKeyboard } from './interactions/useCanvasKeyboard';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { KonvaNodeChange, KonvaEdgeChange } from './types/canvas.types';
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

  const {
    shapes,
    edges,
    activeTabId,
    onNodeChange,
    onEdgeChange,
    onConnect,
  } = useKonvaCanvasController();

  // ── Adapt shapes → CanvasNode[] for hooks that need position objects ────────
  // useDragHandler and the boundsMap computation use CanvasNode (position.x/y).
  // ShapeDescriptor uses flat x/y, so we adapt once per render cycle.
  const canvasNodes = useMemo((): CanvasNode[] =>
    shapes.map((s) => ({ id: s.id, position: { x: s.x, y: s.y }, data: s.data })),
    [shapes],
  );

  // ── Bounds map ref ────────────────────────────────────────────────────────
  // useSelection reads this ref at event-handler time, so it always sees the
  // latest drag-adjusted positions even though it is called before boundsMap
  // is computed below.
  const boundsMapRef = useRef<Map<string, NodeBounds>>(new Map());

  // ── Selection ─────────────────────────────────────────────────────────────
  const { selectedIds, lassoRect, onNodeClick, selectAll, stageHandlers } = useSelection({
    stageRef,
    boundsMapRef,
  });

  // ── onDragComplete → persist positions to VFSStore ────────────────────────
  const handleDragComplete = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      const changes = Array.from(positions.entries()).map(
        ([id, position]): KonvaNodeChange => ({ type: 'position', id, position }),
      );
      onNodeChange(changes);
    },
    [onNodeChange],
  );

  // ── Drag handler ──────────────────────────────────────────────────────────
  const { positionOverrides, dragPositions, ghostNodes, dragHandlers } = useDragHandler({
    stageRef,
    selectedIds,
    nodes: canvasNodes,
    onDragComplete: handleDragComplete,
  });

  // ── onConnect bridge ──────────────────────────────────────────────────────
  // useConnectionDraw uses plain (sourceNodeId, targetNodeId) to stay RF-free.
  // We bridge it here to the KonvaConnection-typed onConnect.
  const handleConnectionCreated = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      onConnect({
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: null,
        targetHandle: null,
      });
    },
    [onConnect],
  );

  // ── Connection draw ───────────────────────────────────────────────────────
  const connectionDraw = useConnectionDraw({
    stageRef,
    boundsMapRef,
    nodes: shapes,        // ShapeDescriptor satisfies ConnectionNode (id + data)
    activeTabId,
    onConnect: handleConnectionCreated,
  });

  // ── Bounds map ────────────────────────────────────────────────────────────
  // Priority: dragPositions (live, ~20 fps) > positionOverrides (post-drag) > shape position
  //
  // dragPositions is non-null only during active drags (50 ms debounced updates).
  // This makes edges re-route in real-time while a node is being dragged.
  //
  // The map is also written into `boundsMapRef` every render so the lasso
  // selection in useSelection always uses the most up-to-date positions.
  const boundsMap = useMemo((): Map<string, NodeBounds> => {
    const map = new Map<string, NodeBounds>();
    for (const shape of shapes) {
      const pos =
        dragPositions?.get(shape.id) ??
        positionOverrides.get(shape.id) ??
        { x: shape.x, y: shape.y };
      const vm = shape.data;
      if (isNoteViewModel(vm)) {
        const { width, height } = getNoteShapeSize(vm);
        map.set(shape.id, { x: pos.x, y: pos.y, width, height });
      } else {
        const { width, height } = getClassShapeSize(vm as NodeViewModel);
        map.set(shape.id, { x: pos.x, y: pos.y, width, height });
      }
    }
    return map;
  }, [shapes, positionOverrides, dragPositions]);

  // Keep ref in sync so lasso and connection draw always use the latest positions.
  boundsMapRef.current = boundsMap;

  // ── Guarded drag start ────────────────────────────────────────────────────
  // When nearAnchorRef.current is true, the user is near an anchor and wants to
  // draw a connection — NOT drag the node. stopDrag() cancels Konva's native drag
  // before it starts, allowing useConnectionDraw to handle the interaction.
  const guardedDragStart = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (connectionDraw.nearAnchorRef.current) {
        e.target.stopDrag();
        return;
      }
      dragHandlers.onDragStart(e);
    },
    [dragHandlers.onDragStart, connectionDraw.nearAnchorRef],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Delete: removes selected nodes (view-only) and edges (model cascade)
  // Ctrl+A: selects all nodes on the diagram
  // Escape: handled by useSelection (clears selection)

  const handleDeleteNodes = useCallback(
    (nodeIds: string[]) => {
      onNodeChange(nodeIds.map((id): KonvaNodeChange => ({ type: 'remove', id })));
    },
    [onNodeChange],
  );

  const handleDeleteEdges = useCallback(
    (edgeIds: string[]) => {
      onEdgeChange(edgeIds.map((id): KonvaEdgeChange => ({ type: 'remove', id })));
    },
    [onEdgeChange],
  );

  const allNodeIds = useMemo(() => shapes.map((s) => s.id), [shapes]);

  useCanvasKeyboard({
    allNodeIds,
    onDeleteNodes: handleDeleteNodes,
    onDeleteEdges: handleDeleteEdges,
    onSelectAll: selectAll,
  });

  // ── Merged stage event handlers ────────────────────────────────────────────
  // Connection draw has priority over lasso selection:
  //   onMouseDown: if near anchor → start connection draw (skip lasso)
  //   onMouseMove: if connecting → update temp line (skip lasso update)
  //   onMouseUp: always run both — each handler guards its own state

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      connectionDraw.stageHandlers.onMouseDown(e);
      // Only let lasso start if we did NOT just enter connection-draw mode.
      if (!connectionDraw.isConnectingRef.current) {
        stageHandlers.onMouseDown(e);
      }
    },
    [connectionDraw.stageHandlers, connectionDraw.isConnectingRef, stageHandlers],
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      connectionDraw.stageHandlers.onMouseMove(e);
      if (!connectionDraw.isConnectingRef.current) {
        stageHandlers.onMouseMove(e);
      }
    },
    [connectionDraw.stageHandlers, connectionDraw.isConnectingRef, stageHandlers],
  );

  const handleStageMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Both handlers guard on their own state (isConnecting / isLassoing).
      connectionDraw.stageHandlers.onMouseUp(e);
      stageHandlers.onMouseUp(e);
    },
    [connectionDraw.stageHandlers, stageHandlers],
  );

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
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
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
              const isSelfLoop = edge.sourceId === edge.targetId;
              const sourceBounds = boundsMap.get(edge.sourceId);
              const targetBounds = isSelfLoop
                ? sourceBounds                         // same node
                : boundsMap.get(edge.targetId);
              if (!sourceBounds || !targetBounds) return null;

              // Obstacles = every node except this edge's source and target.
              const obstacles = isSelfLoop
                ? []
                : [...boundsMap.entries()]
                    .filter(([id]) => id !== edge.sourceId && id !== edge.targetId)
                    .map(([, b]) => b);

              return (
                <KonvaEdge
                  key={edge.id}
                  kind={edge.kind}
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
            {shapes.map((shape) => {
              const pos = positionOverrides.get(shape.id) ?? { x: shape.x, y: shape.y };
              const vm = shape.data;
              if (isNoteViewModel(vm)) {
                return (
                  <NoteShape
                    key={shape.id}
                    viewModel={vm}
                    x={pos.x}
                    y={pos.y}
                    selected={selectedIds.has(shape.id)}
                    draggable
                    onDragStart={guardedDragStart}
                    onDragMove={dragHandlers.onDragMove}
                    onDragEnd={dragHandlers.onDragEnd}
                    onNodeClick={onNodeClick}
                  />
                );
              }
              return (
                <ClassShape
                  key={shape.id}
                  viewModel={vm as NodeViewModel}
                  x={pos.x}
                  y={pos.y}
                  selected={selectedIds.has(shape.id)}
                  draggable
                  onDragStart={guardedDragStart}
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

          {/* ── Interaction layer — ghost shapes + connection draw ── */}
          <Layer name="interaction">
            {/* Ghost shapes rendered at drag-start position (opacity 0.3) */}
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

            {/* Anchor dots: shown for hovered node when not connecting */}
            {!connectionDraw.isConnecting &&
              connectionDraw.hoveredNodeAnchors.map((dot, i) => (
                <Circle
                  key={`anchor-${dot.nodeId}-${i}`}
                  x={dot.x}
                  y={dot.y}
                  radius={4}
                  fill="#22d3ee"
                  stroke="#0891b2"
                  strokeWidth={1.5}
                  opacity={0.85}
                  listening={false}
                />
              ))}

            {/* Snap target highlight: green circle on target anchor */}
            {connectionDraw.isConnecting && connectionDraw.snapTargetDot && (
              <Circle
                x={connectionDraw.snapTargetDot.x}
                y={connectionDraw.snapTargetDot.y}
                radius={7}
                fill="#10b981"
                stroke="#047857"
                strokeWidth={2}
                opacity={0.9}
                listening={false}
              />
            )}

            {/* Temporary connection line: dashed cyan line source → cursor */}
            {connectionDraw.tempLine && (
              <Line
                points={[
                  connectionDraw.tempLine.x1,
                  connectionDraw.tempLine.y1,
                  connectionDraw.tempLine.x2,
                  connectionDraw.tempLine.y2,
                ]}
                stroke="#22d3ee"
                strokeWidth={2}
                dash={[8, 5]}
                lineCap="round"
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
