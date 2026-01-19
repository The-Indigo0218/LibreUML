import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";

export type ContextMenuType = "pane" | "node" | "edge";

export interface ContextMenuState {
  id?: string;
  type: ContextMenuType;
  x: number;
  y: number;
}

interface UseDiagramMenusProps {
  onEditNode: (nodeId: string) => void;
  onClearCanvas: () => void;
}

export const useDiagramMenus = ({ onEditNode, onClearCanvas }: UseDiagramMenusProps) => {
  const { screenToFlowPosition } = useReactFlow();

  const {
    addNode,
    duplicateNode,
    deleteNode,
    reverseEdge,
    changeEdgeType,
    deleteEdge,
    edges, 
  } = useDiagramStore();

  const getMenuOptions = useCallback(
    (menu: ContextMenuState | null) => {
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
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "interface"),
          },
          {
            label: "Add Abstract Class",
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "abstract"),
          },
          {
            label: "Add Note",
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "note"),
          },
          {
            label: "Clean Canvas",
            onClick: onClearCanvas,
            danger: true,
          },
        ];
      }

      if (menu.type === "node" && menu.id) {
        const nodeId = menu.id; 
        
        return [
          { 
            label: "Duplicate", 
            onClick: () => duplicateNode(nodeId) 
          },
          {
            label: "Edit Properties",
            onClick: () => onEditNode(nodeId),
          },
          { 
            label: "Delete", 
            onClick: () => deleteNode(nodeId), 
            danger: true 
          },
        ];
      }

      if (menu.type === "edge" && menu.id) {
        const edgeId = menu.id; 
        const edge = edges.find((e) => e.id === edgeId);
        
        const isNoteEdge = edge?.data?.type === 'note';

        if (isNoteEdge) {
          return [
            {
              label: "Delete Connection",
              onClick: () => deleteEdge(edgeId),
              danger: true,
            },
          ];
        }

        return [
          { label: "Reverse Direction ⇄", onClick: () => reverseEdge(edgeId) },
          {
            label: "To: Association →",
            onClick: () => changeEdgeType(edgeId, "association"),
          },
          {
            label: "To: Inheritance ▷",
            onClick: () => changeEdgeType(edgeId, "inheritance"),
          },
          {
            label: "To: Implementation ⇢",
            onClick: () => changeEdgeType(edgeId, "implementation"),
          },
          {
            label: "To: Dependency ⇢",
            onClick: () => changeEdgeType(edgeId, "dependency"),
          },
          {
            label: "Delete Connection",
            onClick: () => deleteEdge(edgeId),
            danger: true,
          },
        ];
      }

      return [];
    },
    [
      addNode,
      duplicateNode,
      deleteNode,
      reverseEdge,
      changeEdgeType,
      deleteEdge,
      edges,
      onClearCanvas,
      onEditNode,
      screenToFlowPosition,
    ]
  );

  return { getMenuOptions };
};