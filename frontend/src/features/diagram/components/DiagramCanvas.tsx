import ReactFlow, { Background, Controls, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import {
  useDiagramStore,
  checkCollision,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "../../../store/diagramStore";
import UmlClassNode from "./nodes/UmlClassNode";
import ContextMenu from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
import { useState, useCallback, useRef, useEffect } from "react";
import ClassEditorModal from "./ClassEditorModal";
import type { stereotype } from "../../../types/diagram.types";

const nodeTypes = { umlClass: UmlClassNode };
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
    <div className="w-full h-full">
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
        fitView
      >
        <Background />
        <Controls />
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
