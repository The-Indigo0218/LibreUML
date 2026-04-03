import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import GridPattern from './engine/GridPattern';
import { useViewport } from './engine/useViewport';
import { useSpacePan } from './hooks/useSpacePan';
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
  const highlightConnections = useSettingsStore((s) => s.showAllEdges); // MAG-01.23

  // Register stage in global store so ExportModal can access it
  const setStage = useStageStore((s) => s.setStage);
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      setStage(stage);
      return () => setStage(null);
    }
  });

  // VFS controller — needed for context menu callbacks
  const vfsController = useVFSCanvasController();

  const {
    shapes,
    edges,
    activeTabId,
    onNodeChange,
    onEdgeChange,
    onConnect,
  } = useKonvaCanvasController();

  // Calculate content bounds for viewport constraints (MAG-01.21)
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

  // Initialize viewport with content bounds (MAG-01.21)
  const { stageRef, stageProps, viewport } = useViewport({
    contentBounds,
    stageWidth: size.width,
    stageHeight: size.height,
    draggable: false, // Will be controlled by Space pan hook
  });

  // Space pan mode (MAG-01.25)
  const { isSpacePressed, onStageDragStart, onStageDragEnd } = useSpacePan({
    stageRef,
    containerRef,
    enabled: true,
  });

  // Override draggable prop from viewport with Space pan state
  const finalStageProps = {
    ...stageProps,
    draggable: isSpacePressed,
    onDragStart: (e: KonvaEventObject<DragEvent>) => {
      onStageDragStart();
      stageProps.onDragMove?.(e);
    },
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      onStageDragEnd();
      stageProps.onDragEnd?.(e);
    },
  };

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

  // ── Hovered edge ID (MAG-01.24) ──────────────────────────────────────────
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // ── Highlighted edges (MAG-01.23 + MAG-01.24) ────────────────────────────
  // Highlight mode ON → ALL edges show with kind-specific colors (no dimming).
  const highlightedEdgeIds = useMemo((): Set<string> => {
    if (!highlightConnections) return new Set();
    return new Set(edges.map((e) => e.id));
  }, [highlightConnections, edges]);

  // ── Dimmed edges (MAG-01.24) ─────────────────────────────────────────────
  // Only dim when hovering a specific edge — all others go to 0.15 opacity.
  // Highlight mode never dims edges.
  const dimmedEdgeIds = useMemo((): Set<string> => {
    if (!hoveredEdgeId) return new Set();
    return new Set(edges.filter((e) => e.id !== hoveredEdgeId).map((e) => e.id));
  }, [hoveredEdgeId, edges]);

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

  // ── External drag & drop (sidebar/palette → canvas) ────────────────────────
  const { onDragOver, onDrop } = useKonvaDnD({ stageRef });

  // ── Inline editor activation ───────────────────────────────────────────────
  const startInlineEditing = useInlineEditorStore((s) => s.startEditing);
  const updateEditorPosition = useInlineEditorStore((s) => s.updatePosition);
  const isEditing = useInlineEditorStore((s) => s.isEditing);
  const activeNodeId = useInlineEditorStore((s) => s.activeNodeId);

  // Update editor position when viewport changes (pan/zoom)
  useEffect(() => {
    if (!isEditing || !activeNodeId) return;

    const shape = shapes.find((s) => s.id === activeNodeId);
    if (!shape) return;

    const stage = stageRef.current;
    if (!stage) return;

    // Recalculate screen position based on current viewport
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

      // Get the Group node that was double-clicked
      const groupNode = e.target.findAncestor('Group');
      if (!groupNode) return;

      // Calculate screen-space position of the name text
      // Name text is positioned at (H_PAD, nameY + 3) within the Group
      const H_PAD = 10;
      const NAME_H = 22;
      
      // Get absolute position of the group in stage coordinates
      const groupPos = groupNode.getAbsolutePosition();
      
      // Calculate name text position within the group
      // This matches the layout in ClassShape.tsx
      const layout = getClassShapeSize(vm);
      const nameY = layout.height * 0.15; // Approximate header position
      
      // Transform to screen coordinates
      const transform = stage.getAbsoluteTransform().copy();
      const screenPos = transform.point({ x: groupPos.x + H_PAD, y: groupPos.y + nameY });
      
      // Calculate text dimensions
      const nameText = vm.sublabel ? `${vm.label}${vm.sublabel}` : vm.label;
      const textWidth = Math.min(layout.width - 2 * H_PAD, 400); // Max 400px
      const textHeight = NAME_H;

      // Get onRename callback from metadata (VFS path)
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

      // Get the Group node that was double-clicked
      const groupNode = e.target.findAncestor('Group');
      if (!groupNode) return;

      // Calculate screen-space position of the title text
      const NOTE_H_PAD = 8;
      const NOTE_V_PAD = 8;
      const NOTE_TITLE_H = 32;
      const NOTE_W = 224;

      // Get absolute position of the group in stage coordinates
      const groupPos = groupNode.getAbsolutePosition();
      
      // Title text position within the group
      const titleY = NOTE_V_PAD / 2 + 2;
      
      // Transform to screen coordinates
      const transform = stage.getAbsoluteTransform().copy();
      const screenPos = transform.point({ x: groupPos.x + NOTE_H_PAD, y: groupPos.y + titleY });
      
      // Calculate text dimensions
      const textWidth = NOTE_W - 2 * NOTE_H_PAD - 12; // Minus fold corner
      const textHeight = NOTE_TITLE_H - NOTE_V_PAD;

      // Get onSave callback from view model
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

  // ── Context Menu ──────────────────────────────────────────────────────────
  const { menu, onPaneContextMenu, onNodeContextMenu, closeMenu } = useContextMenu();

  const {
    openSSoTClassEditor,
    openClearConfirmation,
    openVfsEdgeAction,
    openMethodGenerator,
  } = useUiStore();

  // Screen → canvas coordinate conversion for context menu "Add" actions
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

  // Context menu handlers for Konva shapes
  const handleNodeContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>, nodeId: string) => {
      onNodeContextMenu(e.evt, { id: nodeId });
    },
    [onNodeContextMenu],
  );

  // Edge right-click → open VfsEdgeActionModal directly (no context menu)
  const handleEdgeContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>, edgeId: string) => {
      e.evt.preventDefault();
      openVfsEdgeAction(edgeId);
    },
    [openVfsEdgeAction],
  );

  const handleStageContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (e.target === e.target.getStage()) {
        onPaneContextMenu(e.evt);
      }
    },
    [onPaneContextMenu],
  );

  // Edge hover handlers (MAG-01.24)
  // Badge tooltip is rendered inline on the Konva layer via KonvaEdge's isHovered prop.
  const handleEdgeMouseEnter = useCallback(
    (_e: KonvaEventObject<MouseEvent>, edgeId: string) => {
      setHoveredEdgeId(edgeId);
    },
    [],
  );

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

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
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-canvas-base relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          {...finalStageProps}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onClick={stageHandlers.onClick}
          onContextMenu={handleStageContextMenu}
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
                    onDblClick={(e) => handleNoteDblClick(shape.id, e)}
                    onContextMenu={handleNodeContextMenu}
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

      {/* HTML Overlay (Layer 0) — positioned above canvas */}
      <CanvasOverlay
        contextMenu={menu}
        contextMenuOptions={contextMenuOptions}
        onCloseContextMenu={closeMenu}
      />
    </div>
  );
}
