import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../../../store/diagramStore";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
            label: t('contextMenu.pane.addClass'),
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "class"),
          },
          {
            label: t('contextMenu.pane.addInterface'),
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "interface"),
          },
          {
            label: t('contextMenu.pane.addAbstract'),
            onClick: () =>
              addNode(screenToFlowPosition({ x: menu.x, y: menu.y }), "abstract"),
          },
          {
            label: t('contextMenu.pane.addNote'),
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
            label: t('contextMenu.node.duplicate'), 
            onClick: () => duplicateNode(nodeId) 
          },
          {
            label: t('contextMenu.node.editProperties'),
            onClick: () => onEditNode(nodeId),
          },
          { 
            label: t('contextMenu.node.delete'), 
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
              label: t('contextMenu.edge.deleteConnection'),
              onClick: () => deleteEdge(edgeId),
              danger: true,
            },
          ];
        }

        return [
          { label: t('contextMenu.edge.reverseDirection'), onClick: () => reverseEdge(edgeId) },
          {
            label: t('contextMenu.edge.toAssociation'),
            onClick: () => changeEdgeType(edgeId, "association"),
          },
          {
            label: t('contextMenu.edge.toInheritance'),
            onClick: () => changeEdgeType(edgeId, "inheritance"),
          },
          {
            label: t('contextMenu.edge.toImplementation'),
            onClick: () => changeEdgeType(edgeId, "implementation"),
          },
          {
            label: t('contextMenu.edge.toDependency'),
            onClick: () => changeEdgeType(edgeId, "dependency"),
          },
          {
            label: t('contextMenu.edge.deleteConnection'),
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
      t
    ]
  );

  return { getMenuOptions };
};