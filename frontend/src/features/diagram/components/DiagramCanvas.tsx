import ReactFlow, { Background, Controls, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import { useDiagramStore } from "../../../store/diagramStore";
import UmlClassNode from "./nodes/UmlClassNode";
import ContextMenu from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
import { useState, useCallback } from "react";
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as stereotype;
      if (typeof type === "undefined" || !type) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(position, type);
    },
    [addNode, screenToFlowPosition]
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
