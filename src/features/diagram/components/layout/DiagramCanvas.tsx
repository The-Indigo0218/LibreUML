import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRef, useEffect, useCallback, useMemo } from "react";
import { useUiStore } from "../../../../store/uiStore";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useSelectionStore } from "../../../../store/selection.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useModelStore } from "../../../../store/model.store";
import { useToastStore } from "../../../../store/toast.store";
import { canvasConfig, miniMapColors } from "../../../../config/theme.config";
import { getDiagramRegistry } from "../../../../core/registry/diagram-registry";
import type { RelationKind } from "../../../../core/domain/vfs/vfs.types";

import ContextMenu from "../ui/ContextMenu";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";
import SpotlightModal from "../modals/SpotlightModal";
import VfsEdgeActionModal from "../modals/VfsEdgeActionModal";
import { AutoLayoutLockedWarningModal } from "../modals/AutoLayoutLockedWarningModal";
import MethodGeneratorModal from "../modals/MethodGeneratorModal";

import { GetStartedWidget } from "../ui/GetStartedWidget";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useDiagramDnD } from "../../hooks/useDiagramDnD";
import { useHospitalTemplate } from "../../hooks/useHospitalTemplate";
import { useVFSCanvasController } from "../../hooks/useVFSCanvasController";
import { useDiagramMenus } from "../../hooks/useDiagramMenus";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useVFSEdgeStyling } from "../../hooks/useVFSEdgeStyling";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useNodeDragging } from "../../hooks/useNodeDragging";
import { useTranslation } from "react-i18next";

