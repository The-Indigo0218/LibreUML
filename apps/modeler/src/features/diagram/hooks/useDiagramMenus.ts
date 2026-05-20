import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../store/uiStore";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { standaloneModelOps, getLocalModel, ensureLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "./useVFSCanvasController";
import { getNextVFSName } from "../../../canvas/hooks/useKonvaDnD";
import { undoTransaction } from "../../../core/undo/undoBridge";
import { SB_DEFAULT_W, SB_DEFAULT_H } from "../../../canvas/shapes/SystemBoundaryShape";
import { UCM_DEFAULT_W, UCM_DEFAULT_H } from "../../../canvas/shapes/UCModuleShape";
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
  onEditNote: (nodeId: string) => void;
  onClearCanvas: () => void;
  onEditEdgeMultiplicity: (edgeId: string) => void;
  onGenerateMethods?: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteNodeFromModel: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onReverseEdge: (edgeId: string) => void;
  onChangeEdgeKind: (edgeId: string, kind: string) => void;
  onAddToProject: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  /** Returns the semantic kind ('CLASS', 'INTERFACE', etc.) of a node by its ViewNode.id. */
  getVFSNodeKind: (nodeId: string) => string | undefined;
  /** Returns true if the node's IR element has isExternal: true. */
  getIsNodeExternal: (nodeId: string) => boolean;
  /** Resolves a ViewNode.id to its semantic elementId. */
  getElementId: (nodeId: string) => string | undefined;
  /** True when the active diagram is a standalone .luml file (no project). */
  isStandalone?: boolean;
  /** Active diagram type — drives which pane-menu options are shown. */
  diagramType?: string;
  /** Converts screen-space {x,y} to canvas/world-space coordinates. */
  screenToCanvas: (screen: { x: number; y: number }) => { x: number; y: number };
}

