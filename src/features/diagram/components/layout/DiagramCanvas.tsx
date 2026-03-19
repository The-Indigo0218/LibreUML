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
import { useProjectStore } from "../../../../store/project.store";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useVFSStore } from "../../../../store/vfs.store";
import { useDiagram } from "../../../workspace/hooks/useDiagram";
import { canvasConfig, miniMapColors } from "../../../../config/theme.config";
import { getDiagramRegistry } from "../../../../core/registry/diagram-registry";
import type { RelationKind } from "../../../../core/domain/vfs/vfs.types";
import type { AssociationEdge, AggregationEdge, CompositionEdge } from "../../../../core/domain/models/edges";
import type { ClassDiagramMetadata } from "../../../../core/domain/workspace/diagram-file.types";

import ContextMenu from "../ui/ContextMenu";
import ClassEditorModal from "../modals/ClassEditorModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";
import SpotlightModal from "../modals/SpotlightModal";
import MultiplicityModal from "../modals/MultiplicityModal";
import MethodGeneratorModal from "../modals/MethodGeneratorModal";

import { useContextMenu } from "../../hooks/useContextMenu";
import { useDiagramDnD } from "../../hooks/useDiagramDnD";
import { useVFSCanvasController } from "../../hooks/useVFSCanvasController";
import { useDiagramMenus } from "../../hooks/useDiagramMenus";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useEdgeStyling } from "../../hooks/useEdgeStyling";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useNodeDragging } from "../../hooks/useNodeDragging";
import { useTranslation } from "react-i18next";
import ExportModal from "../modals/ExportModal";
import SingleClassGeneratorModal from "../modals/SingleClassGeneratorModal";
import ProjectGeneratorModal from "../modals/ProjectGeneratorModal";
import ImportCodeModal from "../modals/ImportCodeModal";

