/**
 * useKonvaDnD — Konva-native drag & drop hook (MAG-01.11, MAG-01.32)
 *
 * Replaces useDiagramDnD for Konva canvas. Handles two drop types:
 * 1. DRAG_TYPE_NEW: Tool palette → create IR element + ViewNode
 * 2. DRAG_TYPE_EXISTING: Model Explorer → create ViewNode only (no model change)
 *
 * Architecture:
 * - Screen → canvas coordinate conversion via manual transform
 * - Gets container rect, applies inverse viewport transform (scale + pan)
 * - Formula: canvasX = (screenX - stageX) / scale
 * - Centers node under cursor (canvasX - width/2, canvasY - height/2)
 * - Auto-incremented names ("Class 1", "Class 2", etc.)
 * - Standalone file support (creates IR in localModel)
 * - Triggers VFS auto-save via MAG-01.9
 *
 * Integration:
 * - Wire onDragOver to Stage onDragOver event
 * - Wire onDrop to Stage onDrop event
 * - Drop data format: { type, elementKind, elementId }
 *
 * Coordinate conversion (MAG-01.32 fix):
 * - Cannot use stage.getPointerPosition() (not updated during React drag events)
 * - Manual conversion: containerX = clientX - rect.left
 * - Apply inverse transform: canvasX = (containerX - stage.x()) / stage.scaleX()
 * - Works correctly at all zoom levels and pan positions
 */

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

// ─── Drag type constants ──────────────────────────────────────────────────────

/** Payload set by the tool palette — creates a NEW semantic element on drop. */
export const DRAG_TYPE_NEW = 'application/libreuml-node' as const;

/**
 * Payload set by the Model Explorer SSOT sidebar — the semantic element already
 * exists. The drop handler must ONLY create a ViewNode; it must NOT touch ModelStore.
 */
export const DRAG_TYPE_EXISTING = 'application/libreuml-existing-node' as const;

export const DRAG_TYPE_PACKAGE = 'application/libreuml-package' as const;

// ─── Node dimensions (for centering) ──────────────────────────────────────────

const NODE_WIDTH = 256;  // Matches ClassShape MIN_W
const NODE_HEIGHT = 120; // Approximate default height

// ─── VFS name helper ──────────────────────────────────────────────────────────

/**
 * Scans an array of IR element names and returns the next available "Prefix N" name.
 * Mirrors the logic of getNextDefaultName but works with plain string arrays
 * so it can operate on SemanticModel collections without depending on DomainNode types.
 */
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

// ─── VFS semantic drop configuration ─────────────────────────────────────────

/**
 * Configuration for each stereotype when dropped onto a VFS .luml canvas.
 * - `getNextName(model)` : Generates an auto-incremented name by scanning the
 *                          relevant SemanticModel collection (e.g. "Class 3").
 * - `create(name)`       : Calls the appropriate ModelStore factory and returns
 *                          the new semantic element's stable ID.
 */
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

  // Modal state
  const [duplicateModal, setDuplicateModal] = useState({
    isOpen: false,
    fileName: '',
    elementId: '',
    position: { x: 0, y: 0 },
  });

  // ─── Position helpers ─────────────────────────────────────────────────────

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };

      // Get stage container position
      const container = stage.container();
      const rect = container.getBoundingClientRect();

      // Convert screen coordinates to container-relative coordinates
      const containerX = clientX - rect.left;
      const containerY = clientY - rect.top;

      // Apply inverse viewport transform to get canvas coordinates
      const scale = stage.scaleX(); // Assumes uniform scaling
      const stageX = stage.x();
      const stageY = stage.y();

      // Canvas coordinates: (screen - stageOffset) / scale
      const canvasX = (containerX - stageX) / scale;
      const canvasY = (containerY - stageY) / scale;

      // Center node under cursor
      return {
        x: canvasX - NODE_WIDTH / 2,
        y: canvasY - NODE_HEIGHT / 2,
      };
    },
    [stageRef],
  );

  // ─── Helper: Get element name ─────────────────────────────────────────────

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

  // ─── Helper: Check if element exists in diagram ──────────────────────────

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

      // Find existing ViewNode with same elementId
      return freshView.nodes.find((vn) => vn.elementId === elementId) ?? null;
    },
    [activeTabId],
  );

  // ─── Helper: Add element to diagram ───────────────────────────────────────

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

  // ─── Modal handlers ───────────────────────────────────────────────────────

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

  // ─── onDragOver ───────────────────────────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // ─── onDrop ───────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

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
        const newElementId = crypto.randomUUID();
        const newViewNodeId = crypto.randomUUID();

        if (isStandaloneFile) {
          const currentLocalModel = getLocalModel(activeTabId);
          const packageName = currentLocalModel
            ? getNextVFSName(Object.values(currentLocalModel.packages).map((p) => p.name), 'Package')
            : 'Package 1';

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
                  });
                }
              },
            }],
          });
        } else {
          const modelState = useModelStore.getState();
          const currentModel = modelState.model;
          const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();
          const packageName = currentModel
            ? getNextVFSName(Object.values(currentModel.packages).map((p) => p.name), 'Package')
            : 'Package 1';

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
        // Check if element already exists in diagram
        const existingNode = checkDuplicateElement(existingElementId);
        
        if (existingNode) {
          const elementName = getElementName(existingElementId);
          
          // If warning is disabled, show toast and return
          if (hideDuplicateFileWarning) {
            showToast(`"${elementName}" is already in the diagram`);
            return;
          }
          
          // Show modal
          setDuplicateModal({
            isOpen: true,
            fileName: elementName,
            elementId: existingElementId,
            position,
          });
          return;
        }

        // Element not in diagram, add it
        addElementToDiagram(existingElementId, position);
        return;
      }

      const stereotype = event.dataTransfer.getData(DRAG_TYPE_NEW) as stereotype;

      if (!stereotype) return;

      // ===================================================================
      // VFS SEMANTIC DROP
      // ===================================================================
      if (!activeTabId) return;

      const dropConfig = VFS_DROP_CONFIG[stereotype];

      if (!dropConfig) {
        console.warn(
          `[VFS Drop] Stereotype "${stereotype}" has no VFS semantic mapping. Drop ignored.`,
        );
        return;
      }

      // Fresh read on every drop — avoids stale-closure overwrite on rapid drops.
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
