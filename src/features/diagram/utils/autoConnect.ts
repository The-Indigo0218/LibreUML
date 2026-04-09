import type { IRAttribute, ViewEdge, RelationKind, VFSFile, VFSFolder } from '../../../core/domain/vfs/vfs.types';
import { useModelStore } from '../../../store/model.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { isDiagramView } from '../hooks/useVFSCanvasController';
import { parseAttributeType } from './typeParser';
import { undoTransaction } from '../../../core/undo/undoBridge';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export interface NewRelation {
  relationId: string;
  kind: RelationKind;
  targetElementId: string;
  viewEdge: ViewEdge;
}

/**
 * Pure read — computes which new relations should be created when a class's
 * attributes reference other elements by type name. Does NOT mutate any store.
 * Call this before a transaction so the snapshot reflects pre-mutation state.
 */
export function computeNewRelations(
  sourceElementId: string,
  attributes: IRAttribute[],
): NewRelation[] {
  const initialModel = useModelStore.getState().model;
  if (!initialModel) return [];

  const nameToElementId = new Map<string, string>();
  for (const [id, cls] of Object.entries(initialModel.classes)) {
    if (id !== sourceElementId) nameToElementId.set(normalize(cls.name), id);
  }
  for (const [id, iface] of Object.entries(initialModel.interfaces)) {
    if (id !== sourceElementId) nameToElementId.set(normalize(iface.name), id);
  }

  const seenTargets = new Set<string>();
  const activeTabId = useWorkspaceStore.getState().activeTabId;
  const results: NewRelation[] = [];

  for (const attr of attributes) {
    const { baseName, isCollection } = parseAttributeType(attr.type);
    const effectiveIsCollection = isCollection || attr.multiplicity === '*';

    const targetElementId = nameToElementId.get(normalize(baseName));
    if (!targetElementId || seenTargets.has(targetElementId)) continue;
    seenTargets.add(targetElementId);

    const alreadyConnected = Object.values(initialModel.relations).some(
      (rel) => rel.sourceId === sourceElementId && rel.targetId === targetElementId,
    );
    if (alreadyConnected) continue;

    const kind: RelationKind = effectiveIsCollection ? 'AGGREGATION' : 'ASSOCIATION';
    const relationId = crypto.randomUUID();

    if (!activeTabId) continue;
    const project = useVFSStore.getState().project;
    if (!project) continue;
    const fileNode = (project.nodes as Record<string, VFSFile | VFSFolder>)[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') continue;
    const fileContent = fileNode.content;
    if (!isDiagramView(fileContent)) continue;
    const sourceVN = fileContent.nodes.find((vn) => vn.elementId === sourceElementId);
    const targetVN = fileContent.nodes.find((vn) => vn.elementId === targetElementId);
    if (!sourceVN || !targetVN) continue;

    results.push({
      relationId,
      kind,
      targetElementId,
      viewEdge: { id: crypto.randomUUID(), relationId, waypoints: [] },
    });
  }

  return results;
}

export function autoConnectByAttributeType(
  sourceElementId: string,
  attributes: IRAttribute[],
): void {
  const activeTabId = useWorkspaceStore.getState().activeTabId;
  const newRelations = computeNewRelations(sourceElementId, attributes);

  if (newRelations.length === 0 || !activeTabId) return;

  undoTransaction({
    label: 'Auto-connect Relations',
    scope: 'global',
    mutations: [
      {
        store: 'model',
        mutate: (draft: any) => {
          if (!draft.model) return;
          for (const { relationId, kind, targetElementId } of newRelations) {
            draft.model.relations[relationId] = {
              id: relationId, kind, sourceId: sourceElementId, targetId: targetElementId,
            };
          }
          draft.model.updatedAt = Date.now();
        },
      },
      {
        store: 'vfs',
        mutate: (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
          for (const { viewEdge } of newRelations) {
            node.content.edges.push(viewEdge);
          }
        },
      },
    ],
  });
}