export const useDiagramMenus = ({
  onEditNode,
  onEditNote,
  onClearCanvas,
  onEditEdgeMultiplicity,
  onGenerateMethods,
  onDeleteNode,
  onDeleteNodeFromModel,
  onDeleteEdge,
  onReverseEdge,
  onChangeEdgeKind,
  onAddToProject,
  onDuplicateNode,
  getVFSNodeKind,
  getIsNodeExternal,
  getElementId,
  isStandalone = false,
  diagramType,
  screenToCanvas,
}: UseDiagramMenusProps) => {
  const isUseCaseDiagram = diagramType === 'USE_CASE_DIAGRAM';
  const isDomainModelDiagram = diagramType === 'DOMAIN_MODEL_DIAGRAM';
  const { t } = useTranslation();

  const openSingleGenerator = useUiStore((s) => s.openSingleGenerator);

  // ── VFS node creation for pane context menu ─────────────────────────────────

  const addVFSNode = useCallback(
    (kind: 'CLASS' | 'ABSTRACT_CLASS' | 'INTERFACE' | 'ENUM' | 'NOTE' | 'ACTOR' | 'USE_CASE' | 'SYSTEM_BOUNDARY' | 'UC_MODULE' | 'DOMAIN_ENTITY', position: { x: number; y: number }) => {
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
          case 'ACTOR': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(localM.actors ?? {}).map(a => a.name), 'Actor');
            undoTransaction({ label: `Create Actor: ${name}`, scope: tabId, mutations: [{ store: 'vfs', mutate: (draft: any) => {
              const n = draft.project?.nodes[tabId]; if (!n || n.type !== 'FILE') return;
              n.localModel.actors = n.localModel.actors ?? {};
              n.localModel.actors[newId] = { id: newId, name, kind: 'ACTOR' };
              n.localModel.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'USE_CASE': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(localM.useCases ?? {}).map(uc => uc.name), 'UseCase');
            undoTransaction({ label: `Create UseCase: ${name}`, scope: tabId, mutations: [{ store: 'vfs', mutate: (draft: any) => {
              const n = draft.project?.nodes[tabId]; if (!n || n.type !== 'FILE') return;
              n.localModel.useCases = n.localModel.useCases ?? {};
              n.localModel.useCases[newId] = { id: newId, name, kind: 'USECASE', extensionPoints: [] };
              n.localModel.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'SYSTEM_BOUNDARY': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(localM.systemBoundaries ?? {}).map(sb => sb.name), 'System');
            undoTransaction({ label: `Create System: ${name}`, scope: tabId, mutations: [{ store: 'vfs', mutate: (draft: any) => {
              const n = draft.project?.nodes[tabId]; if (!n || n.type !== 'FILE') return;
              n.localModel.systemBoundaries = n.localModel.systemBoundaries ?? {};
              n.localModel.systemBoundaries[newId] = { id: newId, name, kind: 'SYSTEM_BOUNDARY' };
              n.localModel.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'UC_MODULE': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(localM.ucModules ?? {}).map(m => m.name), 'Module');
            undoTransaction({ label: `Create Module: ${name}`, scope: tabId, mutations: [{ store: 'vfs', mutate: (draft: any) => {
              const n = draft.project?.nodes[tabId]; if (!n || n.type !== 'FILE') return;
              n.localModel.ucModules = n.localModel.ucModules ?? {};
              n.localModel.ucModules[newId] = { id: newId, name, kind: 'UC_MODULE' };
              n.localModel.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'DOMAIN_ENTITY': {
            const ops = standaloneModelOps(tabId);
            semanticId = ops.createDomainEntity({ name: getNextVFSName(Object.values(localM.domainEntities ?? {}).map(e => e.name), 'Entity'), attributeIds: [] });
            break;
          }
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
          case 'ACTOR': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(model.actors ?? {}).map(a => a.name), 'Actor');
            undoTransaction({ label: `Create Actor: ${name}`, scope: 'global', mutations: [{ store: 'model', mutate: (draft: any) => {
              if (!draft.model) return;
              draft.model.actors = draft.model.actors ?? {};
              draft.model.actors[newId] = { id: newId, name, kind: 'ACTOR' };
              draft.model.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'USE_CASE': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(model.useCases ?? {}).map(uc => uc.name), 'UseCase');
            undoTransaction({ label: `Create UseCase: ${name}`, scope: 'global', mutations: [{ store: 'model', mutate: (draft: any) => {
              if (!draft.model) return;
              draft.model.useCases = draft.model.useCases ?? {};
              draft.model.useCases[newId] = { id: newId, name, kind: 'USECASE', extensionPoints: [] };
              draft.model.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'SYSTEM_BOUNDARY': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(model.systemBoundaries ?? {}).map(sb => sb.name), 'System');
            undoTransaction({ label: `Create System: ${name}`, scope: 'global', mutations: [{ store: 'model', mutate: (draft: any) => {
              if (!draft.model) return;
              draft.model.systemBoundaries = draft.model.systemBoundaries ?? {};
              draft.model.systemBoundaries[newId] = { id: newId, name, kind: 'SYSTEM_BOUNDARY' };
              draft.model.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'UC_MODULE': {
            const newId = crypto.randomUUID();
            const name = getNextVFSName(Object.values(model.ucModules ?? {}).map(m => m.name), 'Module');
            undoTransaction({ label: `Create Module: ${name}`, scope: 'global', mutations: [{ store: 'model', mutate: (draft: any) => {
              if (!draft.model) return;
              draft.model.ucModules = draft.model.ucModules ?? {};
              draft.model.ucModules[newId] = { id: newId, name, kind: 'UC_MODULE' };
              draft.model.updatedAt = Date.now();
            }}] });
            semanticId = newId; break;
          }
          case 'DOMAIN_ENTITY': {
            semanticId = ms.createDomainEntity({ name: getNextVFSName(Object.values(model.domainEntities ?? {}).map(e => e.name), 'Entity'), attributeIds: [] });
            break;
          }
        }
      }

      const viewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId: semanticId,
        x: position.x,
        y: position.y,
        ...(kind === 'NOTE' ? { noteTitle: 'Note', content: 'Write here more details' } : {}),
        ...(kind === 'SYSTEM_BOUNDARY' ? { width: SB_DEFAULT_W, height: SB_DEFAULT_H } : {}),
        ...(kind === 'UC_MODULE' ? { width: UCM_DEFAULT_W, height: UCM_DEFAULT_H } : {}),
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
        const pos = () => screenToCanvas({ x: menu.x, y: menu.y });
        if (isUseCaseDiagram) {
          return [
            { label: t("contextMenu.pane.addActor"),          onClick: () => addVFSNode("ACTOR", pos()) },
            { label: t("contextMenu.pane.addUseCase"),        onClick: () => addVFSNode("USE_CASE", pos()) },
            { label: t("contextMenu.pane.addSystemBoundary"), onClick: () => addVFSNode("SYSTEM_BOUNDARY", pos()) },
            { label: t("contextMenu.pane.addModule"),         onClick: () => addVFSNode("UC_MODULE", pos()) },
            { label: t("contextMenu.pane.addNote"),           onClick: () => addVFSNode("NOTE", pos()) },
            { label: t("contextMenu.pane.cleanCanvas"),       onClick: onClearCanvas, danger: true },
          ];
        }
        if (isDomainModelDiagram) {
          return [
            { label: t("contextMenu.pane.addDomainEntity"), onClick: () => addVFSNode("DOMAIN_ENTITY", pos()) },
            { label: t("contextMenu.pane.addNote"),         onClick: () => addVFSNode("NOTE", pos()) },
            { label: t("contextMenu.pane.cleanCanvas"),     onClick: onClearCanvas, danger: true },
          ];
        }
        return [
          {
            label: t("contextMenu.pane.addClass"),
            onClick: () => addVFSNode("CLASS", pos()),
          },
          {
            label: t("contextMenu.pane.addInterface"),
            onClick: () => addVFSNode("INTERFACE", pos()),
          },
          {
            label: t("contextMenu.pane.addAbstract"),
            onClick: () => addVFSNode("ABSTRACT_CLASS", pos()),
          },
          {
            label: t("contextMenu.pane.addNote"),
            onClick: () => addVFSNode("NOTE", pos()),
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
        const isPackageType = effectiveType === "PACKAGE";
        const isNoteType = effectiveType === "NOTE";
        const isUseCaseNodeType =
          effectiveType === "ACTOR" ||
          effectiveType === "USECASE" ||
          effectiveType === "SYSTEM_BOUNDARY" ||
          effectiveType === "UC_MODULE";
        const isDomainEntityType = effectiveType === "DOMAIN_ENTITY";
        const isNodeExternal = getIsNodeExternal(nodeId);

        const baseOptions: { label: string; onClick: () => void; danger?: boolean; icon?: string }[] = [];

        if (!isPackageType && !isNoteType) {
          baseOptions.push({
            label: (isUseCaseNodeType || isDomainEntityType) ? t("contextMenu.node.rename") : t("contextMenu.node.edit"),
            onClick: () => onEditNode(nodeId),
          });
        }

        if (isDomainEntityType) {
          const elementId = getElementId(nodeId);
          if (elementId) {
            baseOptions.push({
              label: t("contextMenu.node.edit"),
              onClick: () => useUiStore.getState().openDomainEntityProps(elementId),
            });
          }
        }

        if (effectiveType === "USECASE") {
          const elementId = getElementId(nodeId);
          if (elementId) {
            baseOptions.push({
              label: t("contextMenu.node.editSpecification"),
              onClick: () => useUiStore.getState().openUseCaseSpec(elementId),
            });
          }
        }

        if (effectiveType === "ACTOR") {
          const elementId = getElementId(nodeId);
          if (elementId) {
            baseOptions.push({
              label: t("contextMenu.node.editActorProperties"),
              onClick: () => useUiStore.getState().openActorProps(elementId),
            });
          }
        }

        if (isNoteType) {
          baseOptions.push({
            label: t("contextMenu.node.editNote"),
            icon: "edit",
            onClick: () => onEditNote(nodeId),
          });
        }

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

        if (!isPackageType) {
          baseOptions.push({
            label: t("contextMenu.node.duplicate") || "Duplicate",
            onClick: () => onDuplicateNode(nodeId),
          });
        }

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
            label: t("contextMenu.edge.defineMultiplicity"),
            onClick: () => onEditEdgeMultiplicity(edgeId),
          },
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
      onEditNote,
      onEditEdgeMultiplicity,
      onDuplicateNode,
      screenToCanvas,
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
