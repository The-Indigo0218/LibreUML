import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRef, useState, useEffect } from "react";

import { useDiagramStore } from "../../../../store/diagramStore";
import { canvasConfig, miniMapColors } from "../../../../config/theme.config";

// Components
import UmlClassNode from "../nodes/uml/UmlClassNode";
import UmlNoteNode from "../nodes/uml/UmlNoteNode";
import ContextMenu from "../ui/ContextMenu";
import ClassEditorModal from "../modals/ClassEditorModal";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";
import SpotlightModal from "../modals/SpotlightModal";
import CustomUmlEdge from "../edges/CustomUmlEdge";
import MultiplicityModal from "../modals/MultiplicityModal";

// Hooks
import { useContextMenu } from "../../hooks/useContextMenu";
import { useDiagramDnD } from "../../hooks/useDiagramDnD";
import { useDiagramMenus } from "../../hooks/useDiagramMenus";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useEdgeStyling } from "../../hooks/useEdgeStyling";
import { useThemeSystem } from "../../../../hooks/useThemeSystem";
import { useNodeDragging } from "../../hooks/useNodeDragging";
import { useTranslation } from "react-i18next";

const nodeTypes = {
  umlClass: UmlClassNode,
  umlNote: UmlNoteNode,
};

const edgeTypes = {
  umlEdge: CustomUmlEdge,
};

export default function DiagramCanvas() {
  // Global State
  const {
    nodes,
    edges, 
    onNodesChange,
    onEdgesChange,
    onConnect,
    clearCanvas,
    updateNodeData,
    updateEdgeData, 
    showMiniMap,
    showGrid,
    snapToGrid,
  } = useDiagramStore();

  // Local State (Modals)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Node Editing State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editingNode = nodes.find((n) => n.id === editingNodeId);

  // Edge Editing State
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const editingEdge = edges.find((e) => e.id === editingEdgeId);

  // Ref for Drag & Drop
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Functional Hooks
  useKeyboardShortcuts();
  const { displayEdges, setHoveredNodeId, setHoveredEdgeId } = useEdgeStyling();
  const { onDragOver, onDrop } = useDiagramDnD();
  
  const { getMenuOptions } = useDiagramMenus({
    onEditNode: (id) => {
      setEditingNodeId(id);
      setIsModalOpen(true);
    },
    onClearCanvas: () => setIsClearModalOpen(true),
    onEditEdgeMultiplicity: (id) => setEditingEdgeId(id),
  });

  const {
    menu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    closeMenu,
  } = useContextMenu();
  
  useThemeSystem();
  const { t } = useTranslation();

  // History Logic on Drag
  const { onNodeDragStart, onNodeDragStop } = useNodeDragging();

  return (
    <div className="w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
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

        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color={canvasConfig.gridColor}
          style={{ opacity: canvasConfig.gridOpacity }}
        />
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
              if (node.data.stereotype === "interface")
                return miniMapColors.interface;
              if (node.data.stereotype === "abstract")
                return miniMapColors.abstract;
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
        />
      )}

      {isModalOpen && editingNode && (
        <ClassEditorModal
          key={editingNodeId}
          isOpen={isModalOpen}
          umlData={editingNode.data}
          onClose={() => {
            setIsModalOpen(false);
            setEditingNodeId(null);
          }}
          onSave={(newData) => {
            updateNodeData(editingNode.id, newData);
            setIsModalOpen(false);
            setEditingNodeId(null);
          }}
        />
      )}

      {editingEdgeId && editingEdge && (
        <MultiplicityModal
          isOpen={!!editingEdgeId}
          initialSource={(editingEdge.data?.sourceMultiplicity as string) || ""}
          initialTarget={(editingEdge.data?.targetMultiplicity as string) || ""}
          onClose={() => setEditingEdgeId(null)}
          onSave={(source, target) => {
            updateEdgeData(editingEdgeId, {
              sourceMultiplicity: source,
              targetMultiplicity: target
            });
          }}
        />
      )}

      <ConfirmationModal
        isOpen={isClearModalOpen}
        title={t("modals.confirmation.clearTitle")}
        message={t("modals.confirmation.clearMessage")}
        onConfirm={() => {
          clearCanvas();
          setIsClearModalOpen(false);
        }}
        onCancel={() => setIsClearModalOpen(false)}
      />

      <SpotlightModal />
    </div>
  );
}