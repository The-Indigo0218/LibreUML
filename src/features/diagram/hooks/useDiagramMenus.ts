import { useCallback } from "react";
import { useReactFlow } from "reactflow";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../store/uiStore";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { standaloneModelOps, getLocalModel, ensureLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "./useVFSCanvasController";
import { getNextVFSName } from "./useDiagramDnD";
import type { DiagramView, ViewNode, VFSFile } from "../../../core/domain/vfs/vfs.types";

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
  onDeleteNode: (nodeId: string) => void;
  onDeleteNodeFromModel: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onReverseEdge: (edgeId: string) => void;
  onChangeEdgeKind: (edgeId: string, kind: string) => void;
  onAddToProject: (nodeId: string) => void;
  /** Returns the semantic kind ('CLASS', 'INTERFACE', etc.) of a node by its ReactFlow ID. */
  getVFSNodeKind: (nodeId: string) => string | undefined;
  /** Returns true if the node's IR element has isExternal: true. */
  getIsNodeExternal: (nodeId: string) => boolean;
  /** Resolves a ReactFlow ViewNode.id to its semantic elementId. */
  getElementId: (nodeId: string) => string | undefined;
  /** True when the active diagram is a standalone .luml file (no project). */
  isStandalone?: boolean;
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
  onAddToProject,
  getVFSNodeKind,
  getIsNodeExternal,
  getElementId,
  isStandalone = false,
}: UseDiagramMenusProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const { t } = useTranslation();

  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator);

  // ── VFS node creation for pane context menu ─────────────────────────────────

  const addVFSNode = useCallback(
    (kind: 'CLASS' | 'ABSTRACT_CLASS' | 'INTERFACE' | 'ENUM' | 'NOTE', position: { x: number; y: number }) => {
      const tabId = useWorkspaceStore.getState().activeTabId;
      if (!tabId) return;

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return;
      const fileNode = freshProject.nodes[tabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      const freshContent = (fileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return;
      const freshView = freshContent as DiagramView;

      const isStandaloneFile = (fileNode as VFSFile).standalone === true;
      let semanticId = '';

      if (kind === 'NOTE') {
        // Notes have no semantic backing
      } else if (isStandaloneFile) {
        ensureLocalModel(tabId);
        const localM = getLocalModel(tabId);
        if (!localM) return;
        const ops = standaloneModelOps(tabId);
        switch (kind) {
          case 'CLASS':
            semanticId = ops.createClass({ name: getNextVFSName(Object.values(localM.classes).filter(c => !c.isAbstract).map(c => c.name), 'Class'), attributeIds: [], operationIds: [] });
            break;
          case 'ABSTRACT_CLASS':
            semanticId = ops.createAbstractClass({ name: getNextVFSName(Object.values(localM.classes).filter(c => !!c.isAbstract).map(c => c.name), 'Abstract'), attributeIds: [], operationIds: [] });
            break;
          case 'INTERFACE':
            semanticId = ops.createInterface({ name: getNextVFSName(Object.values(localM.interfaces).map(i => i.name), 'Interface'), operationIds: [] });
            break;
          case 'ENUM':
            semanticId = ops.createEnum({ name: getNextVFSName(Object.values(localM.enums).map(e => e.name), 'Enum'), literals: [] });
            break;
        }
      } else {
        const ms = useModelStore.getState();
        if (!ms.model) ms.initModel(freshProject.domainModelId ?? crypto.randomUUID());
        const model = useModelStore.getState().model!;
        const isExternalFile = !!(fileNode as VFSFile).isExternal;
        switch (kind) {
          case 'CLASS':
            semanticId = ms.createClass({ name: getNextVFSName(Object.values(model.classes).filter(c => !c.isAbstract).map(c => c.name), 'Class'), attributeIds: [], operationIds: [], ...(isExternalFile ? { isExternal: true } : {}) });
            break;
          case 'ABSTRACT_CLASS':
            semanticId = ms.createAbstractClass({ name: getNextVFSName(Object.values(model.classes).filter(c => !!c.isAbstract).map(c => c.name), 'Abstract'), attributeIds: [], operationIds: [], ...(isExternalFile ? { isExternal: true } : {}) });
            break;
          case 'INTERFACE':
            semanticId = ms.createInterface({ name: getNextVFSName(Object.values(model.interfaces).map(i => i.name), 'Interface'), operationIds: [], ...(isExternalFile ? { isExternal: true } : {}) });
            break;
          case 'ENUM':
            semanticId = ms.createEnum({ name: getNextVFSName(Object.values(model.enums).map(e => e.name), 'Enum'), literals: [], ...(isExternalFile ? { isExternal: true } : {}) });
            break;
        }
      }

      const viewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId: semanticId,
        x: position.x,
        y: position.y,
      };

      useVFSStore.getState().updateFileContent(tabId, {
        ...freshView,
        nodes: [...freshView.nodes, viewNode],
      });
    },
    [],
  );

  // ── getMenuOptions ────────────────────────────────────────────────────────

  const getMenuOptions = useCallback(
    (menu: ContextMenuState | null): { label: string; onClick: () => void; danger?: boolean }[] => {
      if (!menu) return [];

      if (menu.type === "pane") {
        return [
          {
            label: t("contextMenu.pane.addClass"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addVFSNode("CLASS", position);
            },
          },
          {
            label: t("contextMenu.pane.addInterface"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addVFSNode("INTERFACE", position);
            },
          },
          {
            label: t("contextMenu.pane.addAbstract"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addVFSNode("ABSTRACT_CLASS", position);
            },
          },
          {
            label: t("contextMenu.pane.addNote"),
            onClick: () => {
              const position = screenToFlowPosition({ x: menu.x, y: menu.y });
              addVFSNode("NOTE", position);
            },
          },
          {
            label: t("contextMenu.pane.cleanCanvas"),
            onClick: onClearCanvas,
            danger: true,
          },
        ];
      }

      if (menu.type === "node" && menu.id) {
        const nodeId = menu.id;
        const effectiveType = getVFSNodeKind(nodeId);
        const isClassType =
          effectiveType === "CLASS" ||
          effectiveType === "INTERFACE" ||
          effectiveType === "ABSTRACT_CLASS";
        const isNodeExternal = getIsNodeExternal(nodeId);

        const baseOptions: { label: string; onClick: () => void; danger?: boolean; icon?: string }[] = [
          {
            label: t("contextMenu.node.edit"),
            onClick: () => onEditNode(nodeId),
          },
        ];

        if (isClassType) {
          const resolvedId = getElementId(nodeId) ?? nodeId;
          baseOptions.push({
            label: t("contextMenu.node.generateCode"),
            icon: "code",
            onClick: () => openSingleGenerator(resolvedId),
          });

          if (onGenerateMethods) {
            baseOptions.push({
              label: t("contextMenu.node.generateMethods"),
              icon: "wand",
              onClick: () => onGenerateMethods(resolvedId),
            });
          }
        }

        if (isNodeExternal) {
          baseOptions.push({
            label: t("contextMenu.node.addToProject") || "Add to Project",
            icon: "plus",
            onClick: () => onAddToProject(nodeId),
          });
        }

        baseOptions.push({
          label: t("contextMenu.node.removeFromDiagram"),
          onClick: () => onDeleteNode(nodeId),
        });
        if (!isStandalone) {
          baseOptions.push({
            label: isNodeExternal
              ? t("contextMenu.node.removeFromCanvas")
              : t("contextMenu.node.deleteFromModel"),
            onClick: () => onDeleteNodeFromModel(nodeId),
            danger: true,
          });
        }

        return baseOptions;
      }

      if (menu.type === "edge" && menu.id) {
        const edgeId = menu.id;

        const typeOptions = [
          {
            label: t("contextMenu.edge.toAssociation"),
            onClick: () => onChangeEdgeKind(edgeId, "ASSOCIATION"),
          },
          {
            label: t("contextMenu.edge.toInheritance"),
            onClick: () => onChangeEdgeKind(edgeId, "INHERITANCE"),
          },
          {
            label: t("contextMenu.edge.toImplementation"),
            onClick: () => onChangeEdgeKind(edgeId, "IMPLEMENTATION"),
          },
          {
            label: t("contextMenu.edge.toDependency"),
            onClick: () => onChangeEdgeKind(edgeId, "DEPENDENCY"),
          },
          {
            label: t("contextMenu.edge.toAggregation"),
            onClick: () => onChangeEdgeKind(edgeId, "AGGREGATION"),
          },
          {
            label: t("contextMenu.edge.toComposition"),
            onClick: () => onChangeEdgeKind(edgeId, "COMPOSITION"),
          },
        ];

        return [
          {
            label: t("contextMenu.edge.reverse"),
            onClick: () => onReverseEdge(edgeId),
          },
          ...typeOptions,
          {
            label: t("contextMenu.edge.delete"),
            onClick: () => onDeleteEdge(edgeId),
            danger: true,
          },
        ];
      }

      return [];
    },
    [
      addVFSNode,
      onDeleteNode,
      onDeleteNodeFromModel,
      onDeleteEdge,
      onReverseEdge,
      onChangeEdgeKind,
      onClearCanvas,
      onEditNode,
      onEditEdgeMultiplicity,
      screenToFlowPosition,
      openSingleGenerator,
      onGenerateMethods,
      onAddToProject,
      getVFSNodeKind,
      getIsNodeExternal,
      getElementId,
      isStandalone,
      t,
    ]
  );

  return { getMenuOptions };
};
