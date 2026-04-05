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
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../../store/standaloneModelOps';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
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
const VFS_DROP_CONFIG: Partial<
  Record<
    stereotype,
    {
      getNextName: (model: SemanticModel) => string;
      create: (name: string, isExternal?: boolean) => string;
    }
  >
> = {
  class: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.classes)
          .filter((c) => !c.isAbstract)
          .map((c) => c.name),
        'Class',
      ),
    create: (name, isExternal) =>
      useModelStore.getState().createClass({
        name,
        attributeIds: [],
        operationIds: [],
        ...(isExternal ? { isExternal: true } : {}),
      }),
  },
  interface: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.interfaces).map((i) => i.name),
        'Interface',
      ),
    create: (name, isExternal) =>
      useModelStore.getState().createInterface({
        name,
        operationIds: [],
        ...(isExternal ? { isExternal: true } : {}),
      }),
  },
  abstract: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.classes)
          .filter((c) => !!c.isAbstract)
          .map((c) => c.name),
        'Abstract',
      ),
    create: (name, isExternal) =>
      useModelStore.getState().createAbstractClass({
        name,
        attributeIds: [],
        operationIds: [],
        ...(isExternal ? { isExternal: true } : {}),
      }),
  },
  enum: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.enums).map((e) => e.name),
        'Enum',
      ),
    create: (name, isExternal) =>
      useModelStore.getState().createEnum({
        name,
        literals: [],
        ...(isExternal ? { isExternal: true } : {}),
      }),
  },
  // Notes are visual-only — no IR element, no auto-increment needed.
  note: {
    getNextName: () => 'Note',
    create: () => '',
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

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return;
      const freshFileNode = freshProject.nodes[activeTabId];
      if (!freshFileNode || freshFileNode.type !== 'FILE') return;
      const freshContent = (freshFileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return;
      const freshView = freshContent as DiagramView;

      const viewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId: elementId,
        x: position.x,
        y: position.y,
      };

      let updatedNodes = freshView.nodes;

      // If replacing, remove old node
      if (replaceNodeId) {
        updatedNodes = updatedNodes.filter((vn) => vn.id !== replaceNodeId);
      }

      // Add new node
      updatedNodes = [...updatedNodes, viewNode];

      updateFileContent(activeTabId, {
        ...freshView,
        nodes: updatedNodes,
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

      // ===================================================================
      // EXISTING ELEMENT DROP (Model Explorer SSOT sidebar)
      // The semantic element already lives in ModelStore. Only create a
      // ViewNode — do NOT touch ModelStore.
      // ===================================================================
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
      const freshView = freshContent as DiagramView;

      const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;

      let semanticId: string;

      if (isStandaloneFile) {
        // Standalone path: create IR element in localModel, never touch ModelStore.
        ensureLocalModel(activeTabId);
        const localM = getLocalModel(activeTabId);
        if (!localM && stereotype !== 'note') return;

        const elementName = localM ? dropConfig.getNextName(localM) : 'Note';
        const ops = standaloneModelOps(activeTabId);

        switch (stereotype) {
          case 'class':
            semanticId = ops.createClass({
              name: elementName,
              attributeIds: [],
              operationIds: [],
            });
            break;
          case 'abstract':
            semanticId = ops.createAbstractClass({
              name: elementName,
              attributeIds: [],
              operationIds: [],
            });
            break;
          case 'interface':
            semanticId = ops.createInterface({
              name: elementName,
              operationIds: [],
            });
            break;
          case 'enum':
            semanticId = ops.createEnum({ name: elementName, literals: [] });
            break;
          case 'note':
            semanticId = '';
            break;
          default:
            return;
        }
      } else {
        // a) Ensure SemanticModel is initialized (may be null on first drop).
        const modelState = useModelStore.getState();
        if (!modelState.model) {
          modelState.initModel(freshProject.domainModelId ?? crypto.randomUUID());
        }

        // b) Compute auto-incremented name, then create the semantic IR element.
        const currentModel = useModelStore.getState().model!;
        const elementName = dropConfig.getNextName(currentModel);
        const isExternalFile = !!(freshFileNode as VFSFile).isExternal;
        semanticId = dropConfig.create(elementName, isExternalFile || undefined);
      }

      // c) Create the visual ViewNode linked to the semantic element.
      const viewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId: semanticId,
        x: position.x,
        y: position.y,
      };

      // d) Persist the updated DiagramView to VFSStore.
      const updatedView: DiagramView = {
        ...freshView,
        nodes: [...freshView.nodes, viewNode],
      };
      updateFileContent(activeTabId, updatedView);
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
