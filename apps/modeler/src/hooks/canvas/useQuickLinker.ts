/**
 * useQuickLinker — "create node from a connection drag" (R5, Quick Linker).
 *
 * When the user drags a connection out of a node's anchor and releases on empty
 * canvas, KonvaCanvas opens a node-type picker; choosing a type calls
 * createNodeAndConnect, which instantiates a new node AND the relation linking it
 * to the source — both in a **single undo transaction** (one Ctrl+Z reverts both).
 *
 * Reuses the same building blocks as the rest of the canvas:
 *   - VFS_DROP_CONFIG[stereotype]  — node element builders (shared with drag&drop).
 *   - the relation-kind / endpoint rules from useCanvasEventHandlers.onConnect.
 *
 * Standalone diagrams write to the file's localModel; shared diagrams write to the
 * global model store — same split as onConnect / useKonvaDnD.
 */

import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { undoTransaction } from '../../core/undo/undoBridge';
import { VFS_DROP_CONFIG } from '../../canvas/hooks/useKonvaDnD';
import type { stereotype } from '../../features/diagram/types/diagram.types';
import type {
  RelationKind,
  VFSFile,
  DiagramView,
  ViewNode,
  ViewEdge,
} from '../../core/domain/vfs/vfs.types';

/** Default node box used to center the new node on the drop point. */
const NODE_WIDTH = 256;
const NODE_HEIGHT = 120;

/** Palette connection-mode → relation kind (same table as onConnect / useConnectionDraw). */
const TOOL_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION:    'ASSOCIATION',
  INHERITANCE:    'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY:     'DEPENDENCY',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  GENERALIZATION: 'GENERALIZATION',
  INCLUDE:        'INCLUDE',
  EXTEND:         'EXTEND',
  PACKAGE_IMPORT: 'PACKAGE_IMPORT',
  PACKAGE_MERGE:  'PACKAGE_MERGE',
  PACKAGE_ACCESS: 'PACKAGE_ACCESS',
};

function emptyLocalModel(name: string) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(), name: `${name} (standalone)`, version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
    packageNames: [], createdAt: now, updatedAt: now,
  };
}

export interface UseQuickLinkerParams {
  activeTabId: string | null;
}

export interface UseQuickLinkerResult {
  /**
   * Creates a new node of `stereo` at `worldPos` and a relation from `sourceVNId`
   * (an existing ViewNode id) to it, in one undo transaction. The relation kind
   * is derived from the active palette mode (with note/package overrides).
   */
  createNodeAndConnect: (
    sourceVNId: string,
    stereo: stereotype,
    worldPos: { x: number; y: number },
  ) => void;
}

export function useQuickLinker({ activeTabId }: UseQuickLinkerParams): UseQuickLinkerResult {
  const createNodeAndConnect = useCallback(
    (sourceVNId: string, stereo: stereotype, worldPos: { x: number; y: number }) => {
      if (!activeTabId) return;

      const dropConfig = VFS_DROP_CONFIG[stereo];
      if (!dropConfig) return;

      const project = useVFSStore.getState().project;
      if (!project) return;
      const fileNode = project.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      const file = fileNode as VFSFile;
      if (!isDiagramView(file.content)) return;
      const view = file.content as DiagramView;

      const sourceVN = view.nodes.find((vn) => vn.id === sourceVNId);
      if (!sourceVN) return;

      const isStandalone = file.standalone === true;
      const isExternalFile = !!file.isExternal;
      const model = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;

      // Center the node box on the drop point; lifelines etc. may override.
      const base = { x: worldPos.x - NODE_WIDTH / 2, y: worldPos.y - NODE_HEIGHT / 2 };
      const pos = dropConfig.overridePosition ? dropConfig.overridePosition(base) : base;

      const isVisualOnly = !!dropConfig.isVisualOnly; // notes have no semantic element
      const newElementId = crypto.randomUUID();
      const newViewNodeId = crypto.randomUUID();
      const elementName = model && !isVisualOnly ? dropConfig.getNextName(model) : 'Note';

      // ── Relation kind + endpoints (mirror onConnect) ──────────────────────
      const rawMode = useWorkspaceStore.getState().connectionModes?.[activeTabId] as string | undefined;
      const sourceIsNote = !sourceVN.elementId;
      const targetIsNote = isVisualOnly;
      // Notes use the ViewNode id as the relation endpoint (no semantic element).
      const sourceElementId = sourceVN.elementId || sourceVN.id;
      const targetElementId = isVisualOnly ? newViewNodeId : newElementId;
      const sourceIsPkg = !sourceIsNote && !!model?.packages[sourceElementId];
      const targetIsPkg = stereo === 'package';
      const kind: RelationKind =
        sourceIsNote || targetIsNote
          ? 'DEPENDENCY'
          : sourceIsPkg && targetIsPkg
            ? 'DEPENDENCY'
            : TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';

      const newRelationId = crypto.randomUUID();
      const newViewNode: ViewNode = {
        id: newViewNodeId,
        elementId: isVisualOnly ? '' : newElementId,
        x: pos.x,
        y: pos.y,
        ...(dropConfig.initialDimensions ?? {}),
      };
      const newViewEdge: ViewEdge = {
        id: crypto.randomUUID(),
        relationId: newRelationId,
        waypoints: [],
        // New edges default to free-form straight (legacy edges keep orthogonal).
        routingMode: 'straight',
      };

      if (isStandalone) {
        undoTransaction({
          label: 'Quick Linker',
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (!node.localModel) node.localModel = emptyLocalModel(node.name);
              if (!isVisualOnly) {
                dropConfig.applyToLocalModelDraft(node.localModel, newElementId, elementName);
              }
              node.localModel.relations[newRelationId] = {
                id: newRelationId, kind, sourceId: sourceElementId, targetId: targetElementId,
              };
              node.localModel.updatedAt = Date.now();
              if (isDiagramView(node.content)) {
                node.content.nodes.push(newViewNode);
                node.content.edges.push(newViewEdge);
              }
            },
          }],
        });
      } else {
        undoTransaction({
          label: 'Quick Linker',
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) {
                  const now = Date.now();
                  draft.model = {
                    id: project.domainModelId ?? crypto.randomUUID(), name: 'Domain Model', version: '1.0.0',
                    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                    packageNames: [], createdAt: now, updatedAt: now,
                  };
                }
                if (!isVisualOnly) {
                  dropConfig.applyToModelDraft(draft.model, newElementId, elementName, isExternalFile || undefined);
                }
                draft.model.relations[newRelationId] = {
                  id: newRelationId, kind, sourceId: sourceElementId, targetId: targetElementId,
                  ...(isExternalFile ? { isExternal: true } : {}),
                };
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                node.content.nodes.push(newViewNode);
                node.content.edges.push(newViewEdge);
              },
            },
          ],
        });
      }
    },
    [activeTabId],
  );

  return { createNodeAndConnect };
}
