import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useToastStore } from '../../store/toast.store';
import { useSelectionStore } from '../../store/selection.store';
import {
  standaloneModelOps,
  getLocalModel,
} from '../../store/standaloneModelOps';
import type {
  DiagramView,
  VFSFile,
  ViewNode,
  IRClass,
  IRInterface,
  IREnum,
} from '../../core/domain/vfs/vfs.types';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

export interface UseNodeActionsParams {
  activeTabId: string | null;
  isStandalone: boolean;
  updateFileContent: (fileId: string, content: DiagramView) => void;
}

export interface UseNodeActionsResult {
  /**
   * View-only removal: removes ViewNode + prunes dangling ViewEdges from THIS
   * diagram only. Semantic element stays in ModelStore (appears in other diagrams).
   */
  removeNodeFromDiagram: (viewNodeId: string) => void;
  /**
   * Full cascade: deletes semantic element from ModelStore + sweeps ViewNodes from
   * ALL diagrams where the element appears. Use for "Delete from Model".
   */
  deleteElementFromModel: (viewNodeId: string) => void;
  /**
   * Duplicates a node: creates a copy of the semantic element and a new ViewNode
   * at +50px offset. Returns the new ViewNode ID for selection.
   */
  duplicateNode: (viewNodeId: string) => string | null;
}

