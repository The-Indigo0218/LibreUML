import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import GridPattern from './engine/GridPattern';
import { useViewport } from './engine/useViewport';
import { useViewportCuller } from './engine/useViewportCuller';
import { usePerformanceMonitor } from './engine/usePerformanceMonitor';
import { useSpacePan } from './hooks/useSpacePan';
import { useRightClickPan } from './hooks/useRightClickPan';
import { useSettingsStore } from '../store/settingsStore';
import { useKonvaCanvasController } from './hooks/useKonvaCanvasController';
import { useKonvaDnD } from './hooks/useKonvaDnD';
import ClassShape, { getClassShapeSize } from './shapes/ClassShape';
import NoteShape, { getNoteShapeSize } from './shapes/NoteShape';
import KonvaEdge from './edges/KonvaEdge';
import SelectionRect from './selection/SelectionRect';
import { useSelection } from './interactions/useSelection';
import { useDragHandler } from './interactions/useDragHandler';
import type { CanvasNode } from './interactions/useDragHandler';
import { useConnectionDraw } from './interactions/useConnectionDraw';
import { useCanvasKeyboard } from './interactions/useCanvasKeyboard';
import CanvasOverlay from './CanvasOverlay';
import DuplicateFileModal from '../components/shared/DuplicateFileModal';
import { useInlineEditorStore } from './store/inlineEditorStore';
import { useContextMenu } from '../features/diagram/hooks/useContextMenu';
import { useDiagramMenus } from '../features/diagram/hooks/useDiagramMenus';
import { useVFSCanvasController } from '../features/diagram/hooks/useVFSCanvasController';
import { useUiStore } from '../store/uiStore';
import { useModelStore } from '../store/model.store';
import { useToastStore } from '../store/toast.store';
import { useStageStore } from './store/stageStore';
import type { KonvaNodeChange, KonvaEdgeChange } from './types/canvas.types';
import {
  isNoteViewModel,
  type NodeViewModel,
} from '../adapters/react-flow/view-models/node.view-model';
import type { NodeBounds } from './edges/geometry';
import type { RelationKind } from '../core/domain/vfs/vfs.types';

const VFS_TYPE_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION: 'ASSOCIATION',
  INHERITANCE: 'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY: 'DEPENDENCY',
  AGGREGATION: 'AGGREGATION',
  COMPOSITION: 'COMPOSITION',
};

