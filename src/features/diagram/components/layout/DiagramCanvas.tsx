import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRef, useEffect, useCallback, useMemo } from "react"; 
import { useUiStore } from "../../../../store/uiStore"; 
import { useProjectStore } from "../../../../store/project.store";
import { useSettingsStore } from "../../../../store/settingsStore";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useDiagram } from "../../../workspace/hooks/useDiagram";
import { canvasConfig, miniMapColors } from "../../../../config/theme.config";
import { getDiagramRegistry } from "../../../../core/registry/diagram-registry";

// Components (Modals only - node/edge components now come from registry)
import ContextMenu from "../ui/ContextMenu";
import ClassEditorModal from "../modals/ClassEditorModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";
import SpotlightModal from "../modals/SpotlightModal";
import MultiplicityModal from "../modals/MultiplicityModal";
import MethodGeneratorModal from "../modals/MethodGeneratorModal";

// Hooks
import { useContextMenu } from "../../hooks/useContextMenu";
import { useDiagramDnD } from "../../hooks/useDiagramDnD";
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

  // === NEW: Use Integration Hook (SSOT Architecture) ===
  const {
    nodes,
    edges: _edges, // Renamed to indicate intentionally unused
    onNodesChange,
    onEdgesChange,
    onConnect,
    file,
    isReady,
  } = useDiagram();

  // PHASE 3: Get diagram type and registry
  const diagramType = file?.diagramType || 'CLASS_DIAGRAM';
  const registry = useMemo(() => {
    try {
      return getDiagramRegistry(diagramType);
    } catch (error) {
      console.error('Failed to get diagram registry:', error);
      return getDiagramRegistry('CLASS_DIAGRAM'); // Fallback
    }
  }, [diagramType]);

  // PHASE 3: Extract node and edge components from registry
  const nodeTypes = useMemo(() => registry.nodeComponents, [registry]);
  const edgeTypes = useMemo(() => registry.edgeComponents, [registry]);

  // === Settings (UI Preferences from SettingsStore) ===
  const showMiniMap = useSettingsStore((s) => s.showMiniMap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const snapToGrid = useSettingsStore((s) => s.snapToGrid);

  // === Domain Data Accessors (ProjectStore) ===
  const updateNode = useProjectStore((s) => s.updateNode);
  const updateEdge = useProjectStore((s) => s.updateEdge);
  const getNode = useProjectStore((s) => s.getNode);
  const getEdge = useProjectStore((s) => s.getEdge);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);

  // === Workspace Actions ===
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  // --- UI STATE (Modals & Interactions) ---
  const { 
    activeModal, 
    editingId, 
    openClassEditor, 
    openMultiplicityEditor, 
    openClearConfirmation,
    openMethodGenerator,
    closeModals 
  } = useUiStore();

  // === Fetch editing entities from ProjectStore ===
  const editingNode = editingId ? getNode(editingId) : undefined;
  const editingEdge = editingId ? getEdge(editingId) : undefined;

  // Ref for Drag & Drop
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Functional Hooks
  useKeyboardShortcuts();
  const { displayEdges, setHoveredNodeId, setHoveredEdgeId } = useEdgeStyling();
  const { onDragOver, onDrop } = useDiagramDnD();

  const clearCanvas = useCallback(() => {
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
        ...file.metadata,
        positionMap: {},
      } as any,
    });

    markFileDirty(file.id);
  }, [file, removeEdgeFromFile, removeEdge, removeNodeFromFile, removeNode, updateFile, markFileDirty]);

  const { getMenuOptions } = useDiagramMenus({
    onEditNode: (id) => openClassEditor(id),
    onClearCanvas: () => openClearConfirmation(),
    onEditEdgeMultiplicity: (id) => openMultiplicityEditor(id),
    onGenerateMethods: (id) => openMethodGenerator(id),
  });

  const {
    menu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    closeMenu,
  } = useContextMenu();
  
  useThemeSystem();
  
  // History Logic on Drag
  const { onNodeDragStart, onNodeDragStop } = useNodeDragging();

  // === Loading State ===
  if (!isReady) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-canvas-base">
        <div className="text-gray-400">{t("canvas.loading") || "Loading diagram..."}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes as any}
        edges={displayEdges as any}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // Hover Interaction
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        // Context Menus
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={closeMenu}
        // Drag & Drop
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
              // Note: node.type in ReactFlow view is the component type (umlClass, umlNote)
              // node.data contains the domain node data
              if (node.type === "umlNote") return miniMapColors.note;
              
              // Access domain node type from node.data
              const domainType = (node.data as any)?.type;
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
            // Map domain node to modal's expected format
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
            // Map modal data back to domain node structure
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
              ? (editingEdge as any).sourceMultiplicity || ""
              : ""
          }
          initialTarget={
            (editingEdge.type === 'ASSOCIATION' || 
             editingEdge.type === 'AGGREGATION' || 
             editingEdge.type === 'COMPOSITION')
              ? (editingEdge as any).targetMultiplicity || ""
              : ""
          }
          onClose={closeModals}
          onSave={(source, target) => {
            updateEdge(editingEdge.id, {
              sourceMultiplicity: source,
              targetMultiplicity: target,
            } as any);
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