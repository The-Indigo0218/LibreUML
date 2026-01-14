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

const nodeTypes = {
  umlClass: UmlClassNode,
  umlNote: UmlNoteNode,
};

const proBackgroundConfig = {
  size: 1.5,
  gap: 20,
  color: "#94a3b8",
  style: { opacity: 0.2 },
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

      if (isColliding) {
        event.dataTransfer.dropEffect = "none";
      } else {
        event.dataTransfer.dropEffect = "move";
      }
    },
    [getCenteredPosition]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as stereotype;

      if (!type) return;

      const position = getCenteredPosition(event.clientX, event.clientY);

      if (checkCollision(position, nodesRef.current)) {
        console.warn("Cannot drop here: Collision detected");
        return;
      }

      addNode(position, type);
    },
    [addNode, getCenteredPosition]
  );

  const { menu, onPaneContextMenu, onNodeContextMenu, closeMenu } =
    useContextMenu();

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const editingNode = nodes.find((n) => n.id === editingNodeId);

  const menuOptions =
    menu?.type === "pane"
      ? [
          {
            label: "Add Class",
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "class"),
          },
          {
            label: "Add Interface",
            onClick: () =>
              addNode(
                screenToFlowPosition({ x: menu.x, y: menu.y }),
                "interface"
              ),
          },
          {
            label: "Add Abstract Class",
            onClick: () =>
              addNode(
                screenToFlowPosition({ x: menu.x, y: menu.y }),
                "abstract"
              ),
          },
          {
            label: "Clean Canvas",
            onClick: () => clearCanvas(),
            danger: true,
          },
        ]
      : [
          {
            label: "Duplicate",
            onClick: () => {
              if (menu?.nodeId) duplicateNode(menu.nodeId);
            },
          },
          {
            label: "Edit Properties",
            onClick: () => {
              if (menu?.nodeId) {
                setEditingNodeId(menu.nodeId);
                setIsModalOpen(true);
              }
            },
          },
          {
            label: "Delete",
            onClick: () => {
              if (menu?.nodeId) deleteNode(menu.nodeId);
            },
            danger: true,
          },
        ];

  return (
    <div className="w-full h-full bg-slate-50/50">
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
          gap={proBackgroundConfig.gap}
          size={proBackgroundConfig.size}
          color={proBackgroundConfig.color}
          style={proBackgroundConfig.style}
        />

        <Controls className="bg-white border border-slate-200 shadow-sm" />

       {showMiniMap && (
          <MiniMap 
            style={{ height: 100, width: 150 }} 
            zoomable 
            pannable 
            className="border border-slate-200 shadow-sm rounded-lg overflow-hidden bg-white"
            nodeColor={(node) => {
               if (node.type === 'umlNote') return '#fef08a';
               if (node.data.stereotype === 'interface') return '#d8b4fe';
               if (node.data.stereotype === 'abstract') return '#bfdbfe';
               return '#e2e8f0';
            }}
          />
        )}
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          options={menuOptions}
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
    </div>
  );
}
