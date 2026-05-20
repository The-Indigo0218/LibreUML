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
import PackageShape, { getPackageShapeSize } from './shapes/PackageShape';
import { SB_MIN_W, SB_MIN_H } from './shapes/SystemBoundaryShape';
import { UCM_MIN_W, UCM_MIN_H } from './shapes/UCModuleShape';
import { getShapeSize, renderShape } from './ShapeRouter';

// Layout constants mirrored from shape files for inline editor positioning
const ACTOR_NAME_Y_FROM_TOP = 84; // BODY_BOT(58) + LEG_DY(18) + NAME_GAP(8)
const ACTOR_NAME_H = 18;
const UC_NAME_Y_RATIO = 0.5;     // vertically centred at BASE_H/2
const UC_NAME_FONT = 13;
const UC_H_PAD = 16;
import { computePackageSize } from './engine/packageLayout';
import KonvaEdge from './edges/KonvaEdge';
import SelectionRect from './selection/SelectionRect';
import { useSelection } from './interactions/useSelection';
import { useDragHandler } from './interactions/useDragHandler';
import type { CanvasNode } from './interactions/useDragHandler';
import { useConnectionDraw } from './interactions/useConnectionDraw';
import { useCanvasKeyboard } from './interactions/useCanvasKeyboard';
import { usePackageDrop } from './interactions/usePackageDrop';
import { withUndo, undoTransaction } from '../core/undo/undoBridge';
import { isDiagramView } from '../features/diagram/hooks/useVFSCanvasController';
import CanvasOverlay from './CanvasOverlay';
import DuplicateFileModal from '../components/shared/DuplicateFileModal';
import PackageHierarchyModal from './overlays/PackageHierarchyModal';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { DeletePackageModal } from '../features/diagram/components/layout/packageExplorer/DeletePackageModal';
import NoteEditorModal from '../features/diagram/components/modals/NoteEditorModal';
import UseCaseHoverPopover from '../features/diagram/components/modals/UseCaseHoverPopover';
import UseCaseSpecModal from '../features/diagram/components/modals/UseCaseSpecModal';
import ActorPropsModal from '../features/diagram/components/modals/ActorPropsModal';
import ExtendEdgePropsModal from '../features/diagram/components/modals/ExtendEdgePropsModal';
import DomainEntityPropsModal from '../features/diagram/components/modals/DomainEntityPropsModal';
import DomainAssociationPropsModal from '../features/diagram/components/modals/DomainAssociationPropsModal';
import { useInlineEditorStore } from './store/inlineEditorStore';
import { useContextMenu } from '../features/diagram/hooks/useContextMenu';
import { useDiagramMenus } from '../features/diagram/hooks/useDiagramMenus';
import { useVFSCanvasController } from '../features/diagram/hooks/useVFSCanvasController';
import { useUiStore } from '../store/uiStore';
import { useModelStore } from '../store/model.store';
import { useToastStore } from '../store/toast.store';

