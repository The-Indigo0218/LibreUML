/**
 * useKonvaDnD — Konva-native drag & drop hook (MAG-01.11)
 *
 * Replaces useDiagramDnD for Konva canvas. Handles two drop types:
 * 1. DRAG_TYPE_NEW: Tool palette → create IR element + ViewNode
 * 2. DRAG_TYPE_EXISTING: Model Explorer → create ViewNode only (no model change)
 *
 * Architecture:
 * - Screen → canvas coordinate conversion via stage.getPointerPosition()
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
 * Coordinate conversion:
 * - stage.getPointerPosition() returns canvas coords (accounts for pan/zoom)
 * - No manual transform needed (Konva handles it)
 * - Center node: canvasPos - (NODE_WIDTH / 2, NODE_HEIGHT / 2)
 */

import { useCallback } from 'react';
import type Konva from 'konva';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { standaloneModelOps, getLocalModel, ensureLocalModel } from '../../store/standaloneModelOps';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import type { DiagramView, ViewNode, VFSFile, SemanticModel } from '../../core/domain/vfs/vfs.types';
import type { stereotype } from '../../features/diagram/types/diagram.types';

// ─── Drag type constants ──────────────────────────────────────────────────────

/** Payload set by the tool palette — creates a NEW semantic element on drop. */
export const DRAG_TYPE_NEW = 'application/reactflow' as const;

/**
 * Payload set by the Model Explorer SSOT sidebar — the semantic element already
 * exists. The drop handler must ONLY create a ViewNode; it must NOT touch ModelStore.
 */
export const DRAG_TYPE_EXISTING = 'application/reactflow-existing-node' as const;

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
  stageRef: React.RefObject<Konva.Stage>;
}

export interface UseKonvaDnDResult {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function useKonvaDnD({ stageRef }: UseKonvaDnDParams): UseKonvaDnDResult {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  // ─── Position helpers ─────────────────────────────────────────────────────

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };

      // Get pointer position in canvas coordinates (accounts for pan/zoom)
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return { x: 0, y: 0 };

      // Center node under cursor
      return {
        x: pointerPos.x - NODE_WIDTH / 2,
        y: pointerPos.y - NODE_HEIGHT / 2,
      };
    },
    [stageRef],
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
          elementId: existingElementId,
          x: position.x,
          y: position.y,
        };

        updateFileContent(activeTabId, {
          ...freshView,
          nodes: [...freshView.nodes, viewNode],
        });
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
    [getCenteredPosition, activeTabId, updateFileContent],
  );

  return { onDragOver, onDrop };
}
