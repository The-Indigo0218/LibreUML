import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "../../../store/diagramStore";
import { useUiStore } from "../../../store/uiStore"; 
import type { UmlRelationType } from "../types/diagram.types";

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
  onEditEdgeMultiplicity: (edgeId: string) => void;
}

export const useDiagramMenus = ({ 
  onEditNode, 
  onClearCanvas, 
  onEditEdgeMultiplicity 
}: UseDiagramMenusProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const { t } = useTranslation();
  
  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator);

  const {
    addNode,
    duplicateNode,
    deleteNode,
    reverseEdge,
    changeEdgeType,
    deleteEdge,
    edges,
    nodes, 
  } = useDiagramStore();

  const getMenuOptions = useCallback(
    (menu: ContextMenuState | null) => {
      if (!menu) return [];

      // Pane Menu
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

      // Node Menu
      if (menu.type === "node" && menu.id) {
        const nodeId = menu.id; 
        
        const node = nodes.find(n => n.id === nodeId);
        const isClassType = node?.type === 'umlClass';

        const baseOptions = [
          { 
            label: t('contextMenu.node.duplicate'), 
            onClick: () => duplicateNode(nodeId) 
          },
          {
            label: t('contextMenu.node.edit'),
            onClick: () => onEditNode(nodeId),
          },
        ];

        if (isClassType) {
            baseOptions.push({
                label: t('contextMenu.node.generateCode'),
                onClick: () => openSingleGenerator(nodeId),
            });
        }

        baseOptions.push({ 
            label: t('contextMenu.node.delete'), 
            onClick: () => deleteNode(nodeId), 
        });

        return baseOptions;
      }

      // Edge Menu
      if (menu.type === "edge" && menu.id) {
        const edgeId = menu.id; 
        const edge = edges.find((e) => e.id === edgeId);
        
        const type = (edge?.data?.type || "association") as UmlRelationType;
        
        const isNoteEdge = (type as string) === 'note';

        if (isNoteEdge) {
          return [
            {
              label: t('contextMenu.edge.delete'),
              onClick: () => deleteEdge(edgeId),
              danger: true,
            },
          ];
        }

        const supportsMultiplicity = ['association', 'aggregation', 'composition'].includes(type);
        
        const multiplicityOptions = supportsMultiplicity ? [
          {
            label: t('contextMenu.edge.defineMultiplicity'),
            onClick: () => onEditEdgeMultiplicity(edgeId),
          }
        ] : [];

        const baseOptions = [
          { label: t('contextMenu.edge.reverse'), onClick: () => reverseEdge(edgeId) },
        ];

        const typeOptions = [
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
            label: t('contextMenu.edge.toAggregation'),
            onClick: () => changeEdgeType(edgeId, "aggregation"),
          },
          {
            label: t('contextMenu.edge.toComposition'),
            onClick: () => changeEdgeType(edgeId, "composition"),
          },
        ];

        return [
          ...baseOptions,
          ...multiplicityOptions,
          ...typeOptions,
          {
            label: t('contextMenu.edge.delete'),
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
      nodes, 
      onClearCanvas,
      onEditNode,
      onEditEdgeMultiplicity,
      screenToFlowPosition,
      openSingleGenerator,
      t
    ]
  );

  return { getMenuOptions };
};