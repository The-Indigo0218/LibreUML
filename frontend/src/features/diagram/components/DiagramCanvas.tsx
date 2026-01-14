import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  useDiagramStore,
  checkCollision,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "../../../store/diagramStore";
import UmlClassNode from "./nodes/UmlClassNode";
import UmlNoteNode from "./nodes/UmlNoteNode";
import ContextMenu from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
import { useState, useCallback, useRef, useEffect } from "react";
import ClassEditorModal from "./ClassEditorModal";
import type { stereotype } from "../../../types/diagram.types";

import { canvasConfig, miniMapColors } from "../../../config/theme.config";

const nodeTypes = {
  umlClass: UmlClassNode,
  umlNote: UmlNoteNode,
};

export default function DiagramCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    duplicateNode,
    clearCanvas,
    updateNodeData,
    showMiniMap
  } = useDiagramStore();

  const { screenToFlowPosition } = useReactFlow();
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const rawPos = screenToFlowPosition({ x: clientX, y: clientY });
      return {
        x: rawPos.x - NODE_WIDTH / 2,
        y: rawPos.y - NODE_HEIGHT / 2,
      };
    },
    [screenToFlowPosition]
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const position = getCenteredPosition(event.clientX, event.clientY);
      const isColliding = checkCollision(position, nodesRef.current);
      event.dataTransfer.dropEffect = isColliding ? "none" : "move";
    },
    [getCenteredPosition]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as stereotype;
      if (!type) return;

      const position = getCenteredPosition(event.clientX, event.clientY);
      if (checkCollision(position, nodesRef.current)) {
        console.warn("Collision detected");
        return;
      }
      addNode(position, type);
    },
    [addNode, getCenteredPosition]
  );

  const { menu, onPaneContextMenu, onNodeContextMenu, closeMenu } = useContextMenu();
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const editingNode = nodes.find((n) => n.id === editingNodeId);

  const menuOptions = menu?.type === "pane"
      ? [
          { label: "Add Class", onClick: () => addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "class") },
          { label: "Add Interface", onClick: () => addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "interface") },
          { label: "Add Abstract Class", onClick: () => addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "abstract") },
          { label: "Clean Canvas", onClick: () => clearCanvas(), danger: true },
        ]
      : [
          { label: "Duplicate", onClick: () => menu?.nodeId && duplicateNode(menu.nodeId) },
          { label: "Edit Properties", onClick: () => { if (menu?.nodeId) { setEditingNodeId(menu.nodeId); setIsModalOpen(true); } } },
          { label: "Delete", onClick: () => menu?.nodeId && deleteNode(menu.nodeId), danger: true },
        ];

  return (
    <div className="w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color={canvasConfig.gridColor} 
          style={{ opacity: canvasConfig.gridOpacity }}
        />

        <Controls 
          className="shadow-xl rounded-md overflow-hidden border border-surface-border bg-surface-primary" 
        >

           <style>{`
             .react-flow__controls-button {
                background-color: transparent !important;
                border-bottom: 1px solid #2A3358 !important;
                fill: #AAB0C5 !important;
             }
             .react-flow__controls-button:hover {
                background-color: #1C2440 !important;
                fill: #E6E9F2 !important;
             }
             .react-flow__controls-button:last-child {
                border-bottom: none !important;
             }
           `}</style>
        </Controls>

        {showMiniMap && (
          <MiniMap 
            style={{ height: 120, width: 180 }} 
            zoomable 
            pannable 
            className="shadow-2xl rounded-lg overflow-hidden border border-surface-border bg-surface-primary !bottom-4 !right-4"
            maskColor="rgba(11, 15, 26, 0.7)" 
            nodeColor={(node) => {
               if (node.type === 'umlNote') return miniMapColors.note;
               if (node.data.stereotype === 'interface') return miniMapColors.interface;
               if (node.data.stereotype === 'abstract') return miniMapColors.abstract;
               return miniMapColors.class;
            }}
          />
        )}
      </ReactFlow>

      {menu && <ContextMenu x={menu.x} y={menu.y} options={menuOptions} onClose={closeMenu} />}
      
      {isModalOpen && editingNode && (
        <ClassEditorModal
          key={editingNodeId}
          isOpen={isModalOpen}
          umlData={editingNode.data}
          onClose={() => { setIsModalOpen(false); setEditingNodeId(null); }}
          onSave={(newData) => { updateNodeData(editingNode.id, newData); setIsModalOpen(false); setEditingNodeId(null); }}
        />
      )}
    </div>
  );
}