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

        if (existingPackageId) {
          const parentViewNodeId = findParentPackageViewNode(packageFullPath);
          
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

        const newElementId = crypto.randomUUID();
        const newViewNodeId = crypto.randomUUID();
        const packageName = packageFullPath.split('.').pop() || packageFullPath;
        const parentViewNodeId = findParentPackageViewNode(packageFullPath);
        
        const segments = packageFullPath.split('.');
        if (segments.length > 1 && !parentViewNodeId) {
          const parentPath = segments.slice(0, -1).join('.');
          showToast(`Parent package "${parentPath}" must be on canvas first`);
          return;
        }

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
  };
}