export function useNodeActions({
  activeTabId,
  isStandalone,
  updateFileContent,
}: UseNodeActionsParams): UseNodeActionsResult {
  // ── removeNodeFromDiagram: view-only removal (context menu "Remove from Diagram") ──

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

      const updatedNodes = currentView.nodes.filter((vn) => vn.id !== viewNodeId);

      // Prune ViewEdges involving this element — no cascade into any model store.
      let updatedEdges = currentView.edges;
      if (removedVN.elementId) {
        const activeModel = isStandalone && activeTabId
          ? getLocalModel(activeTabId)
          : useModelStore.getState().model;
        if (activeModel) {
          updatedEdges = currentView.edges.filter((ve) => {
            const relation = activeModel.relations[ve.relationId];
            if (!relation) return false;
            return (
              relation.sourceId !== removedVN.elementId &&
              relation.targetId !== removedVN.elementId
            );
          });
        }
      }

      updateFileContent(activeTabId, { ...currentView, nodes: updatedNodes, edges: updatedEdges });
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  // ── deleteElementFromModel: cascade delete + sweep all diagrams ─────────────

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
        // Standalone path: delete from localModel only — no global cascade.
        const localM = getLocalModel(activeTabId);
        if (!localM) return;

        const elementName =
          localM.classes[elementId]?.name ??
          localM.interfaces[elementId]?.name ??
          localM.enums[elementId]?.name ??
          'Element';

        const ops = standaloneModelOps(activeTabId);
        if (localM.classes[elementId])         ops.deleteClass(elementId);
        else if (localM.interfaces[elementId]) ops.deleteInterface(elementId);
        else if (localM.enums[elementId])      ops.deleteEnum(elementId);

        useToastStore.getState().show(`"${elementName}" deleted from standalone diagram`);

        // Sweep this file's DiagramView only (relations cascade-deleted inside ops).
        const modelAfterDelete = getLocalModel(activeTabId);
        const updatedNodes = currentView.nodes.filter((vn) => vn.elementId !== elementId);
        const updatedEdges = currentView.edges.filter(
          (ve) => modelAfterDelete && !!modelAfterDelete.relations[ve.relationId],
        );
        updateFileContent(activeTabId, { ...currentView, nodes: updatedNodes, edges: updatedEdges });
        return;
      }

      // Cascade delete from ModelStore (removes IRRelation entries too).
      const ms = useModelStore.getState();
      if (ms.model) {
        const elementName =
          ms.model.classes[elementId]?.name ??
          ms.model.interfaces[elementId]?.name ??
          ms.model.enums[elementId]?.name ??
          'Element';

        if (ms.model.classes[elementId])         ms.deleteClass(elementId);
        else if (ms.model.interfaces[elementId]) ms.deleteInterface(elementId);
        else if (ms.model.enums[elementId])      ms.deleteEnum(elementId);

        useToastStore.getState().show(`"${elementName}" deleted from model`);
      }

      // Sweep ALL diagram files: remove the ViewNode and prune orphaned ViewEdges.
      const modelAfterDelete = useModelStore.getState().model;
      const projectAfterDelete = useVFSStore.getState().project;
      if (!projectAfterDelete) return;

      for (const [nodeId, node] of Object.entries(projectAfterDelete.nodes)) {
        if (node.type !== 'FILE') continue;
        const content = (node as VFSFile).content;
        if (!isDiagramView(content)) continue;

        const view = content as DiagramView;
        const hasElement = view.nodes.some((vn) => vn.elementId === elementId);
        if (!hasElement) continue;

        const updatedNodes = view.nodes.filter((vn) => vn.elementId !== elementId);
        const updatedEdges = view.edges.filter(
          (ve) => modelAfterDelete && !!modelAfterDelete.relations[ve.relationId],
        );
        useVFSStore.getState().updateFileContent(nodeId, { ...view, nodes: updatedNodes, edges: updatedEdges });
      }
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  // ── duplicateNode: create a copy of the semantic element + ViewNode ─────────

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

      // Handle NOTE duplication (no semantic element)
      if (!sourceVN.elementId) {
        const newViewNode: ViewNode = {
          id: crypto.randomUUID(),
          elementId: '',
          x: sourceVN.x + 50,
          y: sourceVN.y + 50,
          content: sourceVN.content,
          noteTitle: sourceVN.noteTitle ? `${sourceVN.noteTitle} 2` : 'Note 2',
        };

        updateFileContent(activeTabId, {
          ...currentView,
          nodes: [...currentView.nodes, newViewNode],
        });

        // Select the new node
        useSelectionStore.getState().setSelectedNodes([newViewNode.id]);
        return newViewNode.id;
      }

      // Duplicate semantic element
      const elementId = sourceVN.elementId;
      let newElementId = '';
      let newElementName = '';

      if (isStandalone) {
        const localM = getLocalModel(activeTabId);
        if (!localM) return null;

        const ops = standaloneModelOps(activeTabId);
        const cls = localM.classes[elementId];
        const iface = localM.interfaces[elementId];
        const enm = localM.enums[elementId];

        if (cls) {
          // Generate next name
          const existingNames = Object.values(localM.classes)
            .filter((c) => (cls.isAbstract ? !!c.isAbstract : !c.isAbstract))
            .map((c) => c.name);
          newElementName = getNextName(existingNames, cls.name);

          // Deep clone attributes
          const newAttributeIds: string[] = [];
          const newAttributes: IRAttribute[] = [];
          for (const attrId of cls.attributeIds) {
            const attr = localM.attributes[attrId];
            if (attr) {
              const newAttrId = crypto.randomUUID();
              newAttributes.push({ ...attr, id: newAttrId });
              newAttributeIds.push(newAttrId);
            }
          }

          // Deep clone operations
          const newOperationIds: string[] = [];
          const newOperations: IROperation[] = [];
          for (const opId of cls.operationIds) {
            const op = localM.operations[opId];
            if (op) {
              const newOpId = crypto.randomUUID();
              newOperations.push({ ...op, id: newOpId });
              newOperationIds.push(newOpId);
            }
          }

          newElementId = cls.isAbstract
            ? ops.createAbstractClass({
                name: newElementName,
                attributeIds: newAttributeIds,
                operationIds: newOperationIds,
                stereotypes: cls.stereotypes,
                packageName: cls.packageName,
              })
            : ops.createClass({
                name: newElementName,
                attributeIds: newAttributeIds,
                operationIds: newOperationIds,
                stereotypes: cls.stereotypes,
                packageName: cls.packageName,
              });

          // Add attributes and operations to model
          ops.setElementMembers(newElementId, newAttributes, newOperations);
        } else if (iface) {
          const existingNames = Object.values(localM.interfaces).map((i) => i.name);
          newElementName = getNextName(existingNames, iface.name);

          // Deep clone operations
          const newOperationIds: string[] = [];
          const newOperations: IROperation[] = [];
          for (const opId of iface.operationIds) {
            const op = localM.operations[opId];
            if (op) {
              const newOpId = crypto.randomUUID();
              newOperations.push({ ...op, id: newOpId });
              newOperationIds.push(newOpId);
            }
          }

          newElementId = ops.createInterface({
            name: newElementName,
            operationIds: newOperationIds,
            stereotypes: iface.stereotypes,
            packageName: iface.packageName,
          });

          // Add operations to model
          ops.setElementMembers(newElementId, [], newOperations);
        } else if (enm) {
          const existingNames = Object.values(localM.enums).map((e) => e.name);
          newElementName = getNextName(existingNames, enm.name);

          newElementId = ops.createEnum({
            name: newElementName,
            literals: [...enm.literals],
            packageName: enm.packageName,
          });
        }
      } else {
        const ms = useModelStore.getState();
        if (!ms.model) return null;

        const cls = ms.model.classes[elementId];
        const iface = ms.model.interfaces[elementId];
        const enm = ms.model.enums[elementId];

        if (cls) {
          const existingNames = Object.values(ms.model.classes)
            .filter((c) => (cls.isAbstract ? !!c.isAbstract : !c.isAbstract))
            .map((c) => c.name);
          newElementName = getNextName(existingNames, cls.name);

          // Deep clone attributes
          const newAttributeIds: string[] = [];
          const newAttributes: IRAttribute[] = [];
          for (const attrId of cls.attributeIds) {
            const attr = ms.model.attributes[attrId];
            if (attr) {
              const newAttrId = crypto.randomUUID();
              newAttributes.push({ ...attr, id: newAttrId });
              newAttributeIds.push(newAttrId);
            }
          }

          // Deep clone operations
          const newOperationIds: string[] = [];
          const newOperations: IROperation[] = [];
          for (const opId of cls.operationIds) {
            const op = ms.model.operations[opId];
            if (op) {
              const newOpId = crypto.randomUUID();
              newOperations.push({ ...op, id: newOpId });
              newOperationIds.push(newOpId);
            }
          }

          newElementId = cls.isAbstract
            ? ms.createAbstractClass({
                name: newElementName,
                attributeIds: newAttributeIds,
                operationIds: newOperationIds,
                stereotypes: cls.stereotypes,
                packageName: cls.packageName,
                isExternal: cls.isExternal,
              })
            : ms.createClass({
                name: newElementName,
                attributeIds: newAttributeIds,
                operationIds: newOperationIds,
                stereotypes: cls.stereotypes,
                packageName: cls.packageName,
                isExternal: cls.isExternal,
              });

          // Add attributes and operations to model
          ms.setElementMembers(newElementId, newAttributes, newOperations);
        } else if (iface) {
          const existingNames = Object.values(ms.model.interfaces).map((i) => i.name);
          newElementName = getNextName(existingNames, iface.name);

          // Deep clone operations
          const newOperationIds: string[] = [];
          const newOperations: IROperation[] = [];
          for (const opId of iface.operationIds) {
            const op = ms.model.operations[opId];
            if (op) {
              const newOpId = crypto.randomUUID();
              newOperations.push({ ...op, id: newOpId });
              newOperationIds.push(newOpId);
            }
          }

          newElementId = ms.createInterface({
            name: newElementName,
            operationIds: newOperationIds,
            stereotypes: iface.stereotypes,
            packageName: iface.packageName,
            isExternal: iface.isExternal,
          });

          // Add operations to model
          ms.setElementMembers(newElementId, [], newOperations);
        } else if (enm) {
          const existingNames = Object.values(ms.model.enums).map((e) => e.name);
          newElementName = getNextName(existingNames, enm.name);

          newElementId = ms.createEnum({
            name: newElementName,
            literals: [...enm.literals],
            packageName: enm.packageName,
            isExternal: enm.isExternal,
          });
        }
      }

      if (!newElementId) return null;

      // Create new ViewNode at +50px offset
      const newViewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId: newElementId,
        x: sourceVN.x + 50,
        y: sourceVN.y + 50,
      };

      updateFileContent(activeTabId, {
        ...currentView,
        nodes: [...currentView.nodes, newViewNode],
      });

      // Select the new node
      useSelectionStore.getState().setSelectedNodes([newViewNode.id]);

      return newViewNode.id;
    },
    [activeTabId, updateFileContent, isStandalone],
  );

  return {
    removeNodeFromDiagram,
    deleteElementFromModel,
    duplicateNode,
  };
}

/**
 * Generates the next name for a duplicated element.
 * Examples:
 *   "MyClass" → "MyClass 2"
 *   "MyClass 2" → "MyClass 3"
 *   "Class 5" → "Class 6"
 */
function getNextName(existingNames: string[], baseName: string): string {
  // Check if name already has a number suffix
  const match = baseName.match(/^(.+?)\s+(\d+)$/);
  
  if (match) {
    // Name has number suffix (e.g., "Class 2")
    const prefix = match[1];
    const pattern = new RegExp(`^${escapeRegex(prefix)}\\s+(\\d+)$`);
    let max = 0;
    
    for (const name of existingNames) {
      const m = name.match(pattern);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    
    return `${prefix} ${max + 1}`;
  } else {
    // Name has no number suffix (e.g., "MyClass")
    // Check if "MyClass 2", "MyClass 3", etc. exist
    const pattern = new RegExp(`^${escapeRegex(baseName)}\\s+(\\d+)$`);
    let max = 1; // Start at 2 (MyClass → MyClass 2)
    
    for (const name of existingNames) {
      const m = name.match(pattern);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    
    return `${baseName} ${max + 1}`;
  }
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
