import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../../store/project.store";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useUiStore } from "../../../store/uiStore";
import { useDiagram } from "../../workspace/hooks/useDiagram";
import type { DomainEdge } from "../../../core/domain/models/edges";

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
  onGenerateMethods?: (nodeId: string) => void;
  /** VFS-aware view-only removal. Removes the node from this diagram only. */
  onDeleteNode?: (nodeId: string) => void;
  /** VFS-aware full cascade. Deletes semantic element from model + all diagrams. */
  onDeleteNodeFromModel?: (nodeId: string) => void;
  /** VFS-aware edge delete override. When provided, replaces the legacy ProjectStore deleteEdge path. */
  onDeleteEdge?: (edgeId: string) => void;
  /** VFS-aware edge reverse override. When provided, replaces the legacy ProjectStore reverseEdge path. */
  onReverseEdge?: (edgeId: string) => void;
  /**
   * VFS-aware edge kind change override.
   * Receives the ReactFlow edge ID and the legacy type string (e.g. 'INHERITANCE').
   * The caller is responsible for translating to IRRelation.kind if needed.
   */
  onChangeEdgeKind?: (edgeId: string, kind: string) => void;
}

export const useDiagramMenus = ({
  onEditNode,
  onClearCanvas,
  onEditEdgeMultiplicity,
  onGenerateMethods,
  onDeleteNode,
  onDeleteNodeFromModel,
  onDeleteEdge,
  onReverseEdge,
  onChangeEdgeKind,
}: UseDiagramMenusProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const { t } = useTranslation();

  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator);

  const { addNodeToDiagram, file, registry } = useDiagram();
  const getNode = useProjectStore((s) => s.getNode);
  const addNode = useProjectStore((s) => s.addNode);
  const getEdge = useProjectStore((s) => s.getEdge);
  const removeNode = useProjectStore((s) => s.removeNode);
  const removeEdge = useProjectStore((s) => s.removeEdge);
  const updateEdge = useProjectStore((s) => s.updateEdge);
  const getEdgeIdsForNode = useProjectStore((s) => s.getEdgeIdsForNode);
  const addNodeToFile = useWorkspaceStore((s) => s.addNodeToFile);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const removeNodeFromFile = useWorkspaceStore((s) => s.removeNodeFromFile);
  const removeEdgeFromFile = useWorkspaceStore((s) => s.removeEdgeFromFile);
  const markFileDirty = useWorkspaceStore((s) => s.markFileDirty);

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!file) return;

      // Get edge IDs BEFORE removing the node (cascade delete will remove edges from ProjectStore)
      const connectedEdgeIds = getEdgeIdsForNode(nodeId);

      // Remove from WorkspaceStore
      removeNodeFromFile(file.id, nodeId);
      connectedEdgeIds.forEach((edgeId) => {
        removeEdgeFromFile(file.id, edgeId);
      });

      // Remove from ProjectStore (cascade delete handles edges automatically)
      removeNode(nodeId);
      markFileDirty(file.id);
    },
    [file, getEdgeIdsForNode, removeEdgeFromFile, removeNodeFromFile, removeNode, markFileDirty]
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      if (!file || !registry) return;

      const originalNode = getNode(nodeId);
      if (!originalNode) return;

      // Create a new node with the same type
      const newNode = registry.factories.createNode(originalNode.type);

      // Copy all properties from original node except id, createdAt, updatedAt
      const duplicatedNode = {
        ...originalNode,
        id: newNode.id,
        createdAt: newNode.createdAt,
        updatedAt: newNode.updatedAt,
        name: `${(originalNode as any).name}_copy`,
      } as any;

      // Add node to ProjectStore
      addNode(duplicatedNode);

      // Add node to file
      addNodeToFile(file.id, newNode.id);

      // Get original position and offset it
      const metadata = file.metadata as any;
      const positionMap = metadata?.positionMap || {};
      const originalPosition = positionMap[nodeId] || { x: 0, y: 0 };

      const newPositionMap = {
        ...positionMap,
        [newNode.id]: {
          x: originalPosition.x + 50,
          y: originalPosition.y + 50,
        },
      };

      // Update file with new position
      updateFile(file.id, {
        metadata: {
          ...file.metadata,
          positionMap: newPositionMap,
        } as any,
      });

      markFileDirty(file.id);
    },
    [file, registry, getNode, addNode, addNodeToFile, updateFile, markFileDirty]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (!file) return;

      removeEdgeFromFile(file.id, edgeId);
      removeEdge(edgeId);
      markFileDirty(file.id);
    },
    [file, removeEdgeFromFile, removeEdge, markFileDirty]
  );

  const reverseEdge = useCallback(
    (edgeId: string) => {
      const edge = getEdge(edgeId);
      if (!edge) return;

      updateEdge(edgeId, {
        sourceNodeId: edge.targetNodeId,
        targetNodeId: edge.sourceNodeId,
      });

      if (file) {
        markFileDirty(file.id);
      }
    },
    [getEdge, updateEdge, file, markFileDirty]
  );

  const changeEdgeType = useCallback(
    (edgeId: string, newType: string) => {
      const edge = getEdge(edgeId);
      if (!edge) return;

      updateEdge(edgeId, {
        type: newType as DomainEdge['type'],
      });

      if (file) {
        markFileDirty(file.id);
      }
    },
    [getEdge, updateEdge, file, markFileDirty]
  );

  const getMenuOptions = useCallback(
    (menu: ContextMenuState | null): { label: string; onClick: () => void; danger?: boolean }[] => {
      if (!menu) return [];

      if (menu.type === "pane") {
        return [
          {
            label: t("contextMenu.pane.addClass"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addNodeToDiagram("CLASS", position);
            },
          },
          {
            label: t("contextMenu.pane.addInterface"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addNodeToDiagram("INTERFACE", position);
            },
          },
          {
            label: t("contextMenu.pane.addAbstract"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addNodeToDiagram("ABSTRACT_CLASS", position);
            },
          },
          {
            label: t("contextMenu.pane.addNote"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addNodeToDiagram("NOTE", position);
            },
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
        const node = getNode(nodeId);
        const isClassType = node?.type === "CLASS" || node?.type === "INTERFACE" || node?.type === "ABSTRACT_CLASS";

        const baseOptions: { label: string; onClick: () => void; danger?: boolean }[] = [
          {
            label: t("contextMenu.node.duplicate"),
            onClick: () => duplicateNode(nodeId),
          },
          {
            label: t("contextMenu.node.edit"),
            onClick: () => onEditNode(nodeId),
          },
        ];

        if (isClassType) {
          baseOptions.push({
            label: t("contextMenu.node.generateCode"),
            onClick: () => openSingleGenerator(nodeId),
          });

          if (onGenerateMethods) {
            baseOptions.push({
              label: t("contextMenu.node.generateMethods"),
              onClick: () => onGenerateMethods(nodeId),
            });
          }
        }

        if (onDeleteNodeFromModel) {
          // VFS mode: separate "Remove from Diagram" (view-only) and "Delete from Model" (cascade).
          baseOptions.push({
            label: t("contextMenu.node.removeFromDiagram") || "Remove from Diagram",
            onClick: () => onDeleteNode!(nodeId),
          });
          baseOptions.push({
            label: t("contextMenu.node.deleteFromModel") || "Delete from Model",
            onClick: () => onDeleteNodeFromModel(nodeId),
            danger: true,
          });
        } else {
          baseOptions.push({
            label: t("contextMenu.node.delete"),
            onClick: () => (onDeleteNode ?? deleteNode)(nodeId),
          });
        }

        return baseOptions;
      }

      if (menu.type === "edge" && menu.id) {
        const edgeId = menu.id;

        // VFS path: overrides provided — build menu from VFS callbacks directly.
        if (onDeleteEdge) {
          const typeOptions = [
            {
              label: t("contextMenu.edge.toAssociation"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "ASSOCIATION"),
            },
            {
              label: t("contextMenu.edge.toInheritance"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "INHERITANCE"),
            },
            {
              label: t("contextMenu.edge.toImplementation"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "IMPLEMENTATION"),
            },
            {
              label: t("contextMenu.edge.toDependency"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "DEPENDENCY"),
            },
            {
              label: t("contextMenu.edge.toAggregation"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "AGGREGATION"),
            },
            {
              label: t("contextMenu.edge.toComposition"),
              onClick: () => (onChangeEdgeKind ?? changeEdgeType)(edgeId, "COMPOSITION"),
            },
          ];

          return [
            {
              label: t("contextMenu.edge.reverse"),
              onClick: () => (onReverseEdge ?? reverseEdge)(edgeId),
            },
            ...typeOptions,
            {
              label: t("contextMenu.edge.delete"),
              onClick: () => onDeleteEdge(edgeId),
              danger: true,
            },
          ];
        }

        // Legacy path: use ProjectStore.
        const edge = getEdge(edgeId);
        const type = edge?.type || "ASSOCIATION";
        const isNoteEdge = type === "NOTE_LINK";

        if (isNoteEdge) {
          return [
            {
              label: t("contextMenu.edge.delete"),
              onClick: () => deleteEdge(edgeId),
              danger: true,
            },
          ];
        }

        const supportsMultiplicity = ["ASSOCIATION", "AGGREGATION", "COMPOSITION"].includes(type);

        const multiplicityOptions = supportsMultiplicity
          ? [
              {
                label: t("contextMenu.edge.defineMultiplicity"),
                onClick: () => onEditEdgeMultiplicity(edgeId),
              },
            ]
          : [];

        const baseOptions = [
          {
            label: t("contextMenu.edge.reverse"),
            onClick: () => reverseEdge(edgeId),
          },
        ];

        const typeOptions = [
          {
            label: t("contextMenu.edge.toAssociation"),
            onClick: () => changeEdgeType(edgeId, "ASSOCIATION"),
          },
          {
            label: t("contextMenu.edge.toInheritance"),
            onClick: () => changeEdgeType(edgeId, "INHERITANCE"),
          },
          {
            label: t("contextMenu.edge.toImplementation"),
            onClick: () => changeEdgeType(edgeId, "IMPLEMENTATION"),
          },
          {
            label: t("contextMenu.edge.toDependency"),
            onClick: () => changeEdgeType(edgeId, "DEPENDENCY"),
          },
          {
            label: t("contextMenu.edge.toAggregation"),
            onClick: () => changeEdgeType(edgeId, "AGGREGATION"),
          },
          {
            label: t("contextMenu.edge.toComposition"),
            onClick: () => changeEdgeType(edgeId, "COMPOSITION"),
          },
        ];

        return [
          ...baseOptions,
          ...multiplicityOptions,
          ...typeOptions,
          {
            label: t("contextMenu.edge.delete"),
            onClick: () => deleteEdge(edgeId),
            danger: true,
          },
        ];
      }

      return [];
    },
    [
      addNodeToDiagram,
      duplicateNode,
      deleteNode,
      onDeleteNode,
      onDeleteNodeFromModel,
      reverseEdge,
      changeEdgeType,
      deleteEdge,
      onDeleteEdge,
      onReverseEdge,
      onChangeEdgeKind,
      getNode,
      getEdge,
      onClearCanvas,
      onEditNode,
      onEditEdgeMultiplicity,
      screenToFlowPosition,
      openSingleGenerator,
      onGenerateMethods,
      t,
    ]
  );

  return { getMenuOptions };
};