export default function KonvaCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const showGrid = useSettingsStore((s) => s.showGrid);
  const highlightConnections = useSettingsStore((s) => s.showAllEdges);

  const isDev = import.meta.env.DEV;
  usePerformanceMonitor(isDev);

  const setStage = useStageStore((s) => s.setStage);
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      setStage(stage);
      return () => setStage(null);
    }
  });

  const vfsController = useVFSCanvasController();

  const {
    shapes,
    edges,
    activeTabId,
    onNodeChange,
    onEdgeChange,
    onConnect,
  } = useKonvaCanvasController();

  const contentBounds = useMemo(() => {
    if (shapes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of shapes) {
      const vm = shape.data;
      let width: number;
      let height: number;

      if (isNoteViewModel(vm)) {
        const size = getNoteShapeSize(vm);
        width = size.width;
        height = size.height;
      } else {
        const size = getClassShapeSize(vm as NodeViewModel);
        width = size.width;
        height = size.height;
      }

      minX = Math.min(minX, shape.x);
      minY = Math.min(minY, shape.y);
      maxX = Math.max(maxX, shape.x + width);
      maxY = Math.max(maxY, shape.y + height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [shapes]);

  const { stageRef, viewport, onWheel, commitPanPosition } = useViewport({
    contentBounds,
    stageWidth: size.width,
    stageHeight: size.height,
  });

  const { isSpacePressed, isSpacePressedRef } = useSpacePan({ enabled: true });

  const rightClickPan = useRightClickPan({
    stageRef,
    enabled: true,
    isSpacePressedRef,
    onPanEnd: commitPanPosition,
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.x(viewport.x);
      stage.y(viewport.y);
      stage.scaleX(viewport.scale);
      stage.scaleY(viewport.scale);
      stage.batchDraw();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageRef.current]);

  const canvasNodes = useMemo((): CanvasNode[] =>
    shapes.map((s) => ({ id: s.id, position: { x: s.x, y: s.y }, data: s.data })),
    [shapes],
  );

  const boundsMapRef = useRef<Map<string, NodeBounds>>(new Map());

  const { selectedIds, lassoRect, onNodeClick, selectAll, stageHandlers } = useSelection({
    stageRef,
    boundsMapRef,
    isSpacePressed,
  });

  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const highlightedEdgeIds = useMemo((): Set<string> => {
    if (!highlightConnections) return new Set();
    return new Set(edges.map((e) => e.id));
  }, [highlightConnections, edges]);

  const dimmedEdgeIds = useMemo((): Set<string> => {
    if (!hoveredEdgeId) return new Set();
    return new Set(edges.filter((e) => e.id !== hoveredEdgeId).map((e) => e.id));
  }, [hoveredEdgeId, edges]);

  const handleDragComplete = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      const changes = Array.from(positions.entries()).map(
        ([id, position]): KonvaNodeChange => ({ type: 'position', id, position }),
      );
      onNodeChange(changes);
    },
    [onNodeChange],
  );

  const { positionOverrides, dragPositions, ghostNodes, dragHandlers } = useDragHandler({
    stageRef,
    selectedIds,
    nodes: canvasNodes,
    onDragComplete: handleDragComplete,
  });

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

  const connectionDraw = useConnectionDraw({
    stageRef,
    boundsMapRef,
    nodes: shapes,
    activeTabId,
    onConnect: handleConnectionCreated,
  });

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

  boundsMapRef.current = boundsMap;


  const visibleNodeIds = useViewportCuller(viewport, size.width, size.height, boundsMap);

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

  const { onDragOver: handleDragOver, onDrop: handleDrop, duplicateModal } = useKonvaDnD({ stageRef });

  const startInlineEditing = useInlineEditorStore((s) => s.startEditing);
  const updateEditorPosition = useInlineEditorStore((s) => s.updatePosition);
  const isEditing = useInlineEditorStore((s) => s.isEditing);
  const activeNodeId = useInlineEditorStore((s) => s.activeNodeId);

  useEffect(() => {
    if (!isEditing || !activeNodeId) return;

    const shape = shapes.find((s) => s.id === activeNodeId);
    if (!shape) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = positionOverrides.get(shape.id) ?? { x: shape.x, y: shape.y };
    const transform = stage.getAbsoluteTransform().copy();

    if (isNoteViewModel(shape.data)) {
      const NOTE_H_PAD = 8;
      const NOTE_V_PAD = 8;
      const titleY = NOTE_V_PAD / 2 + 2;
      const screenPos = transform.point({ x: pos.x + NOTE_H_PAD, y: pos.y + titleY });
      updateEditorPosition({ x: screenPos.x, y: screenPos.y });
    } else {
      const H_PAD = 10;
      const layout = getClassShapeSize(shape.data as NodeViewModel);
      const nameY = layout.height * 0.15;
      const screenPos = transform.point({ x: pos.x + H_PAD, y: pos.y + nameY });
      updateEditorPosition({ x: screenPos.x, y: screenPos.y });
    }
  }, [viewport, isEditing, activeNodeId, shapes, positionOverrides, stageRef, updateEditorPosition]);

  const handleClassDblClick = useCallback(
    (shapeId: string, e: KonvaEventObject<MouseEvent>) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape || isNoteViewModel(shape.data)) return;

      const vm = shape.data as NodeViewModel;
      const stage = stageRef.current;
      if (!stage) return;

      const groupNode = e.target.findAncestor('Group');
      if (!groupNode) return;

      const H_PAD = 10;
      const NAME_H = 22;
      
      const groupPos = groupNode.getAbsolutePosition();
      const layout = getClassShapeSize(vm);
      const nameY = layout.height * 0.15;
      
      const transform = stage.getAbsoluteTransform().copy();
      const screenPos = transform.point({ x: groupPos.x + H_PAD, y: groupPos.y + nameY });
      
      const nameText = vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label;
      const textWidth = Math.min(layout.width - 2 * H_PAD, 400);
      const textHeight = NAME_H;

      const onRename = vm.metadata?.onRename as ((name: string, generics?: string) => void) | undefined;
      
      if (onRename) {
        startInlineEditing(
          shapeId,
          nameText,
          'name',
          { x: screenPos.x, y: screenPos.y },
          { width: textWidth, height: textHeight },
          onRename,
        );
      }
    },
    [shapes, stageRef, startInlineEditing],
  );

  const handleNoteDblClick = useCallback(
    (shapeId: string, e: KonvaEventObject<MouseEvent>) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape || !isNoteViewModel(shape.data)) return;

      const vm = shape.data;
      const stage = stageRef.current;
      if (!stage) return;

      const groupNode = e.target.findAncestor('Group');
      if (!groupNode) return;

      const NOTE_H_PAD = 8;
      const NOTE_V_PAD = 8;
      const NOTE_TITLE_H = 32;
      const NOTE_W = 224;

      const groupPos = groupNode.getAbsolutePosition();
      const titleY = NOTE_V_PAD / 2 + 2;
      
      const transform = stage.getAbsoluteTransform().copy();
      const screenPos = transform.point({ x: groupPos.x + NOTE_H_PAD, y: groupPos.y + titleY });
      
      const textWidth = NOTE_W - 2 * NOTE_H_PAD - 12;
      const textHeight = NOTE_TITLE_H - NOTE_V_PAD;

      const onSave = vm.onSave;
      
      if (onSave) {
        startInlineEditing(
          shapeId,
          vm.title ?? '',
          'title',
          { x: screenPos.x, y: screenPos.y },
          { width: textWidth, height: textHeight },
          (newTitle) => onSave({ title: newTitle }),
        );
      }
    },
    [shapes, stageRef, startInlineEditing],
  );

  const { menu, onPaneContextMenu, onNodeContextMenu, closeMenu } = useContextMenu();

  const {
    openSSoTClassEditor,
    openClearConfirmation,
    openVfsEdgeAction,
    openMethodGenerator,
  } = useUiStore();

  const screenToCanvas = useCallback(
    (screen: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return screen;
      const transform = stage.getAbsoluteTransform().copy().invert();
      return transform.point(screen);
    },
    [stageRef],
  );

  const { getMenuOptions } = useDiagramMenus({
    onEditNode: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (viewNode?.elementId) openSSoTClassEditor(viewNode.elementId);
      closeMenu();
    },
    onClearCanvas: () => { openClearConfirmation(); closeMenu(); },
    onEditEdgeMultiplicity: (id) => { openVfsEdgeAction(id); closeMenu(); },
    onGenerateMethods: (id) => { openMethodGenerator(id); closeMenu(); },
    onDeleteNode: (nodeId) => {
      vfsController.removeNodeFromDiagram(nodeId);
      closeMenu();
    },
    onDeleteNodeFromModel: (nodeId) => {
      vfsController.deleteElementFromModel(nodeId);
      closeMenu();
    },
    onDuplicateNode: (nodeId) => {
      vfsController.duplicateNode(nodeId);
      closeMenu();
    },
    onDeleteEdge: (edgeId) => {
      vfsController.deleteEdgeById(edgeId);
      closeMenu();
    },
    onReverseEdge: (edgeId) => {
      vfsController.reverseEdgeById(edgeId);
      closeMenu();
    },
    onChangeEdgeKind: (edgeId, legacyType) => {
      const kind = VFS_TYPE_TO_RELATION_KIND[legacyType] ?? (legacyType as RelationKind);
      vfsController.changeEdgeKind(edgeId, kind);
      closeMenu();
    },
    onAddToProject: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (!viewNode?.elementId) return;
      const ms = useModelStore.getState();
      const elementName =
        ms.model?.classes[viewNode.elementId]?.name ??
        ms.model?.interfaces[viewNode.elementId]?.name ??
        ms.model?.enums[viewNode.elementId]?.name ??
        'Element';
      ms.integrateExternalElement(viewNode.elementId);
      useToastStore.getState().show(`"${elementName}" added to project model`);
      closeMenu();
    },
    getVFSNodeKind: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (!viewNode) return undefined;
      if (!viewNode.elementId) return 'NOTE';
      const activeModel = vfsController.isStandalone
        ? vfsController.localModel
        : useModelStore.getState().model;
      if (!activeModel) return undefined;
      const cls = activeModel.classes[viewNode.elementId];
      if (cls) return cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS';
      if (activeModel.interfaces[viewNode.elementId]) return 'INTERFACE';
      if (activeModel.enums[viewNode.elementId]) return 'ENUM';
      return 'NOTE';
    },
    getIsNodeExternal: (nodeId) => {
      if (vfsController.isStandalone) return false;
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (!viewNode?.elementId) return false;
      const ms = useModelStore.getState();
      if (!ms.model) return false;
      return !!(
        ms.model.classes[viewNode.elementId]?.isExternal ||
        ms.model.interfaces[viewNode.elementId]?.isExternal ||
        ms.model.enums[viewNode.elementId]?.isExternal
      );
    },
    getElementId: (nodeId) =>
      vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId)?.elementId,
    isStandalone: vfsController.isStandalone,
    screenToCanvas,
  });

  const contextMenuOptions = useMemo(
    () => (menu ? getMenuOptions(menu) : []),
    [menu, getMenuOptions],
  );

  const handleNodeContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>, nodeId: string) => {
      onNodeContextMenu(e.evt, { id: nodeId });
    },
    [onNodeContextMenu],
  );

  const handleEdgeContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>, edgeId: string) => {
      e.evt.preventDefault();
      openVfsEdgeAction(edgeId);
    },
    [openVfsEdgeAction],
  );

  const handleStageContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const isBackground = e.target === e.target.getStage() || e.target.name() === 'bg-rect';
      if (isBackground) {
        onPaneContextMenu(e.evt);
      }
    },
    [onPaneContextMenu],
  );

  const handleEdgeMouseEnter = useCallback(
    (_e: KonvaEventObject<MouseEvent>, edgeId: string) => {
      setHoveredEdgeId(edgeId);
    },
    [],
  );

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      connectionDraw.stageHandlers.onMouseDown(e);
      if (connectionDraw.isConnectingRef.current) return;

      rightClickPan.stageHandlers.onMouseDown(e);

      if (!rightClickPan.isRightDraggingRef.current) {
        stageHandlers.onMouseDown(e);
      }
    },
    [connectionDraw.stageHandlers, connectionDraw.isConnectingRef, rightClickPan, stageHandlers],
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (rightClickPan.isRightDraggingRef.current) return;

      connectionDraw.stageHandlers.onMouseMove(e);
      if (connectionDraw.isConnectingRef.current) return;

      stageHandlers.onMouseMove(e);
    },
    [connectionDraw.stageHandlers, connectionDraw.isConnectingRef, rightClickPan.isRightDraggingRef, stageHandlers],
  );

  const handleStageMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      connectionDraw.stageHandlers.onMouseUp(e);
      rightClickPan.stageHandlers.onMouseUp(e);
      stageHandlers.onMouseUp(e);
    },
    [connectionDraw.stageHandlers, rightClickPan, stageHandlers],
  );

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
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-canvas-base relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable={false}
          onWheel={onWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onClick={stageHandlers.onClick}
          onContextMenu={handleStageContextMenu}
        >
          <Layer>
            <Rect
              name="bg-rect"
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fill="transparent"
              listening={true}
            />
            {showGrid && (
              <GridPattern
                viewport={viewport}
                stageWidth={size.width}
                stageHeight={size.height}
              />
            )}
          </Layer>

          <Layer name="edges">
            {edges.map((edge) => {
              const isSelfLoop = edge.sourceId === edge.targetId;
              const sourceBounds = boundsMap.get(edge.sourceId);
              const targetBounds = isSelfLoop
                ? sourceBounds
                : boundsMap.get(edge.targetId);
              if (!sourceBounds || !targetBounds) return null;

              const isVisible = visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId);

              const obstacles = isSelfLoop
                ? []
                : [...boundsMap.entries()]
                    .filter(([id]) => id !== edge.sourceId && id !== edge.targetId)
                    .map(([, b]) => b);

              return (
                <KonvaEdge
                  key={edge.id}
                  id={edge.id}
                  kind={edge.kind}
                  sourceBounds={sourceBounds}
                  targetBounds={targetBounds}
                  isSelfLoop={isSelfLoop}
                  obstacles={obstacles}
                  sourceMultiplicity={edge.sourceMultiplicity}
                  targetMultiplicity={edge.targetMultiplicity}
                  sourceRole={edge.sourceRole}
                  targetRole={edge.targetRole}
                  isHighlighted={highlightedEdgeIds.has(edge.id)}
                  isHovered={hoveredEdgeId === edge.id}
                  isDimmed={dimmedEdgeIds.has(edge.id)}
                  onContextMenu={handleEdgeContextMenu}
                  onMouseEnter={handleEdgeMouseEnter}
                  onMouseLeave={handleEdgeMouseLeave}
                  visible={isVisible}
                />
              );
            })}
          </Layer>

          <Layer name="nodes">
            {shapes.map((shape) => {
              const pos = positionOverrides.get(shape.id) ?? { x: shape.x, y: shape.y };
              const vm = shape.data;
              const isVisible = visibleNodeIds.has(shape.id);
              
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
                    onDblClick={(e) => handleNoteDblClick(shape.id, e)}
                    onContextMenu={handleNodeContextMenu}
                    visible={isVisible}
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
                  onDblClick={(e) => handleClassDblClick(shape.id, e)}
                  onContextMenu={handleNodeContextMenu}
                  visible={isVisible}
                />
              );
            })}
          </Layer>

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

      <CanvasOverlay
        contextMenu={menu}
        contextMenuOptions={contextMenuOptions}
        onCloseContextMenu={closeMenu}
      />

      <DuplicateFileModal
        isOpen={duplicateModal.isOpen}
        fileName={duplicateModal.fileName}
        onReplace={duplicateModal.onReplace}
        onCancel={duplicateModal.onCancel}
        onDontShowAgain={duplicateModal.onDontShowAgain}
      />
    </div>
  );
}