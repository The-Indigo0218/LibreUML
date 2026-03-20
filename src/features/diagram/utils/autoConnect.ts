import type { IRAttribute, ViewEdge, RelationKind, VFSFile, VFSFolder } from '../../../core/domain/vfs/vfs.types';
import { useModelStore } from '../../../store/model.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { isDiagramView } from '../hooks/useVFSCanvasController';
import { parseAttributeType } from './typeParser';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function autoConnectByAttributeType(
  sourceElementId: string,
  attributes: IRAttribute[],
): void {
  const initialModel = useModelStore.getState().model;
  if (!initialModel) return;

  const nameToElementId = new Map<string, string>();
  for (const [id, cls] of Object.entries(initialModel.classes)) {
    if (id !== sourceElementId) nameToElementId.set(normalize(cls.name), id);
  }
  for (const [id, iface] of Object.entries(initialModel.interfaces)) {
    if (id !== sourceElementId) nameToElementId.set(normalize(iface.name), id);
  }

  const seenTargets = new Set<string>();

  for (const attr of attributes) {
    const { baseName, isCollection } = parseAttributeType(attr.type);
    const effectiveIsCollection = isCollection || attr.multiplicity === '*';

    const targetElementId = nameToElementId.get(normalize(baseName));
    if (!targetElementId || seenTargets.has(targetElementId)) continue;
    seenTargets.add(targetElementId);

    const currentModel = useModelStore.getState().model;
    if (!currentModel) continue;

    const alreadyConnected = Object.values(currentModel.relations).some(
      (rel) => rel.sourceId === sourceElementId && rel.targetId === targetElementId,
    );
    if (alreadyConnected) continue;

    const kind: RelationKind = effectiveIsCollection ? 'AGGREGATION' : 'ASSOCIATION';

    const relationId = useModelStore.getState().createRelation({
      kind,
      sourceId: sourceElementId,
      targetId: targetElementId,
    });

    const activeTabId = useWorkspaceStore.getState().activeTabId;
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

    const viewEdge: ViewEdge = {
      id: crypto.randomUUID(),
      relationId,
      waypoints: [],
    };

    useVFSStore.getState().updateFileContent(activeTabId, {
      ...fileContent,
      edges: [...fileContent.edges, viewEdge],
    });
  }
}
