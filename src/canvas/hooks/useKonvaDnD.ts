import { useCallback, useState } from 'react';
import type Konva from 'konva';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toast.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
import type { DiagramView, ViewNode, VFSFile, SemanticModel } from '../../core/domain/vfs/vfs.types';
import type { stereotype } from '../../features/diagram/types/diagram.types';

export const DRAG_TYPE_NEW = 'application/libreuml-node' as const;
export const DRAG_TYPE_EXISTING = 'application/libreuml-existing-node' as const;
export const DRAG_TYPE_PACKAGE = 'application/libreuml-package' as const;

const NODE_WIDTH = 256;
const NODE_HEIGHT = 120;
export function getNextVFSName(existingNames: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
  let max = 0;
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix} ${max + 1}`;
}

interface DropConfig {
  getNextName: (model: SemanticModel) => string;
  applyToModelDraft: (modelDraft: any, id: string, name: string, isExternal?: boolean) => void;
  applyToLocalModelDraft: (lm: any, id: string, name: string) => void;
  isVisualOnly?: boolean;
}

const VFS_DROP_CONFIG: Partial<Record<stereotype, DropConfig>> = {
  class: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.classes).filter((c) => !c.isAbstract).map((c) => c.name), 'Class'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.classes[id] = { id, name, kind: 'CLASS', attributeIds: [], operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.classes[id] = { id, name, kind: 'CLASS', attributeIds: [], operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  interface: {
    getNextName: (model) => getNextVFSName(Object.values(model.interfaces).map((i) => i.name), 'Interface'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.interfaces[id] = { id, name, kind: 'INTERFACE', operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.interfaces[id] = { id, name, kind: 'INTERFACE', operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  abstract: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.classes).filter((c) => !!c.isAbstract).map((c) => c.name), 'Abstract'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.classes[id] = { id, name, kind: 'CLASS', isAbstract: true, attributeIds: [], operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.classes[id] = { id, name, kind: 'CLASS', isAbstract: true, attributeIds: [], operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  enum: {
    getNextName: (model) => getNextVFSName(Object.values(model.enums).map((e) => e.name), 'Enum'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.enums[id] = { id, name, kind: 'ENUM', literals: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.enums[id] = { id, name, kind: 'ENUM', literals: [] };
      lm.updatedAt = Date.now();
    },
  },
  note: {
    getNextName: () => 'Note',
    applyToModelDraft: () => {},
    applyToLocalModelDraft: () => {},
    isVisualOnly: true,
  },
  package: {
    getNextName: (model) => getNextVFSName(Object.values(model.packages).map((p) => p.name), 'Package'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.packages[id] = {
        id,
        name,
        kind: 'PACKAGE',
        packageIds: [],
        classIds: [],
        interfaceIds: [],
        enumIds: [],
        dataTypeIds: [],
        ...(isExternal ? { isExternal: true } : {}),
      };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.packages[id] = {
        id,
        name,
        kind: 'PACKAGE',
        packageIds: [],
        classIds: [],
        interfaceIds: [],
        enumIds: [],
        dataTypeIds: [],
      };
      lm.updatedAt = Date.now();
    },
  },
};

function getParentContent(
  parentPath: string,
  draggingPath: string,
  model: SemanticModel | null,
): { classCount: number; subPackageCount: number; siblingCount: number } {
  if (!model) return { classCount: 0, subPackageCount: 0, siblingCount: 0 };

  const classCount = [
    ...Object.values(model.classes),
    ...Object.values(model.interfaces),
    ...Object.values(model.enums),
  ].filter((el: any) => el.packageName === parentPath).length;

  const allPkgPaths = new Set([
    ...Object.values(model.packages).map((p) => p.name),
    ...(model.packageNames ?? []),
  ]);
  const directSubs = [...allPkgPaths].filter((n) => {
    if (!n.startsWith(parentPath + '.')) return false;
    return !n.slice(parentPath.length + 1).includes('.');
  });

  return {
    classCount,
    subPackageCount: directSubs.length,
    siblingCount: directSubs.filter((n) => n !== draggingPath).length,
  };
}

export interface UseKonvaDnDParams {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export interface UseKonvaDnDResult {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  duplicateModal: {
    isOpen: boolean;
    fileName: string;
    onReplace: () => void;
    onCancel: () => void;
    onDontShowAgain: (checked: boolean) => void;
  };
  hierarchyModal: {
    isOpen: boolean;
    packageFullPath: string;
    parentPath: string;
    classCount: number;
    subPackageCount: number;
    onPlaceSimple: () => void;
    onPlaceHierarchy: () => void;
    onCancel: () => void;
  };
}

export function useKonvaDnD({ stageRef }: UseKonvaDnDParams): UseKonvaDnDResult {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);
  const hideDuplicateFileWarning = useSettingsStore((s) => s.hideDuplicateFileWarning);
  const setHideDuplicateFileWarning = useSettingsStore((s) => s.setHideDuplicateFileWarning);
  const showToast = useToastStore((s) => s.show);

  const [duplicateModal, setDuplicateModal] = useState({
    isOpen: false,
    fileName: '',
    elementId: '',
    position: { x: 0, y: 0 },
  });

  const [hierarchyModal, setHierarchyModal] = useState<{
    isOpen: boolean;
    packageFullPath: string;
    parentPath: string;
    classCount: number;
    subPackageCount: number;
    position: { x: number; y: number };
    isStandaloneFile: boolean;
  }>({
    isOpen: false,
    packageFullPath: '',
    parentPath: '',
    classCount: 0,
    subPackageCount: 0,
    position: { x: 0, y: 0 },
    isStandaloneFile: false,
  });

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };

      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const containerX = clientX - rect.left;
      const containerY = clientY - rect.top;
      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();
      const canvasX = (containerX - stageX) / scale;
      const canvasY = (containerY - stageY) / scale;

      return {
        x: canvasX - NODE_WIDTH / 2,
        y: canvasY - NODE_HEIGHT / 2,
      };
    },
    [stageRef],
  );

  const getElementName = useCallback((elementId: string): string => {
    if (!activeTabId) return 'Element';

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return 'Element';
    const freshFileNode = freshProject.nodes[activeTabId];
    if (!freshFileNode || freshFileNode.type !== 'FILE') return 'Element';

    const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;

    if (isStandaloneFile) {
      const localM = getLocalModel(activeTabId);
      if (!localM) return 'Element';
      return (
        localM.classes[elementId]?.name ??
        localM.interfaces[elementId]?.name ??
        localM.enums[elementId]?.name ??
        'Element'
      );
    } else {
      const ms = useModelStore.getState();
      if (!ms.model) return 'Element';
      return (
        ms.model.classes[elementId]?.name ??
        ms.model.interfaces[elementId]?.name ??
        ms.model.enums[elementId]?.name ??
        'Element'
      );
    }
  }, [activeTabId]);

  const checkDuplicateElement = useCallback(
    (elementId: string): ViewNode | null => {
      if (!activeTabId) return null;

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return null;
      const freshFileNode = freshProject.nodes[activeTabId];
      if (!freshFileNode || freshFileNode.type !== 'FILE') return null;
      const freshContent = (freshFileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return null;
      const freshView = freshContent as DiagramView;

      return freshView.nodes.find((vn) => vn.elementId === elementId) ?? null;
    },
    [activeTabId],
  );

  const addElementToDiagram = useCallback(
    (elementId: string, position: { x: number; y: number }, replaceNodeId?: string) => {
      if (!activeTabId) return;
      const newViewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId,
        x: position.x,
        y: position.y,
      };
      withUndo('vfs', 'Add to Diagram', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        if (replaceNodeId) {
          node.content.nodes = node.content.nodes.filter((vn: ViewNode) => vn.id !== replaceNodeId);
        }
        node.content.nodes.push(newViewNode);
      });
    },
    [activeTabId, updateFileContent],
  );

  const handleModalReplace = useCallback(() => {
    const { elementId, position } = duplicateModal;
    const existingNode = checkDuplicateElement(elementId);
    if (existingNode) {
      addElementToDiagram(elementId, position, existingNode.id);
    }
    setDuplicateModal({ isOpen: false, fileName: '', elementId: '', position: { x: 0, y: 0 } });
  }, [duplicateModal, checkDuplicateElement, addElementToDiagram]);

  const handleModalCancel = useCallback(() => {
    setDuplicateModal({ isOpen: false, fileName: '', elementId: '', position: { x: 0, y: 0 } });
  }, []);

  const handleDontShowAgain = useCallback(
    (checked: boolean) => {
      if (checked) {
        setHideDuplicateFileWarning(true);
      }
    },
    [setHideDuplicateFileWarning],
  );

  const handleHierarchyCancel = useCallback(() => {
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleHierarchyPlaceSimple = useCallback(() => {
    const { packageFullPath, position, isStandaloneFile } = hierarchyModal;
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
    if (!activeTabId) return;

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return;
    const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;

    const newElementId = crypto.randomUUID();
    const newViewNodeId = crypto.randomUUID();

    // If package already exists in model, just add a view node
    if (currentModel?.packages) {
      const existingPkg =
        Object.values(currentModel.packages).find((p) => p.name === packageFullPath) ??
        Object.values(currentModel.packages).find((p) => p.name === packageFullPath.split('.').pop());
      if (existingPkg) {
        undoTransaction({
          label: `Add to canvas: ${packageFullPath}`,
          scope: isStandaloneFile ? activeTabId : 'global',
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              if (node.content.nodes.some((vn: any) => vn.elementId === existingPkg.id)) return;
              node.content.nodes.push({
                id: newViewNodeId, elementId: existingPkg.id,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            },
          }],
          affectedElementIds: [existingPkg.id],
        });
        return;
      }
    }

    if (isStandaloneFile) {
      undoTransaction({
        label: `Create Package: ${packageFullPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const node = draft.project?.nodes[activeTabId];
            if (!node || node.type !== 'FILE') return;
            if (!node.localModel) {
              const now = Date.now();
              node.localModel = {
                id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                packageNames: [],
                createdAt: now, updatedAt: now,
              };
            }
            // Ensure packageNames array exists
            if (!node.localModel.packageNames) node.localModel.packageNames = [];
            
            node.localModel.packages[newElementId] = {
              id: newElementId, name: packageFullPath, kind: 'PACKAGE',
              packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
            };
            // Remove from packageNames to avoid duplication in sidebar
            node.localModel.packageNames = node.localModel.packageNames.filter(
              (name: string) => name !== packageFullPath
            );
            node.localModel.updatedAt = Date.now();
            if (isDiagramView(node.content)) {
              node.content.nodes.push({
                id: newViewNodeId, elementId: newElementId,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            }
          },
        }],
      });
    } else {
      const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();
      undoTransaction({
        label: `Create Package: ${packageFullPath}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) {
                const now = Date.now();
                draft.model = {
                  id: domainModelId, name: 'Domain Model', version: '1.0.0',
                  packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                  attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                  objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                  packageNames: [], createdAt: now, updatedAt: now,
                };
              }
              // Ensure packageNames array exists
              if (!draft.model.packageNames) draft.model.packageNames = [];
              
              draft.model.packages[newElementId] = {
                id: newElementId, name: packageFullPath, kind: 'PACKAGE',
                packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
              };
              // Remove from packageNames to avoid duplication in sidebar
              draft.model.packageNames = draft.model.packageNames.filter(
                (name: string) => name !== packageFullPath
              );
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              node.content.nodes.push({
                id: newViewNodeId, elementId: newElementId,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            },
          },
        ],
      });
    }
  }, [hierarchyModal, activeTabId]);

  const handleHierarchyPlaceHierarchy = useCallback(() => {
    const { parentPath, position, isStandaloneFile } = hierarchyModal;
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
    if (!activeTabId) return;

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return;
    const freshFileNode = freshProject.nodes[activeTabId] as VFSFile;
    if (!freshFileNode || freshFileNode.type !== 'FILE') return;
    if (!isDiagramView(freshFileNode.content)) return;

    const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
    if (!currentModel) return;

    // Layout constants
    const PAD = 40;
    const TAB_H = 24;
    const EL_W = 256;
    const EL_H = 120;
    const EL_GAP_X = 20;
    const EL_GAP_Y = 20;
    const COLS = 3;
    const PKG_GAP = 20;

    // Collect elements
    const parentElements: Array<{ id: string }> = [
      ...Object.values(currentModel.classes).filter((c) => c.packageName === parentPath),
      ...Object.values(currentModel.interfaces).filter((i) => i.packageName === parentPath),
      ...Object.values(currentModel.enums).filter((e) => e.packageName === parentPath),
    ];

    const allPkgPaths = new Set([
      ...Object.values(currentModel.packages).map((p) => p.name),
      ...(currentModel.packageNames ?? []),
    ]);
    const directSubPkgPaths = [...allPkgPaths]
      .filter((n) => {
        if (!n.startsWith(parentPath + '.')) return false;
        return !n.slice(parentPath.length + 1).includes('.');
      })
      .sort();

    const subPkgElements = new Map<string, Array<{ id: string }>>();
    for (const subPkgPath of directSubPkgPaths) {
      subPkgElements.set(subPkgPath, [
        ...Object.values(currentModel.classes).filter((c) => c.packageName === subPkgPath),
        ...Object.values(currentModel.interfaces).filter((i) => i.packageName === subPkgPath),
        ...Object.values(currentModel.enums).filter((e) => e.packageName === subPkgPath),
      ]);
    }

    // Compute layout
    const parentElOffsets = new Map<string, { x: number; y: number }>();
    let rowX = PAD;
    let rowY = TAB_H + PAD;
    for (let i = 0; i < parentElements.length; i++) {
      parentElOffsets.set(parentElements[i].id, { x: rowX, y: rowY });
      rowX += EL_W + EL_GAP_X;
      if ((i + 1) % COLS === 0) { rowX = PAD; rowY += EL_H + EL_GAP_Y; }
    }
    const classRowsCount = Math.ceil(parentElements.length / COLS);
    const classAreaBottom = TAB_H + PAD + (parentElements.length > 0 ? classRowsCount * (EL_H + EL_GAP_Y) : 0);

    const subPkgOffsets = new Map<string, { x: number; y: number }>();
    const subPkgElOffsets = new Map<string, Map<string, { x: number; y: number }>>();
    let subPkgY = classAreaBottom + (parentElements.length > 0 ? PKG_GAP : 0);

    const subPkgDims = new Map<string, { w: number; h: number }>();
    for (const subPkgPath of directSubPkgPaths) {
      const subEls = subPkgElements.get(subPkgPath) ?? [];
      const elOffsets = new Map<string, { x: number; y: number }>();
      let sx = PAD; let sy = TAB_H + PAD;
      for (let i = 0; i < subEls.length; i++) {
        elOffsets.set(subEls[i].id, { x: sx, y: sy });
        sx += EL_W + EL_GAP_X;
        if ((i + 1) % COLS === 0) { sx = PAD; sy += EL_H + EL_GAP_Y; }
      }
      subPkgElOffsets.set(subPkgPath, elOffsets);
      const subRows = Math.max(1, Math.ceil(subEls.length / COLS));
      const subW = Math.max(400, COLS * (EL_W + EL_GAP_X) + 2 * PAD);
      const subH = Math.max(150, TAB_H + PAD + subRows * (EL_H + EL_GAP_Y) + PAD);
      subPkgDims.set(subPkgPath, { w: subW, h: subH });
      subPkgOffsets.set(subPkgPath, { x: PAD, y: subPkgY });
      subPkgY += subH + PKG_GAP;
    }

    const parentW = Math.max(600, COLS * (EL_W + EL_GAP_X) + 2 * PAD);
    const parentH = subPkgY + PAD;

    // Find or create package element IDs — exact name match only to avoid
    // incorrectly reusing an unrelated package with the same short name.
    const findPkg = (name: string) =>
      Object.values(currentModel.packages).find((p) => p.name === name);

    const parentPkgExisting = findPkg(parentPath);
    const parentPkgElementId = parentPkgExisting?.id ?? crypto.randomUUID();
    const parentPkgIsNew = !parentPkgExisting;
    const parentPkgViewNodeId = crypto.randomUUID();

    const subPkgInfo = new Map<string, { elementId: string; viewNodeId: string; isNew: boolean }>();
    for (const subPkgPath of directSubPkgPaths) {
      const existing = findPkg(subPkgPath);
      subPkgInfo.set(subPkgPath, {
        elementId: existing?.id ?? crypto.randomUUID(),
        viewNodeId: crypto.randomUUID(),
        isNew: !existing,
      });
    }

    const parentElViewNodeIds = new Map<string, string>();
    for (const el of parentElements) parentElViewNodeIds.set(el.id, crypto.randomUUID());

    const subPkgElViewNodeIds = new Map<string, Map<string, string>>();
    for (const subPkgPath of directSubPkgPaths) {
      const m = new Map<string, string>();
      for (const el of subPkgElements.get(subPkgPath) ?? []) m.set(el.id, crypto.randomUUID());
      subPkgElViewNodeIds.set(subPkgPath, m);
    }

    // Relations between placed elements
    const allPlacedIds = new Set([
      ...parentElements.map((el) => el.id),
      ...[...subPkgElements.values()].flatMap((els) => els.map((el) => el.id)),
    ]);
    const relevantRelations = Object.values(currentModel.relations ?? {}).filter(
      (rel) => allPlacedIds.has(rel.sourceId) && allPlacedIds.has(rel.targetId),
    );

    const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();

    // Build flat view nodes array with absolute canvas coordinates
    const buildViewNodes = () => {
      const nodes: Array<Record<string, unknown>> = [];
      nodes.push({ id: parentPkgViewNodeId, elementId: parentPkgElementId, x: position.x, y: position.y, width: parentW, height: parentH, collapsed: false, parentPackageId: null });
      for (const el of parentElements) {
        const off = parentElOffsets.get(el.id);
        if (!off) continue;
        // Store position relative to parent package
        nodes.push({ id: parentElViewNodeIds.get(el.id)!, elementId: el.id, x: off.x, y: off.y, parentPackageId: parentPkgViewNodeId });
      }
      for (const subPkgPath of directSubPkgPaths) {
        const info = subPkgInfo.get(subPkgPath)!;
        const off = subPkgOffsets.get(subPkgPath)!;
        const dims = subPkgDims.get(subPkgPath)!;
        // Store position relative to parent package
        nodes.push({ id: info.viewNodeId, elementId: info.elementId, x: off.x, y: off.y, width: dims.w, height: dims.h, collapsed: false, parentPackageId: parentPkgViewNodeId });
        const elVNIds = subPkgElViewNodeIds.get(subPkgPath)!;
        const elOffs = subPkgElOffsets.get(subPkgPath)!;
        for (const el of subPkgElements.get(subPkgPath) ?? []) {
          const elOff = elOffs.get(el.id);
          if (!elOff) continue;
          // Store position relative to sub-package
          nodes.push({ id: elVNIds.get(el.id)!, elementId: el.id, x: elOff.x, y: elOff.y, parentPackageId: info.viewNodeId });
        }
      }
      return nodes;
    };

    const viewEdges = relevantRelations.map((rel) => ({ id: crypto.randomUUID(), relationId: rel.id, waypoints: [] }));

    if (isStandaloneFile) {
      undoTransaction({
        label: `Place Hierarchy: ${parentPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || file.type !== 'FILE') return;
            if (!file.localModel) {
              const now = Date.now();
              file.localModel = {
                id: crypto.randomUUID(), name: `${file.name} (standalone)`, version: '1.0.0',
                packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                packageNames: [],
                createdAt: now, updatedAt: now,
              };
            }
            // Ensure packageNames array exists
            if (!file.localModel.packageNames) file.localModel.packageNames = [];
            
            if (parentPkgIsNew) {
              file.localModel.packages[parentPkgElementId] = {
                id: parentPkgElementId, name: parentPath, kind: 'PACKAGE',
                packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
              };
              // Remove from packageNames to avoid duplication in sidebar
              file.localModel.packageNames = file.localModel.packageNames.filter(
                (name: string) => name !== parentPath
              );
            }
            for (const subPkgPath of directSubPkgPaths) {
              const info = subPkgInfo.get(subPkgPath)!;
              if (info.isNew) {
                file.localModel.packages[info.elementId] = {
                  id: info.elementId, name: subPkgPath, kind: 'PACKAGE',
                  packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                };
                // Remove from packageNames to avoid duplication in sidebar
                file.localModel.packageNames = file.localModel.packageNames.filter(
                  (name: string) => name !== subPkgPath
                );
              }
            }
            file.localModel.updatedAt = Date.now();
            if (!isDiagramView(file.content)) return;
            const existingEls = new Set(file.content.nodes.map((vn: any) => vn.elementId));
            for (const vn of buildViewNodes()) {
              if (existingEls.has(vn.elementId)) continue;
              file.content.nodes.push(vn);
            }
            file.content.edges.push(...viewEdges);
          },
        }],
      });
    } else {
      undoTransaction({
        label: `Place Hierarchy: ${parentPath}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) {
                const now = Date.now();
                draft.model = {
                  id: domainModelId, name: 'Domain Model', version: '1.0.0',
                  packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                  attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                  objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                  packageNames: [], createdAt: now, updatedAt: now,
                };
              }
              // Ensure packageNames array exists
              if (!draft.model.packageNames) draft.model.packageNames = [];
              
              if (parentPkgIsNew) {
                draft.model.packages[parentPkgElementId] = {
                  id: parentPkgElementId, name: parentPath, kind: 'PACKAGE',
                  packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                };
                // Remove from packageNames to avoid duplication in sidebar
                draft.model.packageNames = draft.model.packageNames.filter(
                  (name: string) => name !== parentPath
                );
              }
              for (const subPkgPath of directSubPkgPaths) {
                const info = subPkgInfo.get(subPkgPath)!;
                if (info.isNew) {
                  draft.model.packages[info.elementId] = {
                    id: info.elementId, name: subPkgPath, kind: 'PACKAGE',
                    packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                  };
                  // Remove from packageNames to avoid duplication in sidebar
                  draft.model.packageNames = draft.model.packageNames.filter(
                    (name: string) => name !== subPkgPath
                  );
                }
              }
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              const existingEls = new Set(node.content.nodes.map((vn: any) => vn.elementId));
              for (const vn of buildViewNodes()) {
                if (existingEls.has(vn.elementId)) continue;
                node.content.nodes.push(vn);
              }
              node.content.edges.push(...viewEdges);
            },
          },
        ],
      });
    }
  }, [hierarchyModal, activeTabId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const hasPackageData = event.dataTransfer.types.includes(DRAG_TYPE_PACKAGE.toLowerCase());
      const hasNewData = event.dataTransfer.types.includes(DRAG_TYPE_NEW.toLowerCase());
      const hasExistingData = event.dataTransfer.types.includes(DRAG_TYPE_EXISTING.toLowerCase());
      
      if (!hasPackageData && !hasNewData && !hasExistingData) {
        return;
      }

      const position = getCenteredPosition(event.clientX, event.clientY);

      const packageData = event.dataTransfer.getData(DRAG_TYPE_PACKAGE);
      if (packageData) {
        if (!activeTabId) return;

        const freshProject = useVFSStore.getState().project;
        if (!freshProject) return;
        const freshFileNode = freshProject.nodes[activeTabId];
        if (!freshFileNode || freshFileNode.type !== 'FILE') return;
        const freshContent = (freshFileNode as VFSFile).content;
        if (!isDiagramView(freshContent)) return;

        const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;
        const packageFullPath = packageData;
        let existingPackageId: string | null = null;
        let existingViewNodeId: string | null = null;
        
        const findParentPackageViewNode = (fullPath: string): string | null => {
          const segments = fullPath.split('.');
          if (segments.length <= 1) return null;
          
          const parentPath = segments.slice(0, -1).join('.');
          const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
          if (!currentModel) return null;
          
          for (const vn of freshContent.nodes) {
            const pkg = currentModel.packages?.[vn.elementId];
            if (!pkg) continue;
            
            let effectivePath = pkg.name;
            let currentVN = vn;
            while (currentVN.parentPackageId) {
              const parentVN = freshContent.nodes.find((n: ViewNode) => n.id === currentVN.parentPackageId);
              if (!parentVN) break;
              const parentPkg = currentModel.packages?.[parentVN.elementId];
              if (!parentPkg) break;
              effectivePath = `${parentPkg.name}.${effectivePath}`;
              currentVN = parentVN;
            }
            
            if (effectivePath === parentPath) {
              return vn.id;
            }
          }
          return null;
        };
        
        const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
        if (currentModel?.packages) {
          for (const vn of freshContent.nodes) {
            const pkg = currentModel.packages[vn.elementId];
            if (!pkg) continue;
            
            let effectivePath = pkg.name;
            let currentVN = vn;
            while (currentVN.parentPackageId) {
              const parentVN = freshContent.nodes.find((n: ViewNode) => n.id === currentVN.parentPackageId);
              if (!parentVN) break;
              const parentPkg = currentModel.packages[parentVN.elementId];
              if (!parentPkg) break;
              effectivePath = `${parentPkg.name}.${effectivePath}`;
              currentVN = parentVN;
            }
            
            if (effectivePath === packageFullPath) {
              existingPackageId = pkg.id;
              existingViewNodeId = vn.id;
              break;
            }
          }
        }
        
        if (existingViewNodeId) {
          showToast(`"${packageFullPath}" is already on canvas. Drag it directly to move it.`);
          return;
        }
        
        if (!existingPackageId && currentModel) {
          let pkg = Object.values(currentModel.packages ?? {}).find(p => p.name === packageFullPath);
          if (!pkg) {
            const lastSegment = packageFullPath.split('.').pop();
            pkg = Object.values(currentModel.packages ?? {}).find(p => p.name === lastSegment);
          }
          if (pkg) existingPackageId = pkg.id;
        }

        // Check if we should show hierarchy modal BEFORE placing
        const segments = packageFullPath.split('.');
        const parentViewNodeId = findParentPackageViewNode(packageFullPath);
        
        if (segments.length > 1 && !parentViewNodeId) {
          const parentPath = segments.slice(0, -1).join('.');
          const { classCount, subPackageCount, siblingCount } = getParentContent(parentPath, packageFullPath, currentModel);
          if (classCount > 0 || siblingCount > 0) {
            setHierarchyModal({
              isOpen: true,
              packageFullPath,
              parentPath,
              classCount,
              subPackageCount,
              position,
              isStandaloneFile,
            });
            return;
          }
        }

        // If package exists in model but not on canvas, just add view node
        if (existingPackageId) {
          undoTransaction({
            label: `Add to canvas: ${packageFullPath}`,
            scope: isStandaloneFile ? activeTabId : 'global',
            mutations: [{
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                const newViewNodeId = crypto.randomUUID();
                node.content.nodes.push({
                  id: newViewNodeId,
                  elementId: existingPackageId,
                  x: position.x,
                  y: position.y,
                  collapsed: false,
                  parentPackageId: parentViewNodeId,
                });
              },
            }],
            affectedElementIds: [existingPackageId],
          });
          return;
        }

        // Create new package
        const newElementId = crypto.randomUUID();
        const newViewNodeId = crypto.randomUUID();
        const packageName = packageFullPath;

        if (isStandaloneFile) {
          undoTransaction({
            label: `Create Package: ${packageName}`,
            scope: activeTabId,
            mutations: [{
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE') return;
                if (!node.localModel) {
                  const now = Date.now();
                  node.localModel = {
                    id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                    createdAt: now, updatedAt: now,
                  };
                }
                node.localModel.packages[newElementId] = {
                  id: newElementId,
                  name: packageName,
                  kind: 'PACKAGE',
                  packageIds: [],
                  classIds: [],
                  interfaceIds: [],
                  enumIds: [],
                  dataTypeIds: [],
                };
                node.localModel.updatedAt = Date.now();
                if (isDiagramView(node.content)) {
                  node.content.nodes.push({
                    id: newViewNodeId,
                    elementId: newElementId,
                    x: position.x,
                    y: position.y,
                    collapsed: false,
                    parentPackageId: parentViewNodeId,
                  });
                }
              },
            }],
          });
        } else {
          const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();

          undoTransaction({
            label: `Create Package: ${packageName}`,
            scope: 'global',
            mutations: [
              {
                store: 'model',
                mutate: (draft: any) => {
                  if (!draft.model) {
                    const now = Date.now();
                    draft.model = {
                      id: domainModelId, name: 'Domain Model', version: '1.0.0',
                      packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                      attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                      objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                      packageNames: [], createdAt: now, updatedAt: now,
                    };
                  }
                  draft.model.packages[newElementId] = {
                    id: newElementId,
                    name: packageName,
                    kind: 'PACKAGE',
                    packageIds: [],
                    classIds: [],
                    interfaceIds: [],
                    enumIds: [],
                    dataTypeIds: [],
                  };
                  draft.model.updatedAt = Date.now();
                },
              },
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const node = draft.project?.nodes[activeTabId];
                  if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                  node.content.nodes.push({
                    id: newViewNodeId,
                    elementId: newElementId,
                    x: position.x,
                    y: position.y,
                    collapsed: false,
                    parentPackageId: parentViewNodeId,
                  });
                },
              },
            ],
          });
        }
        return;
      }

      const existingElementId = event.dataTransfer.getData(DRAG_TYPE_EXISTING);
      if (existingElementId) {
        const existingNode = checkDuplicateElement(existingElementId);
        
        if (existingNode) {
          const elementName = getElementName(existingElementId);
          
          if (hideDuplicateFileWarning) {
            showToast(`"${elementName}" is already in the diagram`);
            return;
          }
          
          setDuplicateModal({
            isOpen: true,
            fileName: elementName,
            elementId: existingElementId,
            position,
          });
          return;
        }

        addElementToDiagram(existingElementId, position);
        return;
      }

      const stereotype = event.dataTransfer.getData(DRAG_TYPE_NEW) as stereotype;

      if (!stereotype) return;

      if (!activeTabId) return;

      const dropConfig = VFS_DROP_CONFIG[stereotype];

      if (!dropConfig) {
        console.warn(`[VFS Drop] Stereotype "${stereotype}" has no VFS semantic mapping. Drop ignored.`);
        return;
      }

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return;
      const freshFileNode = freshProject.nodes[activeTabId];
      if (!freshFileNode || freshFileNode.type !== 'FILE') return;
      const freshContent = (freshFileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return;

      const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;
      const isExternalFile = !!(freshFileNode as VFSFile).isExternal;
      const newElementId = crypto.randomUUID();
      const newViewNodeId = crypto.randomUUID();

      if (isStandaloneFile) {
        const currentLocalModel = getLocalModel(activeTabId);
        const elementName = (currentLocalModel && !dropConfig.isVisualOnly)
          ? dropConfig.getNextName(currentLocalModel)
          : 'Note';

        undoTransaction({
          label: `Create ${stereotype}`,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (!dropConfig.isVisualOnly) {
                if (!node.localModel) {
                  const now = Date.now();
                  node.localModel = {
                    id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                    createdAt: now, updatedAt: now,
                  };
                }
                dropConfig.applyToLocalModelDraft(node.localModel, newElementId, elementName);
              }
              if (isDiagramView(node.content)) {
                node.content.nodes.push({
                  id: newViewNodeId,
                  elementId: dropConfig.isVisualOnly ? '' : newElementId,
                  x: position.x, y: position.y,
                });
              }
            },
          }],
        });
      } else {
        const modelState = useModelStore.getState();
        const currentModel = modelState.model;
        const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();
        const elementName = (currentModel && !dropConfig.isVisualOnly)
          ? dropConfig.getNextName(currentModel)
          : 'Note';

        if (dropConfig.isVisualOnly) {
          withUndo('vfs', 'Add Note', activeTabId, (draft: any) => {
            const node = draft.project?.nodes[activeTabId];
            if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
            node.content.nodes.push({ id: newViewNodeId, elementId: '', x: position.x, y: position.y });
          });
        } else {
          undoTransaction({
            label: `Create ${stereotype}`,
            scope: 'global',
            mutations: [
              {
                store: 'model',
                mutate: (draft: any) => {
                  if (!draft.model) {
                    const now = Date.now();
                    draft.model = {
                      id: domainModelId, name: 'Domain Model', version: '1.0.0',
                      packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                      attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                      objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                      packageNames: [], createdAt: now, updatedAt: now,
                    };
                  }
                  dropConfig.applyToModelDraft(draft.model, newElementId, elementName, isExternalFile || undefined);
                },
              },
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const node = draft.project?.nodes[activeTabId];
                  if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                  node.content.nodes.push({ id: newViewNodeId, elementId: newElementId, x: position.x, y: position.y });
                },
              },
            ],
          });
        }
      }
    },
    [
      getCenteredPosition,
      activeTabId,
      updateFileContent,
      checkDuplicateElement,
      getElementName,
      hideDuplicateFileWarning,
      showToast,
      addElementToDiagram,
    ],
  );

  return {
    onDragOver,
    onDrop,
    duplicateModal: {
      isOpen: duplicateModal.isOpen,
      fileName: duplicateModal.fileName,
      onReplace: handleModalReplace,
      onCancel: handleModalCancel,
      onDontShowAgain: handleDontShowAgain,
    },
    hierarchyModal: {
      isOpen: hierarchyModal.isOpen,
      packageFullPath: hierarchyModal.packageFullPath,
      parentPath: hierarchyModal.parentPath,
      classCount: hierarchyModal.classCount,
      subPackageCount: hierarchyModal.subPackageCount,
      onPlaceSimple: handleHierarchyPlaceSimple,
      onPlaceHierarchy: handleHierarchyPlaceHierarchy,
      onCancel: handleHierarchyCancel,
    },
  };
}
