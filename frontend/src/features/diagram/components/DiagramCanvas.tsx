import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { useDiagramStore } from "../../../store/diagramStore";
import UmlClassNode from "./nodes/UmlClassNode";
import UmlNoteNode from "./nodes/UmlNoteNode";
import ContextMenu from "./ContextMenu";
import { useContextMenu } from "../hooks/useContextMenu";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ClassEditorModal from "./ClassEditorModal";
import type { stereotype } from "../../../types/diagram.types";
import { NODE_WIDTH, NODE_HEIGHT } from "../../../config/theme.config";
import {
  canvasConfig,
  miniMapColors,
  edgeConfig,
} from "../../../config/theme.config";
import ConfirmationModal from "../../../components/shared/ConfirmationModal";
import { checkCollision } from "../../../util/geometry";

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
    showMiniMap,
    deleteEdge,
    changeEdgeType,
    reverseEdge,
    triggerHistorySnapshot,
    recalculateNodeConnections,
  } = useDiagramStore();

  const { screenToFlowPosition } = useReactFlow();
  const nodesRef = useRef(nodes);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const temporal = useDiagramStore.temporal.getState();

  const onNodeDragStart = useCallback(() => {
    temporal.pause();
  }, [temporal]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      recalculateNodeConnections(node.id);

      temporal.resume();

      triggerHistorySnapshot();
    },
    [recalculateNodeConnections, temporal, triggerHistorySnapshot],
  );

  const displayEdges = useMemo(() => {
    if (!hoveredNodeId && !hoveredEdgeId) return edges;

    return edges.map((edge) => {
      const isConnectedToNode =
        hoveredNodeId &&
        (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
      const isHoveredEdge = hoveredEdgeId && edge.id === hoveredEdgeId;

      if (isConnectedToNode || isHoveredEdge) {
        const type = edge.data?.type || "default";

        const configTypes = edgeConfig.types as Record<
          string,
          { highlight?: string }
        >;
        const highlightColor =
          configTypes[type]?.highlight || "var(--edge-base)";

        const labelText = type.charAt(0).toUpperCase() + type.slice(1);

        return {
          ...edge,
          animated: false,
          label: isHoveredEdge ? labelText : undefined,
          labelStyle: {
            fill: highlightColor,
            fontWeight: 700,
            fontSize: 12,
            fontFamily: "monospace",
          },
          labelBgStyle: {
            fill: "#0B0F1A",
            fillOpacity: 0.9,
            stroke: highlightColor,
            strokeWidth: 1,
            rx: 4,
            ry: 4,
          },
          labelBgPadding: [8, 4] as [number, number],
          style: {
            ...edge.style,
            stroke: highlightColor,
            strokeWidth: 3,
            zIndex: 999,
          },
        };
      }

      return {
        ...edge,
        style: { ...edge.style, opacity: 0.2 },
      };
    });
  }, [edges, hoveredNodeId, hoveredEdgeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useDiagramStore.temporal.getState().redo(); // Ctrl + Shift + Z
        } else {
          useDiagramStore.temporal.getState().undo(); // Ctrl + Z
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        // Ctrl + Y
        e.preventDefault();
        useDiagramStore.temporal.getState().redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    [screenToFlowPosition],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const position = getCenteredPosition(event.clientX, event.clientY);
      const isColliding = checkCollision(position, nodesRef.current);
      event.dataTransfer.dropEffect = isColliding ? "none" : "move";
    },
    [getCenteredPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/reactflow",
      ) as stereotype;
      if (!type) return;

      const position = getCenteredPosition(event.clientX, event.clientY);
      if (checkCollision(position, nodesRef.current)) {
        console.warn("Collision detected");
        return;
      }
      addNode(position, type);
    },
    [addNode, getCenteredPosition],
  );

  const {
    menu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    closeMenu,
  } = useContextMenu();
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const editingNode = nodes.find((n) => n.id === editingNodeId);

  const getMenuOptions = () => {
    if (!menu) return [];

    if (menu.type === "pane") {
      return [
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
              "interface",
            ),
        },
        {
          label: "Add Abstract Class",
          onClick: () =>
            addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "abstract"),
        },
        {
          label: "Clean Canvas",
          onClick: () => setIsClearModalOpen(true),
          danger: true,
        },
      ];
    }

    if (menu.type === "node" && menu.id) {
      return [
        { label: "Duplicate", onClick: () => duplicateNode(menu.id!) },
        {
          label: "Edit Properties",
          onClick: () => {
            setEditingNodeId(menu.id!);
            setIsModalOpen(true);
          },
        },
        { label: "Delete", onClick: () => deleteNode(menu.id!), danger: true },
      ];
    }

    if (menu.type === "edge" && menu.id) {
      const edge = edges.find((e) => e.id === menu.id);

      const isNoteEdge = edge?.data?.type === "note";

      if (isNoteEdge) {
        return [
          {
            label: "Delete Connection",
            onClick: () => deleteEdge(menu.id!),
            danger: true,
          },
        ];
      }
      return [
        { label: "Reverse Direction ⇄", onClick: () => reverseEdge(menu.id!) },
        {
          label: "To: Association →",
          onClick: () => changeEdgeType(menu.id!, "association"),
        },
        {
          label: "To: Inheritance ▷",
          onClick: () => changeEdgeType(menu.id!, "inheritance"),
        },
        {
          label: "To: Implementation ⇢",
          onClick: () => changeEdgeType(menu.id!, "implementation"),
        },
        {
          label: "To: Dependency ⇢",
          onClick: () => changeEdgeType(menu.id!, "dependency"),
        },
        {
          label: "Delete Connection",
          onClick: () => deleteEdge(menu.id!),
          danger: true,
        },
      ];
    }

    return [];
  };

  return (
    <div className="w-full h-full bg-canvas-base">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
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
        connectionMode={ConnectionMode.Loose}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        fitView
      >
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
          options={getMenuOptions()}
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
      <ConfirmationModal
        isOpen={isClearModalOpen}
        title="Clear Entire Canvas?"
        message="This action cannot be undone. All your classes, relationships, and notes will be permanently removed."
        onConfirm={() => {
          clearCanvas();
          setIsClearModalOpen(false);
        }}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
}