import { useStageStore } from './store/stageStore';
import MiniMap from './overlays/MiniMap';
import CullingWarningModal from './overlays/CullingWarningModal';
import type { KonvaNodeChange, KonvaEdgeChange } from './types/canvas.types';
import type { ViewNode } from '../core/domain/vfs/vfs.types';
import { useTranslation } from 'react-i18next';
import {
  isNoteViewModel,
  isNodeViewModel,
  isPackageViewModel,
  isActorViewModel,
  isUseCaseViewModel,
  isSystemBoundaryViewModel,
  isUCModuleViewModel,
  isDomainEntityViewModel,
  type AnyNodeViewModel,
  type NodeViewModel,
  type PackageViewModel,
} from '../adapters/view-models/node.view-model';
import { selectAnchors, anchorPointToHandle, type NodeBounds, type LockedHandle } from './edges/geometry';
import type { AnchorSnapshot } from '../store/uiStore';
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
  const [deletePackageModal, setDeletePackageModal] = useState<{
    isOpen: boolean;
    packageName: string;
    packageId: string;
    viewNodeId: string;
    hasClasses: boolean;
    classCount: number;
  }>({
    isOpen: false,
    packageName: '',
    packageId: '',
    viewNodeId: '',
    hasClasses: false,
    classCount: 0,
  });

  const [clearCanvasModal, setClearCanvasModal] = useState(false);
  const [ucHover, setUcHover] = useState<{
    elementId: string;
    screenX: number;
    screenY: number;
  } | null>(null);
  const ucHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ucHoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [noteEditorModal, setNoteEditorModal] = useState<{
    noteId: string;
    initialTitle: string;
    initialContent: string;
    onSave: (title: string, content: string) => void;
  } | null>(null);

  const { t } = useTranslation();
  const theme       = useSettingsStore((s) => s.theme);
  const gridType    = useSettingsStore((s) => s.gridType);
  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const viewportCulling         = useSettingsStore((s) => s.viewportCulling);
  const suppressCullingWarning  = useSettingsStore((s) => s.suppressCullingWarning);
  const toggleViewportCulling   = useSettingsStore((s) => s.toggleViewportCulling);
  const setSuppressCullingWarning = useSettingsStore((s) => s.setSuppressCullingWarning);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStage, size.width, size.height]);

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

      if (isPackageViewModel(vm)) {
        const size = getPackageShapeSize(vm);
        width = size.width;
        height = size.height;
      } else {
        ({ width, height } = getShapeSize(vm));
      }

      minX = Math.min(minX, shape.x);
      minY = Math.min(minY, shape.y);
      maxX = Math.max(maxX, shape.x + width);
      maxY = Math.max(maxY, shape.y + height);
    }

    if (minX === Infinity) return null;

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
  const [hoveredPackageId, setHoveredPackageId] = useState<string | null>(null);
  const [isHoverValid, setIsHoverValid] = useState<boolean>(true);

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

  const collectDescendantIds = useCallback((nodeId: string): Set<string> => {
    const result = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const shape of shapes) {
        if (shape.parentPackageId === parentId && !result.has(shape.id)) {
          result.add(shape.id);
          queue.push(shape.id);
        }
      }
    }
    return result;
  }, [shapes]);

  const { positionOverrides, dragPositions, ghostNodes, dragHandlers } = useDragHandler({
    stageRef,
    selectedIds,
    nodes: canvasNodes,
    shapes,
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
      if (shape.type === 'package') continue;
      const pos =
        dragPositions?.get(shape.id) ??
        positionOverrides.get(shape.id) ??
        { x: shape.x, y: shape.y };
      const vm = shape.data;
      const { width, height } = getShapeSize(vm);
      map.set(shape.id, { x: pos.x, y: pos.y, width, height });
    }

    const pkgShapes = shapes
      .filter((s) => s.type === 'package')
      .sort((a, b) => (b.data as PackageViewModel).depth - (a.data as PackageViewModel).depth);

    for (const shape of pkgShapes) {
      const pos =
        dragPositions?.get(shape.id) ??
        positionOverrides.get(shape.id) ??
        { x: shape.x, y: shape.y };
      const vm = shape.data as PackageViewModel;

      const childBounds: NodeBounds[] = [];
      for (const child of shapes) {
        if (child.parentPackageId !== shape.id) continue;
        const cb = map.get(child.id);
        if (cb) childBounds.push(cb);
      }

      const { width, height } = computePackageSize(
        shape.id,
        childBounds,
        vm.collapsed ?? false,
        shape.width,
        shape.height,
      );
      map.set(shape.id, { x: pos.x, y: pos.y, width, height });
    }

    return map;
  }, [shapes, positionOverrides, dragPositions]);

  const packageChildBoundsMap = useMemo((): Map<string, NodeBounds[]> => {
    const map = new Map<string, NodeBounds[]>();
    for (const shape of shapes) {
      if (!shape.parentPackageId) continue;
      const cb = boundsMap.get(shape.id);
      if (!cb) continue;
      const existing = map.get(shape.parentPackageId);
      if (existing) {
        existing.push(cb);
      } else {
        map.set(shape.parentPackageId, [cb]);
      }
    }
    return map;
  }, [shapes, boundsMap]);

  boundsMapRef.current = boundsMap;

  const {
    onDragEndWithPackageDetection,
    PackageDropPicker,
  } = usePackageDrop({
    shapes,
    boundsMap,
    activeTabId: activeTabId ?? '',
    isStandalone: vfsController.isStandalone,
  });

  const visibleNodeIds = useViewportCuller(viewport, size.width, size.height, boundsMap, viewportCulling);

  const [cullingWarningOpen, setCullingWarningOpen] = useState(false);
  const cullingPromptedRef = useRef(false);

  useEffect(() => {
    if (
      !viewportCulling &&
      shapes.length >= 20 &&
      !suppressCullingWarning &&
      !cullingPromptedRef.current
    ) {
      cullingPromptedRef.current = true;
      setCullingWarningOpen(true);
    }
  }, [shapes.length, viewportCulling, suppressCullingWarning]);

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

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      dragHandlers.onDragEnd(e);
      onDragEndWithPackageDetection(e);
      setHoveredPackageId(null);
      setIsHoverValid(true);
    },
    [dragHandlers, onDragEndWithPackageDetection],
  );

  const handleDragMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      dragHandlers.onDragMove(e);

      const nodeId = e.target.id();
      if (!nodeId) return;

      const nodeBounds = boundsMap.get(nodeId);
      const dropPoint = {
        x: e.target.x() + (nodeBounds ? nodeBounds.width / 2 : 0),
        y: e.target.y() + (nodeBounds ? nodeBounds.height / 2 : 0),
      };

      const excludeIds = collectDescendantIds(nodeId);
      let foundPackage: string | null = null;
      let maxDepth = -1;
      let foundBoundary: string | null = null;

      for (const shape of shapes) {
        if (excludeIds.has(shape.id)) continue;
        const cb = boundsMap.get(shape.id);
        if (!cb) continue;
        const { x, y, width, height } = cb;
        const hit = dropPoint.x >= x && dropPoint.x <= x + width &&
                    dropPoint.y >= y && dropPoint.y <= y + height;
        if (!hit) continue;

        if (shape.type === 'package' && isPackageViewModel(shape.data)) {
          if (shape.data.depth > maxDepth) {
            maxDepth = shape.data.depth;
            foundPackage = shape.id;
          }
        } else if (isSystemBoundaryViewModel(shape.data) || isUCModuleViewModel(shape.data)) {
          foundBoundary = shape.id;
        }
      }

      // Packages take priority over system boundaries
      const foundContainer = foundPackage ?? foundBoundary;
      if (foundContainer !== hoveredPackageId) {
        setHoveredPackageId(foundContainer);
        setIsHoverValid(!excludeIds.has(foundContainer ?? ''));
      }
    },
    [dragHandlers, boundsMap, shapes, collectDescendantIds, hoveredPackageId],
  );

  const handleToggleCollapse = useCallback(
    (packageId: string) => {
      const shape = shapes.find((s) => s.id === packageId);
      if (!shape || !isPackageViewModel(shape.data)) return;

      const packageName = shape.data.name;
      const newState = !shape.data.collapsed;

      withUndo('vfs', `${newState ? 'Collapse' : 'Expand'}: ${packageName}`, activeTabId ?? '', (draft: any) => {
        const file = draft.project?.nodes[activeTabId!];
        if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
        const viewNode = file.content.nodes.find((vn: any) => vn.id === packageId);
        if (viewNode) viewNode.collapsed = newState;
      });
    },
    [shapes, activeTabId],
  );

  const handlePackageResizeEnd = useCallback(
    (packageId: string, newWidth: number, newHeight: number) => {
      const shape = shapes.find((s) => s.id === packageId);
      if (!shape || !isPackageViewModel(shape.data)) return;
      const packageName = shape.data.name;
      withUndo('vfs', `Resize: ${packageName}`, activeTabId ?? '', (draft: any) => {
        const file = draft.project?.nodes[activeTabId!];
        if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
        const viewNode = file.content.nodes.find((vn: any) => vn.id === packageId);
        if (viewNode) {
          viewNode.width = newWidth;
          viewNode.height = newHeight;
        }
      });
    },
    [shapes, activeTabId],
  );

  const handleSystemBoundaryResizeEnd = useCallback(
    (shapeId: string, newWidth: number, newHeight: number) => {
      if (!activeTabId) return;
      // Enforce minimum size here too, as a safety net
      const w = Math.max(SB_MIN_W, Math.round(newWidth));
      const h = Math.max(SB_MIN_H, Math.round(newHeight));
      withUndo('vfs', 'Resize System Boundary', activeTabId, (draft: any) => {
        const file = draft.project?.nodes[activeTabId];
        if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
        const viewNode = file.content.nodes.find((vn: any) => vn.id === shapeId);
        if (viewNode) {
          viewNode.width = w;
          viewNode.height = h;
        }
      });
    },
    [activeTabId],
  );

  const handleUCModuleResizeEnd = useCallback(
    (shapeId: string, newWidth: number, newHeight: number) => {
      if (!activeTabId) return;
      const w = Math.max(UCM_MIN_W, Math.round(newWidth));
      const h = Math.max(UCM_MIN_H, Math.round(newHeight));
      withUndo('vfs', 'Resize Module', activeTabId, (draft: any) => {
        const file = draft.project?.nodes[activeTabId];
        if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
        const viewNode = file.content.nodes.find((vn: any) => vn.id === shapeId);
        if (viewNode) {
          viewNode.width = w;
          viewNode.height = h;
        }
      });
    },
    [activeTabId],
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

  const { onDragOver: handleDragOver, onDrop: handleDrop, duplicateModal, hierarchyModal } = useKonvaDnD({ stageRef });

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
      const layout = getShapeSize(shape.data);
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
      const layout = getShapeSize(vm);
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
    (shapeId: string, _e: KonvaEventObject<MouseEvent>) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape || !isNoteViewModel(shape.data)) return;

      const vm = shape.data;
      const stage = stageRef.current;
      if (!stage) return;

      const NOTE_H_PAD = 8;
      const NOTE_V_PAD = 8;
      const NOTE_TITLE_H = 32;
      const NOTE_W = 224;

      // Use canvas-space position and apply stage transform once (same as useEffect above).
      const pos = positionOverrides.get(shapeId) ?? { x: shape.x, y: shape.y };
      const transform = stage.getAbsoluteTransform().copy();
      const titleY = NOTE_V_PAD / 2 + 2;
      const screenPos = transform.point({ x: pos.x + NOTE_H_PAD, y: pos.y + titleY });

      const textWidth = NOTE_W - 2 * NOTE_H_PAD - 12;
      const textHeight = NOTE_TITLE_H - NOTE_V_PAD;

      if (vm.onSave) {
        startInlineEditing(
          shapeId,
          vm.title ?? '',
          'title',
          { x: screenPos.x, y: screenPos.y },
          { width: textWidth, height: textHeight },
          (newTitle) => vm.onSave!({ title: newTitle }),
        );
      }
    },
    [shapes, stageRef, startInlineEditing, positionOverrides],
  );

  const { menu, onPaneContextMenu, onNodeContextMenu, closeMenu } = useContextMenu();

  const {
    openSSoTClassEditor,
    openVfsEdgeAction,
    openMethodGenerator,
    openExtendProps,
    openDomainAssociationProps,
  } = useUiStore();

  const startUseCaseInlineEdit = useCallback(
    (shapeId: string) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) return;
      const vm = shape.data;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = positionOverrides.get(shapeId) ?? { x: shape.x, y: shape.y };
      const transform = stage.getAbsoluteTransform().copy();

      if (isActorViewModel(vm)) {
        const { width } = getShapeSize(vm);
        const screenPos = transform.point({ x: pos.x, y: pos.y + ACTOR_NAME_Y_FROM_TOP });
        if (vm.onRename) {
          startInlineEditing(shapeId, vm.name, 'name',
            { x: screenPos.x, y: screenPos.y },
            { width, height: ACTOR_NAME_H },
            (text) => vm.onRename!(text));
        }
      } else if (isUseCaseViewModel(vm)) {
        const { width, height } = getShapeSize(vm);
        const nameY = height * UC_NAME_Y_RATIO - UC_NAME_FONT / 2;
        const screenPos = transform.point({ x: pos.x + UC_H_PAD, y: pos.y + nameY });
        if (vm.onRename) {
          startInlineEditing(shapeId, vm.name, 'name',
            { x: screenPos.x, y: screenPos.y },
            { width: width - UC_H_PAD * 2, height: UC_NAME_FONT + 6 },
            (text) => vm.onRename!(text));
        }
      } else if (isSystemBoundaryViewModel(vm)) {
        const { width } = getShapeSize(vm);
        const screenPos = transform.point({ x: pos.x + 10, y: pos.y + 4 });
        if (vm.onRename) {
          startInlineEditing(shapeId, vm.name, 'name',
            { x: screenPos.x, y: screenPos.y },
            { width: Math.min(width - 20, 280), height: 22 },
            (text) => vm.onRename!(text));
        }
      } else if (isUCModuleViewModel(vm)) {
        // Tab is 100px wide; title sits in the upper half of the tab (above body)
        const stageScale = stageRef.current?.scaleX() ?? 1;
        const TAB_H_SCREEN = 24 * stageScale;
        const screenPos = transform.point({ x: pos.x + 4, y: pos.y - 24 + 12 });
        if (vm.onRename) {
          startInlineEditing(shapeId, vm.name, 'name',
            { x: screenPos.x, y: screenPos.y - TAB_H_SCREEN / 2 },
            { width: 90, height: 14 },
            (text) => vm.onRename!(text));
        }
      } else {
        (vm as AnyNodeViewModel & { onOpenProps?: () => void }).onOpenProps?.();
      }
    },
    [shapes, stageRef, positionOverrides, startInlineEditing],
  );

  const handleUseCaseMouseEnter = useCallback(
    (e: KonvaEventObject<MouseEvent>, shapeId: string) => {
      // Don't show hover while mouse button is held (connection drawing or drag)
      if (e.evt.buttons !== 0) return;

      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape || !isUseCaseViewModel(shape.data)) return;
      const vm = shape.data;
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === shapeId);
      if (!viewNode?.elementId) return;

      // Cancel any pending hide
      if (ucHoverHideTimer.current) { clearTimeout(ucHoverHideTimer.current); ucHoverHideTimer.current = null; }
      if (ucHoverTimer.current) clearTimeout(ucHoverTimer.current);
      ucHoverTimer.current = setTimeout(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const pos = positionOverrides.get(shapeId) ?? { x: shape.x, y: shape.y };
        const { width, height } = getShapeSize(vm);
        const transform = stage.getAbsoluteTransform().copy();
        const stageRect = stage.container().getBoundingClientRect();
        // Anchor to right-center of shape so popover never appears under the cursor.
        // Add stageRect offset to convert canvas-relative coords to viewport coords for position:fixed.
        const canvasPt = transform.point({ x: pos.x + width, y: pos.y + height / 2 });
        setUcHover({ elementId: viewNode.elementId, screenX: stageRect.left + canvasPt.x, screenY: stageRect.top + canvasPt.y });
      }, 400);
    },
    [shapes, vfsController.diagramView, stageRef, positionOverrides],
  );

  const handleUseCaseMouseLeave = useCallback(() => {
    if (ucHoverTimer.current) { clearTimeout(ucHoverTimer.current); ucHoverTimer.current = null; }
    // Hide after a generous delay so the user can move mouse onto the popover
    ucHoverHideTimer.current = setTimeout(() => setUcHover(null), 500);
  }, []);

  const cancelPopoverHide = useCallback(() => {
    if (ucHoverHideTimer.current) { clearTimeout(ucHoverHideTimer.current); ucHoverHideTimer.current = null; }
  }, []);

  const handleUseCaseDblClickModal = useCallback(
    (shapeId: string) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape || !isUseCaseViewModel(shape.data)) return;
      shape.data.onOpenSpec?.();
    },
    [shapes],
  );

  const buildAnchorSnapshot = useCallback(
    (edgeId: string): AnchorSnapshot | null => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return null;
      const sb = boundsMap.get(edge.sourceId);
      const tb = edge.sourceId === edge.targetId ? sb : boundsMap.get(edge.targetId);
      if (!sb || !tb) return null;
      const direction = {
        dx: (tb.x + tb.width / 2) - (sb.x + sb.width / 2),
        dy: (tb.y + tb.height / 2) - (sb.y + sb.height / 2),
      };
      if (edge.anchorLocked && edge.sourceHandle && edge.targetHandle) {
        return { src: edge.sourceHandle as LockedHandle, tgt: edge.targetHandle as LockedHandle, direction };
      }
      const { src, tgt } = selectAnchors(sb, tb);
      return { src: anchorPointToHandle(sb, src), tgt: anchorPointToHandle(tb, tgt), direction };
    },
    [edges, boundsMap],
  );

  const screenToCanvas = useCallback(
    (screen: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return screen;
      const transform = stage.getAbsoluteTransform().copy().invert();
      return transform.point(screen);
    },
    [stageRef],
  );

  const deletePackageFromModel = useCallback((packageId: string, packageName: string, deleteClasses: boolean) => {
    const activeModel = vfsController.isStandalone ? vfsController.localModel : useModelStore.getState().model;
    if (!activeModel || !activeTabId) return;

    const allEls = [
      ...Object.values(activeModel.classes),
      ...Object.values(activeModel.interfaces),
      ...Object.values(activeModel.enums),
    ];
    const affected = allEls.filter(
      (el) => el.packageName === packageName || el.packageName?.startsWith(`${packageName}.`)
    );

    const deletedRelationIds = new Set<string>();
    if (deleteClasses && activeModel.relations) {
      const affectedIds = new Set(affected.map((el) => el.id));
      for (const [rid, rel] of Object.entries(activeModel.relations)) {
        if (affectedIds.has(rel.sourceId) || affectedIds.has(rel.targetId)) {
          deletedRelationIds.add(rid);
        }
      }
    }

    if (vfsController.isStandalone) {
      undoTransaction({
        label: `Delete Package: ${packageName}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || file.type !== 'FILE') return;

            if (file.localModel) {
              delete file.localModel.packages[packageId];
              if (file.localModel.packageNames) {
                file.localModel.packageNames = file.localModel.packageNames.filter(
                  (n: string) => n !== packageName && !n.startsWith(`${packageName}.`)
                );
              }
              if (deleteClasses) {
                affected.forEach((el) => {
                  delete file.localModel.classes?.[el.id];
                  delete file.localModel.interfaces?.[el.id];
                  delete file.localModel.enums?.[el.id];
                });
                for (const rid of deletedRelationIds) {
                  if (file.localModel.relations) delete file.localModel.relations[rid];
                }
              } else {
                affected.forEach((el) => {
                  const rec = file.localModel.classes?.[el.id]
                    ?? file.localModel.interfaces?.[el.id]
                    ?? file.localModel.enums?.[el.id];
                  if (rec) rec.packageName = undefined;
                });
              }
              file.localModel.updatedAt = Date.now();
            }

            if (isDiagramView(file.content)) {
              const pkgVN = file.content.nodes.find((vn: ViewNode) => vn.elementId === packageId);
              if (pkgVN) {
                file.content.nodes = file.content.nodes
                  .map((vn: ViewNode) =>
                    vn.parentPackageId === pkgVN.id ? { ...vn, parentPackageId: null } : vn
                  )
                  .filter((vn: ViewNode) => vn.elementId !== packageId);
              }
              if (deleteClasses) {
                const deletedIds = new Set(affected.map((el) => el.id));
                file.content.nodes = file.content.nodes.filter((vn: ViewNode) => !deletedIds.has(vn.elementId));
                file.content.edges = file.content.edges.filter((ve: any) => !deletedRelationIds.has(ve.relationId));
              }
            }
          },
        }],
      });
    } else {
      undoTransaction({
        label: `Delete Package: ${packageName}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) return;
              delete draft.model.packages[packageId];
              if (draft.model.packageNames) {
                draft.model.packageNames = draft.model.packageNames.filter(
                  (n: string) => n !== packageName && !n.startsWith(`${packageName}.`)
                );
              }
              if (deleteClasses) {
                affected.forEach((el) => {
                  delete draft.model.classes[el.id];
                  delete draft.model.interfaces[el.id];
                  delete draft.model.enums[el.id];
                });
                for (const rid of deletedRelationIds) {
                  delete draft.model.relations[rid];
                }
              } else {
                affected.forEach((el) => {
                  const rec = draft.model.classes[el.id]
                    ?? draft.model.interfaces[el.id]
                    ?? draft.model.enums[el.id];
                  if (rec) rec.packageName = undefined;
                });
              }
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              if (!draft.project) return;
              const deletedElementIds = new Set(deleteClasses ? affected.map((el) => el.id) : []);
              for (const fileNode of Object.values(draft.project.nodes as Record<string, any>)) {
                if (fileNode.type !== 'FILE' || !isDiagramView(fileNode.content)) continue;
                const pkgVN = fileNode.content.nodes.find((vn: ViewNode) => vn.elementId === packageId);
                if (pkgVN) {
                  fileNode.content.nodes = fileNode.content.nodes
                    .map((vn: ViewNode) =>
                      vn.parentPackageId === pkgVN.id ? { ...vn, parentPackageId: null } : vn
                    )
                    .filter((vn: ViewNode) => vn.elementId !== packageId);
                }
                if (deleteClasses && deletedElementIds.size > 0) {
                  fileNode.content.nodes = fileNode.content.nodes.filter(
                    (vn: ViewNode) => !deletedElementIds.has(vn.elementId)
                  );
                  fileNode.content.edges = fileNode.content.edges.filter(
                    (ve: any) => !deletedRelationIds.has(ve.relationId)
                  );
                }
              }
            },
          },
        ],
      });
    }
    useToastStore.getState().show(`Package "${packageName}" deleted.`);
  }, [vfsController, activeTabId]);

  const clearCanvas = useCallback(() => {
    if (!activeTabId) return;
    
    withUndo('vfs', 'Clear Canvas', activeTabId, (draft: any) => {
      const node = draft.project?.nodes[activeTabId];
      if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
      node.content.nodes = [];
      node.content.edges = [];
    });
    
    useToastStore.getState().show('Canvas cleared');
    setClearCanvasModal(false);
  }, [activeTabId]);

  const { getMenuOptions } = useDiagramMenus({
    onEditNode: (nodeId) => {
      const shape = shapes.find((s) => s.id === nodeId);
      if (shape && (isActorViewModel(shape.data) || isUseCaseViewModel(shape.data) || isSystemBoundaryViewModel(shape.data))) {
        startUseCaseInlineEdit(nodeId);
        closeMenu();
        return;
      }
      if (shape && isDomainEntityViewModel(shape.data)) {
        shape.data.onOpenProps?.();
        closeMenu();
        return;
      }
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (viewNode?.elementId) openSSoTClassEditor(viewNode.elementId);
      closeMenu();
    },
    onEditNote: (nodeId) => {
      const shape = shapes.find((s) => s.id === nodeId);
      if (!shape || !isNoteViewModel(shape.data)) return;
      const vm = shape.data;
      setNoteEditorModal({
        noteId: nodeId,
        initialTitle: vm.title ?? '',
        initialContent: vm.content,
        onSave: (title, content) => vm.onSave?.({ title, content }),
      });
      closeMenu();
    },
    onClearCanvas: () => { setClearCanvasModal(true); closeMenu(); },
    onEditEdgeMultiplicity: (id) => { openVfsEdgeAction(id, buildAnchorSnapshot(id)); closeMenu(); },
    onGenerateMethods: (id) => { openMethodGenerator(id); closeMenu(); },
    onDeleteNode: (nodeId) => {
      vfsController.removeNodeFromDiagram(nodeId);
      closeMenu();
    },
    onDeleteNodeFromModel: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId);
      if (!viewNode?.elementId) return;

      const activeModel = vfsController.isStandalone ? vfsController.localModel : useModelStore.getState().model;
      if (!activeModel) return;

      const pkg = activeModel.packages[viewNode.elementId];
      if (pkg) {
        const allEls = [
          ...Object.values(activeModel.classes),
          ...Object.values(activeModel.interfaces),
          ...Object.values(activeModel.enums),
        ];
        const classesInPackage = allEls.filter(
          (el) => el.packageName === pkg.name || el.packageName?.startsWith(`${pkg.name}.`)
        );

        setDeletePackageModal({
          isOpen: true,
          packageName: pkg.name,
          packageId: pkg.id,
          viewNodeId: nodeId,
          hasClasses: classesInPackage.length > 0,
          classCount: classesInPackage.length,
        });
        closeMenu();
        return;
      }

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
      if (activeModel.packages[viewNode.elementId]) return 'PACKAGE';
      if (activeModel.actors?.[viewNode.elementId]) return 'ACTOR';
      if (activeModel.useCases?.[viewNode.elementId]) return 'USECASE';
      if (activeModel.systemBoundaries?.[viewNode.elementId]) return 'SYSTEM_BOUNDARY';
      if (activeModel.ucModules?.[viewNode.elementId]) return 'UC_MODULE';
      if (activeModel.domainEntities?.[viewNode.elementId]) return 'DOMAIN_ENTITY';
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
    diagramType: vfsController.vfsFile?.diagramType,
    screenToCanvas,
  });

  const sortedShapes = useMemo(() =>
    [...shapes].sort((a, b) => {
      const aIsBackground = a.type === 'package' || isSystemBoundaryViewModel(a.data) || isUCModuleViewModel(a.data);
      const bIsBackground = b.type === 'package' || isSystemBoundaryViewModel(b.data) || isUCModuleViewModel(b.data);
      if (aIsBackground && !bIsBackground) return -1;
      if (!aIsBackground && bIsBackground) return 1;
      if (a.type === 'package' && b.type === 'package') {
        return (a.data as PackageViewModel).depth - (b.data as PackageViewModel).depth;
      }
      return 0;
    }),
    [shapes],
  );

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
      if (vfsController.vfsFile?.diagramType === 'DOMAIN_MODEL_DIAGRAM') {
        const relationId = vfsController.edges.find((ve) => ve.id === edgeId)?.data.domainId;
        if (relationId) openDomainAssociationProps(relationId);
        return;
      }
      openVfsEdgeAction(edgeId, buildAnchorSnapshot(edgeId));
    },
    [openVfsEdgeAction, buildAnchorSnapshot, openDomainAssociationProps, vfsController.vfsFile?.diagramType, vfsController.edges],
  );

  const handleEdgeDblClick = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      if (edge.kind === 'EXTEND') { openExtendProps(edgeId); return; }
      // TODO(post-v1 Fase 2): mover a ShapeRouter
      if (vfsController.vfsFile?.diagramType === 'DOMAIN_MODEL_DIAGRAM') {
        const relationId = vfsController.edges.find((e) => e.id === edgeId)?.data.domainId;
        if (relationId) openDomainAssociationProps(relationId);
      }
    },
    [edges, openExtendProps, openDomainAssociationProps, vfsController.vfsFile?.diagramType],
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

  // Pre-compute edge render data so both the "edges" and "edge-labels" layers
  // can share it without duplicating the bounds/visibility logic.
  const edgeRenderData = useMemo(() => {
    // Packages and SystemBoundaries are containers — exclude them from obstacle avoidance
    // so edges route freely through their interiors.
    const nonPackageIds = new Set(
      shapes
        .filter((s) => s.type !== 'package' && !isSystemBoundaryViewModel(s.data))
        .map((s) => s.id),
    );

    const isNodeInCollapsedPackage = (nodeId: string): boolean => {
      const nodeShape = shapes.find((s) => s.id === nodeId);
      if (!nodeShape || !nodeShape.parentPackageId) return false;
      let parentId: string | null | undefined = nodeShape.parentPackageId;
      while (parentId) {
        const parentShape = shapes.find((s) => s.id === parentId);
        if (
          parentShape &&
          isPackageViewModel(parentShape.data) &&
          parentShape.data.collapsed
        ) return true;
        parentId = parentShape?.parentPackageId;
      }
      return false;
    };

    return edges
      .map((edge) => {
        const isSelfLoop = edge.sourceId === edge.targetId;
        const sourceBounds = boundsMap.get(edge.sourceId);
        const targetBounds = isSelfLoop ? sourceBounds : boundsMap.get(edge.targetId);
        if (!sourceBounds || !targetBounds) return null;
        const isVisible =
          visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId);
        const shouldHideEdge =
          isNodeInCollapsedPackage(edge.sourceId) ||
          isNodeInCollapsedPackage(edge.targetId);
        const obstacles = isSelfLoop
          ? []
          : [...boundsMap.entries()]
              .filter(
                ([id]) =>
                  id !== edge.sourceId && id !== edge.targetId && nonPackageIds.has(id),
              )
              .map(([, b]) => b);
        return { edge, isSelfLoop, sourceBounds, targetBounds, isVisible, shouldHideEdge, obstacles };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [shapes, edges, boundsMap, visibleNodeIds]);

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
            {gridType !== 'none' && (
              <GridPattern
                viewport={viewport}
                stageWidth={size.width}
                stageHeight={size.height}
                type={gridType as 'dots' | 'lines' | 'grid'}
              />
            )}
          </Layer>

          <Layer name="packages">
            {sortedShapes
              .filter((shape) => isPackageViewModel(shape.data))
              .map((shape) => {
                const pos = positionOverrides.get(shape.id) ?? { x: shape.x, y: shape.y };
                const vm = shape.data as PackageViewModel;
                const isVisible = visibleNodeIds.has(shape.id);
                
                let isDescendantOfCollapsed = false;
                if (shape.parentPackageId) {
                  let parentId: string | null | undefined = shape.parentPackageId;
                  while (parentId) {
                    const parentShape = shapes.find((s) => s.id === parentId);
                    if (parentShape && isPackageViewModel(parentShape.data) && parentShape.data.collapsed) {
                      isDescendantOfCollapsed = true;
                      break;
                    }
                    parentId = parentShape?.parentPackageId;
                  }
                }
                
                const dropHighlight = 
                  hoveredPackageId === shape.id 
                    ? (isHoverValid ? 'valid' : 'invalid')
                    : null;
                const pkgBounds = boundsMap.get(shape.id);
                
                return (
                  <PackageShape
                    key={shape.id}
                    viewModel={vm}
                    x={pos.x}
                    y={pos.y}
                    width={pkgBounds?.width}
                    height={pkgBounds?.height}
                    childBounds={packageChildBoundsMap.get(shape.id)}
                    selected={selectedIds.has(shape.id)}
                    dropHighlight={dropHighlight}
                    onToggleCollapse={handleToggleCollapse}
                    onResizeEnd={handlePackageResizeEnd}
                    draggable
                    onDragStart={guardedDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onNodeClick={onNodeClick}
                    onContextMenu={handleNodeContextMenu}
                    visible={isVisible && !isDescendantOfCollapsed}
                  />
                );
              })}
          </Layer>

          <Layer name="edges">
            {edgeRenderData.map(({ edge, isSelfLoop, sourceBounds, targetBounds, isVisible, shouldHideEdge, obstacles }) => (
              <KonvaEdge
                key={edge.id}
                id={edge.id}
                kind={edge.kind}
                sourceBounds={sourceBounds}
                targetBounds={targetBounds}
                isSelfLoop={isSelfLoop}
                obstacles={obstacles}
                anchorLocked={edge.anchorLocked}
                sourceHandle={edge.sourceHandle ?? undefined}
                targetHandle={edge.targetHandle ?? undefined}
                isHighlighted={highlightedEdgeIds.has(edge.id)}
                isHovered={hoveredEdgeId === edge.id}
                isDimmed={dimmedEdgeIds.has(edge.id)}
                renderMode="lines"
                onContextMenu={handleEdgeContextMenu}
                onMouseEnter={handleEdgeMouseEnter}
                onMouseLeave={handleEdgeMouseLeave}
                onDblClick={handleEdgeDblClick}
                visible={isVisible && !shouldHideEdge}
              />
            ))}
          </Layer>

          <Layer name="nodes">
            {sortedShapes
              .filter((shape) => !isPackageViewModel(shape.data))
              .map((shape) => {
                const pos = positionOverrides.get(shape.id) ?? { x: shape.x, y: shape.y };
                const vm = shape.data;
                const isVisible = visibleNodeIds.has(shape.id);
                
                let isDescendantOfCollapsed = false;
                if (shape.parentPackageId) {
                  let parentId: string | null | undefined = shape.parentPackageId;
                  while (parentId) {
                    const parentShape = shapes.find((s) => s.id === parentId);
                    if (parentShape && isPackageViewModel(parentShape.data) && parentShape.data.collapsed) {
                      isDescendantOfCollapsed = true;
                      break;
                    }
                    parentId = parentShape?.parentPackageId;
                  }
                }
                
                const onDblClick = isNoteViewModel(vm)
                  ? (e: KonvaEventObject<MouseEvent>) => handleNoteDblClick(shape.id, e)
                  : isUseCaseViewModel(vm)
                  ? () => handleUseCaseDblClickModal(shape.id)
                  : isNodeViewModel(vm)
                  ? (e: KonvaEventObject<MouseEvent>) => handleClassDblClick(shape.id, e)
                  : () => (vm as AnyNodeViewModel & { onOpenProps?: () => void }).onOpenProps?.();

                const onContextMenu = isUseCaseViewModel(vm)
                  ? (e: KonvaEventObject<PointerEvent>, nodeId: string) => {
                      setUcHover(null);
                      if (ucHoverTimer.current) { clearTimeout(ucHoverTimer.current); ucHoverTimer.current = null; }
                      handleNodeContextMenu(e, nodeId);
                    }
                  : handleNodeContextMenu;

                return renderShape(vm, {
                  key: shape.id,
                  x: pos.x,
                  y: pos.y,
                  selected: selectedIds.has(shape.id),
                  draggable: true,
                  visible: isVisible && !isDescendantOfCollapsed,
                  onDragStart: guardedDragStart,
                  onDragMove: handleDragMove,
                  onDragEnd: handleDragEnd,
                  onNodeClick,
                  onDblClick,
                  onContextMenu,
                  onMouseEnter: handleUseCaseMouseEnter,
                  onMouseLeave: handleUseCaseMouseLeave,
                  onResizeEnd: isUCModuleViewModel(vm)
                    ? handleUCModuleResizeEnd
                    : handleSystemBoundaryResizeEnd,
                  isDropTarget: hoveredPackageId === shape.id,
                });
              })}
          </Layer>

          {/* Edge labels rendered above nodes so they're never occluded by node shapes */}
          <Layer name="edge-labels">
            {edgeRenderData.map(({ edge, isSelfLoop, sourceBounds, targetBounds, isVisible, shouldHideEdge, obstacles }) => (
              <KonvaEdge
                key={edge.id + '-lbl'}
                id={edge.id}
                kind={edge.kind}
                sourceBounds={sourceBounds}
                targetBounds={targetBounds}
                isSelfLoop={isSelfLoop}
                obstacles={obstacles}
                anchorLocked={edge.anchorLocked}
                sourceHandle={edge.sourceHandle ?? undefined}
                targetHandle={edge.targetHandle ?? undefined}
                label={edge.label}
                sourceMultiplicity={edge.sourceMultiplicity}
                targetMultiplicity={edge.targetMultiplicity}
                sourceRole={edge.sourceRole}
                targetRole={edge.targetRole}
                condition={edge.condition}
                isHighlighted={highlightedEdgeIds.has(edge.id)}
                isHovered={hoveredEdgeId === edge.id}
                isDimmed={dimmedEdgeIds.has(edge.id)}
                renderMode="labels"
                onDblClick={handleEdgeDblClick}
                visible={isVisible && !shouldHideEdge}
              />
            ))}
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
              if (isPackageViewModel(vm)) {
                return (
                  <PackageShape
                    key={'ghost-' + ghost.id}
                    viewModel={vm}
                    x={ghost.x}
                    y={ghost.y}
                    opacity={0.3}
                  />
                );
              }
              return renderShape(vm, {
                key: 'ghost-' + ghost.id,
                x: ghost.x,
                y: ghost.y,
                opacity: 0.3,
              });
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

      {showMiniMap && (
        <MiniMap
          shapes={sortedShapes}
          boundsMap={boundsMap}
          viewport={viewport}
          stageWidth={size.width}
          stageHeight={size.height}
        />
      )}

      {PackageDropPicker}

      <DuplicateFileModal
        isOpen={duplicateModal.isOpen}
        fileName={duplicateModal.fileName}
        onReplace={duplicateModal.onReplace}
        onCancel={duplicateModal.onCancel}
        onDontShowAgain={duplicateModal.onDontShowAgain}
      />

      {hierarchyModal.isOpen && (
        <PackageHierarchyModal
          packageFullPath={hierarchyModal.packageFullPath}
          parentPath={hierarchyModal.parentPath}
          classCount={hierarchyModal.classCount}
          subPackageCount={hierarchyModal.subPackageCount}
          onPlaceSimple={hierarchyModal.onPlaceSimple}
          onPlaceHierarchy={hierarchyModal.onPlaceHierarchy}
          onCancel={hierarchyModal.onCancel}
        />
      )}

      <NoteEditorModal
        isOpen={!!noteEditorModal}
        initialTitle={noteEditorModal?.initialTitle ?? ''}
        initialContent={noteEditorModal?.initialContent ?? ''}
        onClose={() => setNoteEditorModal(null)}
        onSave={(title, content) => {
          noteEditorModal?.onSave(title, content);
          setNoteEditorModal(null);
        }}
      />

      <ConfirmationModal
        isOpen={clearCanvasModal}
        title={t('modals.confirmation.clearCanvasTitle') || 'Clear Canvas'}
        message={t('modals.confirmation.clearCanvasMessage') || 'Are you sure you want to remove all elements from this diagram? This action cannot be undone.'}
        onConfirm={clearCanvas}
        onCancel={() => setClearCanvasModal(false)}
      />

      <DeletePackageModal
        isOpen={deletePackageModal.isOpen}
        packageName={deletePackageModal.packageName}
        hasClasses={deletePackageModal.hasClasses}
        classCount={deletePackageModal.classCount}
        onConfirm={(deleteClasses) => {
          deletePackageFromModel(deletePackageModal.packageId, deletePackageModal.packageName, deleteClasses);
          setDeletePackageModal({ isOpen: false, packageName: '', packageId: '', viewNodeId: '', hasClasses: false, classCount: 0 });
        }}
        onCancel={() => {
          setDeletePackageModal({ isOpen: false, packageName: '', packageId: '', viewNodeId: '', hasClasses: false, classCount: 0 });
        }}
        isDark={theme === 'dark'}
        t={t}
      />

      <CullingWarningModal
        isOpen={cullingWarningOpen}
        nodeCount={shapes.length}
        onEnable={() => {
          toggleViewportCulling();
          setCullingWarningOpen(false);
        }}
        onDismiss={() => setCullingWarningOpen(false)}
        onDontShowAgain={() => {
          setSuppressCullingWarning(true);
          setCullingWarningOpen(false);
        }}
      />

      {/* ── Use Case hover popover (non-blocking DOM overlay) ─────────────── */}
      {ucHover && (() => {
        const activeModel = vfsController.isStandalone
          ? vfsController.localModel
          : useModelStore.getState().model;
        const uc = activeModel?.useCases?.[ucHover.elementId];
        if (!uc) return null;
        return (
          <UseCaseHoverPopover
            uc={uc}
            screenX={ucHover.screenX}
            screenY={ucHover.screenY}
            onClose={() => setUcHover(null)}
            onMouseEnter={cancelPopoverHide}
            onMouseLeave={() => { ucHoverHideTimer.current = setTimeout(() => setUcHover(null), 500); }}
            onOpenSpec={() => {
              setUcHover(null);
              useUiStore.getState().openUseCaseSpec(ucHover.elementId);
            }}
          />
        );
      })()}

      <UseCaseSpecModal />
      <ActorPropsModal />
      <ExtendEdgePropsModal />
      <DomainEntityPropsModal />
      <DomainAssociationPropsModal />
    </div>
  );
}