export default function DiagramCanvas() {
  const { t } = useTranslation();

  const {
    nodes: legacyNodes,
    edges: _edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    file,
    isReady,
  } = useDiagram();

  const vfsController = useVFSCanvasController();

  const nodes = vfsController.isVFSFile ? vfsController.nodes : legacyNodes;
  const isCanvasReady = isReady || vfsController.isVFSFile;

  const diagramType = file?.diagramType ?? 'CLASS_DIAGRAM';
  const registry = useMemo(() => {
    const vfsDiagramType = vfsController.vfsFile?.diagramType;
    const effectiveType =
      vfsDiagramType === 'CLASS_DIAGRAM' || vfsDiagramType === 'USE_CASE_DIAGRAM'
        ? vfsDiagramType
        : diagramType;
    try {
      return getDiagramRegistry(effectiveType);
    } catch {
      return getDiagramRegistry('CLASS_DIAGRAM');
    }
  }, [diagramType, vfsController.vfsFile]);

  const nodeTypes = useMemo(() => registry.nodeComponents, [registry]);
  const edgeTypes = useMemo(() => registry.edgeComponents, [registry]);

  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const snapToGrid = useSettingsStore((s) => s.snapToGrid);

  const updateNode = useProjectStore((s) => s.updateNode);
  const updateEdge = useProjectStore((s) => s.updateEdge);
  const getNode = useProjectStore((s) => s.getNode);
  const getEdge = useProjectStore((s) => s.getEdge);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);

  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  const {
    activeModal,
    editingId,
    openClassEditor,
    openMultiplicityEditor,
    openClearConfirmation,
    openMethodGenerator,
    openSSoTClassEditor,
    closeModals
  } = useUiStore();

  const editingNode = editingId ? getNode(editingId) : undefined;
  const editingEdge = editingId ? getEdge(editingId) : undefined;

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const effectiveOnNodesChange = vfsController.isVFSFile
    ? vfsController.onNodesChange
    : onNodesChange;

  const effectiveOnEdgesChange = vfsController.isVFSFile
    ? vfsController.onEdgesChange
    : onEdgesChange;

  const effectiveOnConnect = vfsController.isVFSFile
    ? vfsController.onConnect
    : onConnect;

  useKeyboardShortcuts();
  const { displayEdges, setHoveredNodeId, setHoveredEdgeId } = useEdgeStyling();
  const { onDragOver, onDrop } = useDiagramDnD();

  const clearCanvas = useCallback(() => {
    if (vfsController.isVFSFile && vfsController.diagramView && vfsController.activeTabId) {
      useVFSStore.getState().updateFileContent(vfsController.activeTabId, {
        ...vfsController.diagramView,
        nodes: [],
        edges: [],
      });
      return;
    }

    if (!file) return;

    const nodeIds = [...file.nodeIds];
    const edgeIds = [...file.edgeIds];

    edgeIds.forEach((edgeId) => {
      removeEdgeFromFile(file.id, edgeId);
      removeEdge(edgeId);
    });

    nodeIds.forEach((nodeId) => {
      removeNodeFromFile(file.id, nodeId);
      removeNode(nodeId);
    });

    updateFile(file.id, {
      metadata: {
        ...(file.metadata as ClassDiagramMetadata | undefined),
        positionMap: {},
      } as ClassDiagramMetadata,
    });

    markFileDirty(file.id);
  }, [vfsController, file, removeEdgeFromFile, removeEdge, removeNodeFromFile, removeNode, updateFile, markFileDirty]);

  const VFS_TYPE_TO_RELATION_KIND: Record<string, RelationKind> = {
    ASSOCIATION: "ASSOCIATION",
    INHERITANCE: "GENERALIZATION",
    IMPLEMENTATION: "REALIZATION",
    DEPENDENCY: "DEPENDENCY",
    AGGREGATION: "AGGREGATION",
    COMPOSITION: "COMPOSITION",
  };

  const { getMenuOptions } = useDiagramMenus({
    onEditNode: vfsController.isVFSFile
      ? (nodeId) => {
          const viewNode = vfsController.diagramView?.nodes.find(
            (vn) => vn.id === nodeId,
          );
          if (viewNode?.elementId) openSSoTClassEditor(viewNode.elementId);
        }
      : (id) => openClassEditor(id),
    onClearCanvas: () => openClearConfirmation(),
    onEditEdgeMultiplicity: (id) => openMultiplicityEditor(id),
    onGenerateMethods: (id) => openMethodGenerator(id),
    onDeleteNode: vfsController.isVFSFile
      ? vfsController.removeNodeFromDiagram
      : undefined,
    onDeleteNodeFromModel: vfsController.isVFSFile
      ? vfsController.deleteElementFromModel
      : undefined,
    onDeleteEdge: vfsController.isVFSFile
      ? vfsController.deleteEdgeById
      : undefined,
    onReverseEdge: vfsController.isVFSFile
      ? vfsController.reverseEdgeById
      : undefined,
    onChangeEdgeKind: vfsController.isVFSFile
      ? (edgeId, legacyType) => {
          const kind =
            VFS_TYPE_TO_RELATION_KIND[legacyType] ??
            (legacyType as RelationKind);
          vfsController.changeEdgeKind(edgeId, kind);
        }
      : undefined,
  });

  const {
    menu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
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
    <div className="w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={(vfsController.isVFSFile ? vfsController.edges : displayEdges) as Edge[]}
        onNodesChange={effectiveOnNodesChange}
        onEdgesChange={effectiveOnEdgesChange}
        onConnect={effectiveOnConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
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

      {activeModal === 'class-editor' && editingNode && (
        <ClassEditorModal
          key={editingId}
          isOpen={true}
          umlData={
            editingNode.type === 'CLASS' ||
            editingNode.type === 'INTERFACE' ||
            editingNode.type === 'ABSTRACT_CLASS'
              ? {
                  label: editingNode.name,
                  generics: editingNode.generics,
                  attributes: editingNode.type !== 'INTERFACE' ? editingNode.attributes : [],
                  methods: editingNode.methods,
                  stereotype: 
                    editingNode.type === 'CLASS' ? 'class' : 
                    editingNode.type === 'INTERFACE' ? 'interface' : 'abstract',
                  package: editingNode.package,
                }
              : editingNode.type === 'ENUM'
              ? {
                  label: editingNode.name,
                  attributes: [],
                  methods: [],
                  stereotype: 'enum',
                  package: editingNode.package,
                }
              : {
                  label: '',
                  attributes: [],
                  methods: [],
                  stereotype: 'class',
                }
          }
          onClose={closeModals}
          onSave={(newData) => {
            if (editingNode.type === 'CLASS' || editingNode.type === 'ABSTRACT_CLASS') {
              updateNode(editingNode.id, {
                name: newData.label,
                generics: newData.generics,
                attributes: newData.attributes,
                methods: newData.methods,
                package: newData.package,
              });
            } else if (editingNode.type === 'INTERFACE') {
              updateNode(editingNode.id, {
                name: newData.label,
                generics: newData.generics,
                methods: newData.methods,
                package: newData.package,
              });
            } else if (editingNode.type === 'ENUM') {
              updateNode(editingNode.id, {
                name: newData.label,
                package: newData.package,
              });
            }
            closeModals();
          }}
        />
      )}

      {activeModal === 'multiplicity-editor' && editingEdge && (
        <MultiplicityModal
          isOpen={true}
          initialSource={
            (editingEdge.type === 'ASSOCIATION' ||
             editingEdge.type === 'AGGREGATION' ||
             editingEdge.type === 'COMPOSITION')
              ? (editingEdge as AssociationEdge | AggregationEdge | CompositionEdge).sourceMultiplicity ?? ""
              : ""
          }
          initialTarget={
            (editingEdge.type === 'ASSOCIATION' ||
             editingEdge.type === 'AGGREGATION' ||
             editingEdge.type === 'COMPOSITION')
              ? (editingEdge as AssociationEdge | AggregationEdge | CompositionEdge).targetMultiplicity ?? ""
              : ""
          }
          onClose={closeModals}
          onSave={(source, target) => {
            updateEdge(editingEdge.id, {
              sourceMultiplicity: source,
              targetMultiplicity: target,
            } as Partial<AssociationEdge>);
            closeModals();
          }}
        />
      )}

      <SingleClassGeneratorModal 
        isOpen={activeModal === 'engineering-single'}
        onClose={closeModals}
      />

      <ProjectGeneratorModal
        isOpen={activeModal === 'engineering-project'}
        onClose={closeModals}
      />

      <ExportModal 
        isOpen={activeModal === 'export-modal'}
        onClose={closeModals}
      />

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

      <ImportCodeModal 
        isOpen={activeModal === 'import-code'}
        onClose={closeModals}
      />

      <MethodGeneratorModal
        isOpen={activeModal === 'method-generator'}
        nodeId={editingId}
        onClose={closeModals}
      />

      <SpotlightModal />
    </div>
  );
}