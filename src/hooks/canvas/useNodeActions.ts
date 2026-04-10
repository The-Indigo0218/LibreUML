import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useToastStore } from '../../store/toast.store';
import { useSelectionStore } from '../../store/selection.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
import type {
  DiagramView,
  VFSFile,
  ViewNode,
  IRAttribute,
  IROperation,
  SemanticModel,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

function cascadeDeleteRelations(model: SemanticModel, elementId: string) {
  for (const rid of Object.keys(model.relations)) {
    const rel = model.relations[rid];
    if (rel.sourceId === elementId || rel.targetId === elementId) {
      delete model.relations[rid];
    }
  }
}

function getNextName(existingNames: string[], baseName: string): string {
  const base = baseName.replace(/\s+\d+$/, '');
  let n = 2;
  while (existingNames.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export interface UseNodeActionsParams {
  activeTabId: string | null;
  isStandalone: boolean;
  updateFileContent: (fileId: string, content: DiagramView) => void;
}

export interface UseNodeActionsResult {
  removeNodeFromDiagram: (viewNodeId: string) => void;
  deleteElementFromModel: (viewNodeId: string) => void;
  duplicateNode: (viewNodeId: string) => string | null;
}

export function useNodeActions({
  activeTabId,
  isStandalone,
  updateFileContent,
}: UseNodeActionsParams): UseNodeActionsResult {
  const removeNodeFromDiagram = useCallback(
    (viewNodeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const removedVN = currentView.nodes.find((vn) => vn.id === viewNodeId);
      if (!removedVN) return;

      const activeModel = isStandalone ? getLocalModel(activeTabId) : useModelStore.getState().model;

      const updatedNodes = currentView.nodes.filter((vn) => vn.id !== viewNodeId);
      let updatedEdges = currentView.edges;
      if (removedVN.elementId && activeModel) {
        updatedEdges = currentView.edges.filter((ve) => {
          const relation = activeModel.relations[ve.relationId];
          if (!relation) return false;
          return relation.sourceId !== removedVN.elementId && relation.targetId !== removedVN.elementId;
        });
      }

      withUndo('vfs', 'Remove from Diagram', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        node.content.nodes = updatedNodes;
        node.content.edges = updatedEdges;
      });
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  const deleteElementFromModel = useCallback(
    (viewNodeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const removedVN = currentView.nodes.find((vn) => vn.id === viewNodeId);
      if (!removedVN?.elementId) return;

      const elementId = removedVN.elementId;

      if (isStandalone) {
        const localM = getLocalModel(activeTabId);
        if (!localM) return;

        const elementName =
          localM.classes[elementId]?.name ??
          localM.interfaces[elementId]?.name ??
          localM.enums[elementId]?.name ??
          localM.packages[elementId]?.name ??
          'Element';

        undoTransaction({
          label: `Delete: ${elementName}`,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              const lm: SemanticModel | undefined = node.localModel;
              if (!lm) return;
              if (lm.classes[elementId])         { delete lm.classes[elementId]; }
              else if (lm.interfaces[elementId]) { delete lm.interfaces[elementId]; }
              else if (lm.enums[elementId])      { delete lm.enums[elementId]; }
              else if (lm.packages[elementId])   { delete lm.packages[elementId]; }
              cascadeDeleteRelations(lm, elementId);
              lm.updatedAt = Date.now();
              if (isDiagramView(node.content)) {
                node.content.nodes = node.content.nodes.filter((vn: ViewNode) => vn.elementId !== elementId);
                node.content.edges = node.content.edges.filter(
                  (ve: any) => !!lm.relations[ve.relationId],
                );
              }
            },
          }],
        });

        useToastStore.getState().show(`"${elementName}" deleted from standalone diagram`);
      } else {
        const ms = useModelStore.getState();
        if (!ms.model) return;

        const elementName =
          ms.model.classes[elementId]?.name ??
          ms.model.interfaces[elementId]?.name ??
          ms.model.enums[elementId]?.name ??
          ms.model.packages[elementId]?.name ??
          'Element';

        const projectSnapshot = currentProject;

        undoTransaction({
          label: `Delete: ${elementName}`,
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                if (draft.model.classes[elementId])         { delete draft.model.classes[elementId]; }
                else if (draft.model.interfaces[elementId]) { delete draft.model.interfaces[elementId]; }
                else if (draft.model.enums[elementId])      { delete draft.model.enums[elementId]; }
                else if (draft.model.packages[elementId])   { delete draft.model.packages[elementId]; }
                cascadeDeleteRelations(draft.model, elementId);
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                if (!draft.project) return;
                const remainingRelIds = new Set(
                  Object.keys(projectSnapshot.nodes).flatMap((nid) => {
                    const n = projectSnapshot.nodes[nid];
                    if (n.type !== 'FILE' || !isDiagramView((n as VFSFile).content)) return [];
                    return ((n as VFSFile).content as DiagramView).edges.map((e: any) => e.relationId);
                  }),
                );
                for (const [nid, node] of Object.entries(draft.project.nodes) as [string, any][]) {
                  if (node.type !== 'FILE' || !isDiagramView(node.content)) continue;
                  const hasEl = node.content.nodes.some((vn: ViewNode) => vn.elementId === elementId);
                  if (!hasEl) continue;
                  node.content.nodes = node.content.nodes.filter((vn: ViewNode) => vn.elementId !== elementId);
                  node.content.edges = node.content.edges.filter(
                    (ve: any) => !remainingRelIds.has(ve.relationId) ? false : true,
                  );
                  void nid;
                }
              },
            },
          ],
          affectedElementIds: [elementId],
        });

        useToastStore.getState().show(`"${elementName}" deleted from model`);
      }
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  const duplicateNode = useCallback(
    (viewNodeId: string): string | null => {
      if (!activeTabId) return null;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return null;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return null;
      if (!isDiagramView((fileNode as VFSFile).content)) return null;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const sourceVN = currentView.nodes.find((vn) => vn.id === viewNodeId);
      if (!sourceVN) return null;

      // NOTE-only duplicate (no semantic element)
      if (!sourceVN.elementId) {
        const newViewNode: ViewNode = {
          id: crypto.randomUUID(),
          elementId: '',
          x: sourceVN.x + 50,
          y: sourceVN.y + 50,
          content: sourceVN.content,
          noteTitle: sourceVN.noteTitle ? `${sourceVN.noteTitle} 2` : 'Note 2',
        };
        withUndo('vfs', 'Duplicate Note', activeTabId, (draft: any) => {
          const node = draft.project?.nodes[activeTabId];
          if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
          node.content.nodes.push(newViewNode);
        });
        useSelectionStore.getState().setSelectedNodes([newViewNode.id]);
        return newViewNode.id;
      }

      const elementId = sourceVN.elementId;
      const newViewNodeId = crypto.randomUUID();
      const newElementId = crypto.randomUUID();

      if (isStandalone) {
        const localM = getLocalModel(activeTabId);
        if (!localM) return null;

        const cls = localM.classes[elementId];
        const iface = localM.interfaces[elementId];
        const enm = localM.enums[elementId];

        undoTransaction({
          label: 'Duplicate Node',
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !node.localModel) return;
              const lm: SemanticModel = node.localModel;

              if (cls) {
                const newAttrIds: string[] = [];
                const newAttrs: IRAttribute[] = [];
                for (const aid of cls.attributeIds) {
                  const a = lm.attributes[aid]; if (!a) continue;
                  const nid = crypto.randomUUID();
                  newAttrs.push({ ...a, id: nid }); newAttrIds.push(nid);
                }
                const newOpIds: string[] = [];
                const newOps: IROperation[] = [];
                for (const oid of cls.operationIds) {
                  const o = lm.operations[oid]; if (!o) continue;
                  const nid = crypto.randomUUID();
                  newOps.push({ ...o, id: nid }); newOpIds.push(nid);
                }
                const existingNames = Object.values(lm.classes).map((c: any) => c.name);
                const newName = getNextName(existingNames, cls.name);
                lm.classes[newElementId] = { ...cls, id: newElementId, name: newName, attributeIds: newAttrIds, operationIds: newOpIds };
                newAttrs.forEach((a) => { lm.attributes[a.id] = a; });
                newOps.forEach((o) => { lm.operations[o.id] = o; });
              } else if (iface) {
                const newOpIds: string[] = [];
                const newOps: IROperation[] = [];
                for (const oid of iface.operationIds) {
                  const o = lm.operations[oid]; if (!o) continue;
                  const nid = crypto.randomUUID();
                  newOps.push({ ...o, id: nid }); newOpIds.push(nid);
                }
                const existingNames = Object.values(lm.interfaces).map((i: any) => i.name);
                const newName = getNextName(existingNames, iface.name);
                lm.interfaces[newElementId] = { ...iface, id: newElementId, name: newName, operationIds: newOpIds };
                newOps.forEach((o) => { lm.operations[o.id] = o; });
              } else if (enm) {
                const existingNames = Object.values(lm.enums).map((e: any) => e.name);
                const newName = getNextName(existingNames, enm.name);
                lm.enums[newElementId] = { ...enm, id: newElementId, name: newName };
              }
              lm.updatedAt = Date.now();

              if (isDiagramView(node.content)) {
                node.content.nodes.push({ id: newViewNodeId, elementId: newElementId, x: sourceVN.x + 50, y: sourceVN.y + 50 });
              }
            },
          }],
        });
      } else {
        const ms = useModelStore.getState();
        if (!ms.model) return null;

        const cls = ms.model.classes[elementId];
        const iface = ms.model.interfaces[elementId];
        const enm = ms.model.enums[elementId];

        // Pre-compute new IDs for attrs/ops outside the transaction so they're consistent
        const attrMap = new Map<string, string>();
        const opMap = new Map<string, string>();
        if (cls) {
          cls.attributeIds.forEach((id) => attrMap.set(id, crypto.randomUUID()));
          cls.operationIds.forEach((id) => opMap.set(id, crypto.randomUUID()));
        } else if (iface) {
          iface.operationIds.forEach((id) => opMap.set(id, crypto.randomUUID()));
        }

        undoTransaction({
          label: 'Duplicate Node',
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                const m = draft.model;
                if (cls) {
                  const newAttrIds = cls.attributeIds.map((id: string) => attrMap.get(id)!);
                  const newOpIds = cls.operationIds.map((id: string) => opMap.get(id)!);
                  cls.attributeIds.forEach((id: string) => {
                    const a = m.attributes[id]; if (a) m.attributes[attrMap.get(id)!] = { ...a, id: attrMap.get(id)! };
                  });
                  cls.operationIds.forEach((id: string) => {
                    const o = m.operations[id]; if (o) m.operations[opMap.get(id)!] = { ...o, id: opMap.get(id)! };
                  });
                  const existingNames = Object.values(m.classes).map((c: any) => c.name);
                  const newName = getNextName(existingNames, cls.name);
                  m.classes[newElementId] = { ...cls, id: newElementId, name: newName, attributeIds: newAttrIds, operationIds: newOpIds };
                } else if (iface) {
                  const newOpIds = iface.operationIds.map((id: string) => opMap.get(id)!);
                  iface.operationIds.forEach((id: string) => {
                    const o = m.operations[id]; if (o) m.operations[opMap.get(id)!] = { ...o, id: opMap.get(id)! };
                  });
                  const existingNames = Object.values(m.interfaces).map((i: any) => i.name);
                  const newName = getNextName(existingNames, iface.name);
                  m.interfaces[newElementId] = { ...iface, id: newElementId, name: newName, operationIds: newOpIds };
                } else if (enm) {
                  const existingNames = Object.values(m.enums).map((e: any) => e.name);
                  const newName = getNextName(existingNames, enm.name);
                  m.enums[newElementId] = { ...enm, id: newElementId, name: newName };
                }
                m.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                node.content.nodes.push({ id: newViewNodeId, elementId: newElementId, x: sourceVN.x + 50, y: sourceVN.y + 50 });
              },
            },
          ],
        });
      }

      useSelectionStore.getState().setSelectedNodes([newViewNodeId]);
      return newViewNodeId;
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  return { removeNodeFromDiagram, deleteElementFromModel, duplicateNode };
}