export default function DiagramCanvas() {
  const { t } = useTranslation();

  const vfsController = useVFSCanvasController();

  const nodes = vfsController.nodes;
  const isCanvasReady = vfsController.isVFSFile;
  const activeTabId = vfsController.activeTabId;

  // ── Get-Started widget ──────────────────────────────────────────────────────
  const isGetStartedOpen = useUiStore((s) => s.isGetStartedOpen);
  const openGetStarted = useUiStore((s) => s.openGetStarted);
  const { loadTemplate } = useHospitalTemplate();
  const prevTabIdRef = useRef<string | null>(null);

  // Auto-open widget when switching to an empty diagram tab
  useEffect(() => {
    if (prevTabIdRef.current !== activeTabId) {
      prevTabIdRef.current = activeTabId;
      if (isCanvasReady && nodes.length === 0) {
        openGetStarted();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const handleLoadTemplate = useCallback(() => {
    loadTemplate();
  }, [loadTemplate]);

  const registry = useMemo(() => {
    const vfsDiagramType = vfsController.vfsFile?.diagramType;
    const effectiveType =
      vfsDiagramType === 'CLASS_DIAGRAM' || vfsDiagramType === 'USE_CASE_DIAGRAM'
        ? vfsDiagramType
        : 'CLASS_DIAGRAM';
    try {
      return getDiagramRegistry(effectiveType);
    } catch {
      return getDiagramRegistry('CLASS_DIAGRAM');
    }
  }, [vfsController.vfsFile]);

  const nodeTypes = useMemo(() => registry.nodeComponents, [registry]);
  const edgeTypes = useMemo(() => registry.edgeComponents, [registry]);

  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const snapToGrid = useSettingsStore((s) => s.snapToGrid);

  const {
    activeModal,
    editingId,
    openClearConfirmation,
    openMethodGenerator,
    openSSoTClassEditor,
    openVfsEdgeAction,
    closeModals
  } = useUiStore();

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useKeyboardShortcuts();
  
  // Pass editingId to highlight the edge when modal is open
  const modalEdgeId = activeModal === 'vfs-edge-action' ? editingId : null;
  const { styledEdges: vfsStyledEdges, setHoveredNodeId: setVFSHoveredNodeId, setHoveredEdgeId: setVFSHoveredEdgeId } = useVFSEdgeStyling(vfsController.edges, modalEdgeId);
  const { onDragOver, onDrop } = useDiagramDnD();

  const setSelection = useSelectionStore((s) => s.setSelection);
  const clearSelection = useSelectionStore((s) => s.clear);
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelection(
        selNodes.map((n) => n.id),
        selEdges.map((e) => e.id),
      );
    },
    [setSelection],
  );

  // Clear selection when switching tabs — stale IDs from previous diagram are meaningless.
  useEffect(() => {
    clearSelection();
  }, [vfsController.activeTabId, clearSelection]);

  const clearCanvas = useCallback(() => {
    if (vfsController.diagramView && vfsController.activeTabId) {
      useVFSStore.getState().updateFileContent(vfsController.activeTabId, {
        ...vfsController.diagramView,
        nodes: [],
        edges: [],
      });
    }
  }, [vfsController]);

  const VFS_TYPE_TO_RELATION_KIND: Record<string, RelationKind> = {
    ASSOCIATION: "ASSOCIATION",
    INHERITANCE: "GENERALIZATION",
    IMPLEMENTATION: "REALIZATION",
    DEPENDENCY: "DEPENDENCY",
    AGGREGATION: "AGGREGATION",
    COMPOSITION: "COMPOSITION",
  };

  const { getMenuOptions } = useDiagramMenus({
    onEditNode: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find(
        (vn) => vn.id === nodeId,
      );
      if (viewNode?.elementId) openSSoTClassEditor(viewNode.elementId);
    },
    onClearCanvas: () => openClearConfirmation(),
    onEditEdgeMultiplicity: (id) => openVfsEdgeAction(id),
    onGenerateMethods: (id) => openMethodGenerator(id),
    onDeleteNode: vfsController.removeNodeFromDiagram,
    onDeleteNodeFromModel: vfsController.deleteElementFromModel,
    onDeleteEdge: vfsController.deleteEdgeById,
    onReverseEdge: vfsController.reverseEdgeById,
    onChangeEdgeKind: (edgeId, legacyType) => {
      const kind =
        VFS_TYPE_TO_RELATION_KIND[legacyType] ??
        (legacyType as RelationKind);
      vfsController.changeEdgeKind(edgeId, kind);
    },
    onAddToProject: (nodeId) => {
      const viewNode = vfsController.diagramView?.nodes.find(
        (vn) => vn.id === nodeId,
      );
      if (!viewNode?.elementId) return;
      const ms = useModelStore.getState();
      const elementName =
        ms.model?.classes[viewNode.elementId]?.name ??
        ms.model?.interfaces[viewNode.elementId]?.name ??
        ms.model?.enums[viewNode.elementId]?.name ??
        'Element';
      ms.integrateExternalElement(viewNode.elementId);
      useToastStore.getState().show(`"${elementName}" added to project model`);
    },
    getVFSNodeKind: (nodeId: string) => {
      const viewNode = vfsController.diagramView?.nodes.find(
        (vn) => vn.id === nodeId,
      );
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
    getIsNodeExternal: (nodeId: string) => {
      if (vfsController.isStandalone) return false;
      const viewNode = vfsController.diagramView?.nodes.find(
        (vn) => vn.id === nodeId,
      );
      if (!viewNode?.elementId) return false;
      const ms = useModelStore.getState();
      if (!ms.model) return false;
      return !!(
        ms.model.classes[viewNode.elementId]?.isExternal ||
        ms.model.interfaces[viewNode.elementId]?.isExternal ||
        ms.model.enums[viewNode.elementId]?.isExternal
      );
    },
    getElementId: (nodeId: string) =>
      vfsController.diagramView?.nodes.find((vn) => vn.id === nodeId)
        ?.elementId,
    isStandalone: vfsController.isStandalone,
  });

  const {
    menu,
    onPaneContextMenu,
    onNodeContextMenu,
    closeMenu,
  } = useContextMenu();
  
  useThemeSystem();
  
  const { onNodeDragStart, onNodeDragStop } = useNodeDragging();

  if (!isCanvasReady) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-canvas-base">
        <div className="text-gray-400">{t("canvas.loading") || "Loading diagram..."}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={vfsStyledEdges as Edge[]}
        onNodesChange={vfsController.onNodesChange}
        onEdgesChange={vfsController.onEdgesChange}
        onConnect={vfsController.onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeMouseEnter={(_, node) => { setVFSHoveredNodeId(node.id); }}
        onNodeMouseLeave={() => { setVFSHoveredNodeId(null); }}
        onEdgeMouseEnter={(_, edge) => { setVFSHoveredEdgeId(edge.id); }}
        onEdgeMouseLeave={() => { setVFSHoveredEdgeId(null); }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          e.stopPropagation();
          openVfsEdgeAction(edge.id);
        }}
        onSelectionChange={handleSelectionChange}
        onPaneClick={closeMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        fitView
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color={canvasConfig.gridColor}
            style={{ opacity: canvasConfig.gridOpacity }}
          />
        )}
        <Controls className="shadow-xl rounded-md overflow-hidden border border-surface-border bg-surface-primary" />

        {showMiniMap && (
          <MiniMap
            style={{ height: 120, width: 180 }}
            zoomable
            pannable
            className="shadow-2xl rounded-lg overflow-hidden border border-surface-border bg-surface-primary bottom-4! right-4!"
            maskColor="rgba(11, 15, 26, 0.7)"
            nodeColor={(node) => {
              if (node.type === "umlNote") return miniMapColors.note;
              const domainType = node.data.type;
              if (domainType === "INTERFACE") return miniMapColors.interface;
              if (domainType === "ABSTRACT_CLASS") return miniMapColors.abstract;
              return miniMapColors.class;
            }}
          />
        )}
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          options={getMenuOptions(menu)}
          onClose={closeMenu}
          centered={menu.type === "node"}
        />
      )}

      <ConfirmationModal
        isOpen={activeModal === 'clear-confirmation'}
        title={t("modals.confirmation.clearTitle")}
        message={t("modals.confirmation.clearMessage")}
        onConfirm={() => {
          clearCanvas();
          closeModals();
        }}
        onCancel={closeModals}
      />


      <MethodGeneratorModal
        isOpen={activeModal === 'method-generator'}
        nodeId={editingId}
        onClose={closeModals}
      />

      <VfsEdgeActionModal />
      <AutoLayoutLockedWarningModal />

      <SpotlightModal />

      {isGetStartedOpen && (
        <GetStartedWidget onLoadTemplate={handleLoadTemplate} />
      )}
    </div>
  );
}