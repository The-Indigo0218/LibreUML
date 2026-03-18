import { useMemo, useCallback, useEffect } from 'react';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { useVFSStore } from '../../../store/vfs.store';
import { useModelStore } from '../../../store/model.store';
import type {
  DiagramView,
  ViewNode,
  ViewEdge,
  VFSFile,
  IRClass,
  IRInterface,
  IREnum,
  SemanticModel,
} from '../../../core/domain/vfs/vfs.types';
import type {
  NodeViewModel,
  NoteViewModel,
  NodeStyleConfig,
} from '../../../adapters/react-flow/view-models/node.view-model';
import type { RelationKind } from '../../../core/domain/vfs/vfs.types';

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Safely checks if an unknown value is a valid DiagramView.
 * Required because VFSFile.content is typed as `unknown | null`.
 */
export function isDiagramView(content: unknown): content is DiagramView {
  return (
    content !== null &&
    typeof content === 'object' &&
    'diagramId' in (content as object) &&
    'nodes' in (content as object) &&
    'edges' in (content as object) &&
    Array.isArray((content as DiagramView).nodes) &&
    Array.isArray((content as DiagramView).edges)
  );
}

// ─── Style registry ───────────────────────────────────────────────────────────

interface ElementDisplayConfig {
  style: NodeStyleConfig;
  stereotype?: string;
}

const VFS_DISPLAY: Record<string, ElementDisplayConfig> = {
  CLASS: {
    style: {
      containerClass: 'bg-uml-class-bg border-uml-class-border',
      headerClass: 'bg-surface-hover border-uml-class-border',
      badgeColor: 'text-uml-class-border',
      labelFormat: 'font-bold',
      showStereotype: false,
    },
  },
  ABSTRACT_CLASS: {
    stereotype: 'abstract',
    style: {
      containerClass: 'bg-uml-abstract-bg border-uml-abstract-border',
      headerClass: 'bg-surface-hover border-uml-abstract-border',
      badgeColor: 'text-uml-abstract-border',
      labelFormat: 'italic font-bold',
      showStereotype: true,
    },
  },
  INTERFACE: {
    stereotype: 'interface',
    style: {
      containerClass: 'bg-uml-interface-bg border-uml-interface-border',
      headerClass: 'bg-surface-secondary border-uml-interface-border',
      badgeColor: 'text-uml-interface-border',
      labelFormat: 'font-normal',
      showStereotype: true,
    },
  },
  ENUM: {
    stereotype: 'enum',
    style: {
      containerClass: 'bg-purple-100 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500',
      headerClass: 'bg-purple-200 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500',
      badgeColor: 'text-purple-700 dark:text-purple-300',
      labelFormat: 'font-bold',
      showStereotype: true,
    },
  },
};

// ─── Semantic resolution ──────────────────────────────────────────────────────

type SemanticKind = 'CLASS' | 'ABSTRACT_CLASS' | 'INTERFACE' | 'ENUM' | 'NOTE' | 'UNKNOWN';

interface ResolvedElement {
  element: IRClass | IRInterface | IREnum | null;
  kind: SemanticKind;
}

/**
 * Looks up a semantic element by ID across all relevant dictionaries in SemanticModel.
 * An empty elementId is the sentinel for visual-only elements (notes).
 */
function resolveSemanticElement(model: SemanticModel, elementId: string): ResolvedElement {
  // Empty elementId = visual-only element (note), no IR backing.
  if (!elementId) return { element: null, kind: 'NOTE' };

  const cls = model.classes[elementId];
  if (cls) {
    return { element: cls, kind: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS' };
  }
  const iface = model.interfaces[elementId];
  if (iface) return { element: iface, kind: 'INTERFACE' };

  const enm = model.enums[elementId];
  if (enm) return { element: enm, kind: 'ENUM' };

  return { element: null, kind: 'UNKNOWN' };
}

// ─── Node builders ────────────────────────────────────────────────────────────

function makeReactFlowNode(
  viewNode: ViewNode,
  label: string,
  displayConfig: ElementDisplayConfig,
  onRename: (name: string, generics?: string) => void,
) {
  const viewModel: NodeViewModel = {
    id: viewNode.id,
    domainId: viewNode.elementId, // stable semantic ID used for updates
    label,
    stereotype: displayConfig.stereotype,
    sections: [],
    style: displayConfig.style,
    metadata: {
      // Callback for UmlClassNode inline rename — writes to ModelStore, not ProjectStore.
      onRename,
    },
  };

  return {
    id: viewNode.id,
    type: 'umlClass',
    position: { x: viewNode.x, y: viewNode.y },
    data: viewModel,
    domainId: viewNode.elementId,
  };
}

/**
 * Builds a ReactFlow note node (visual-only, no IR element).
 * UmlNoteNode will call ProjectStore.updateNode for title/content edits,
 * which silently no-ops since there is no matching ProjectStore entry.
 * Position is persisted via onNodesChange → VFSStore (same as class nodes).
 */
function makeReactFlowNoteNode(viewNode: ViewNode) {
  const viewModel: NoteViewModel = {
    id: viewNode.id,
    domainId: viewNode.id, // No semantic ID; use view node ID as domainId
    title: 'Note',
    content: '',
  };

  return {
    id: viewNode.id,
    type: 'umlNote',
    position: { x: viewNode.x, y: viewNode.y },
    data: viewModel,
  };
}

export type VFSReactFlowNode =
  | ReturnType<typeof makeReactFlowNode>
  | ReturnType<typeof makeReactFlowNoteNode>;

// ─── Edge type ────────────────────────────────────────────────────────────────

export interface VFSReactFlowEdge {
  id: string;
  source: string;  // ReactFlow node ID (ViewNode.id)
  target: string;  // ReactFlow node ID (ViewNode.id)
  type: string;    // 'vfsUmlEdge'
  data: {
    domainId: string;    // IRRelation.id
    kind: RelationKind;  // raw IRRelation.kind — VfsUmlEdge reads this directly
    isHovered: boolean;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface VFSCanvasResult {
  /** True when the active tab is a .luml VFS file with a valid DiagramView. */
  isVFSFile: boolean;
  /** ReactFlow-compatible nodes derived from DiagramView + SemanticModel. */
  nodes: VFSReactFlowNode[];
  /** ReactFlow-compatible edges derived from DiagramView + SemanticModel. */
  edges: VFSReactFlowEdge[];
  /** The raw DiagramView, or null. */
  diagramView: DiagramView | null;
  /** The VFSFile node, or null. */
  vfsFile: VFSFile | null;
  /** Active tab ID from WorkspaceStore. */
  activeTabId: string | null;
  /**
   * onNodesChange handler wired to the VFS layer.
   * POSITION: persists x,y → DiagramView.ViewNode.
   * REMOVE: removes ViewNode + deletes semantic element (cascade-deletes relations)
   *         + prunes orphaned ViewEdges.
   */
  onNodesChange: (changes: NodeChange[]) => void;
  /**
   * onEdgesChange handler wired to the VFS layer.
   * REMOVE: deletes IRRelation from ModelStore + removes ViewEdge from DiagramView.
   */
  onEdgesChange: (changes: EdgeChange[]) => void;
  /**
   * onConnect handler: creates IRRelation in ModelStore + ViewEdge in DiagramView.
   * Default relation kind is ASSOCIATION.
   */
  onConnect: (connection: Connection) => void;
  /** Deletes a VFS edge by ViewEdge.id (removes IRRelation + ViewEdge). */
  deleteEdgeById: (viewEdgeId: string) => void;
  /** Reverses a VFS edge by swapping IRRelation.sourceId ↔ targetId. */
  reverseEdgeById: (viewEdgeId: string) => void;
  /** Updates a VFS edge's IRRelation.kind (e.g. ASSOCIATION → GENERALIZATION). */
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
}

/**
 * useVFSCanvasController
 *
 * Single hook encapsulating all canvas state for VFS .luml files.
 *
 * ISOLATION: `activeTabId` is the reactive key. Switching tabs automatically
 * re-derives nodes/edges from the new tab's DiagramView without any manual cleanup.
 *
 * ARCHITECTURE:
 *   Visual positions (x, y)  → VFSStore  (DiagramView.ViewNode)
 *   Semantic names / kinds   → ModelStore (SemanticModel)
 *   Semantic relations        → ModelStore (SemanticModel.relations)
 *   Visual edge layout        → VFSStore  (DiagramView.ViewEdge)
 */
export function useVFSCanvasController(): VFSCanvasResult {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const model = useModelStore((s) => s.model);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  // Resolve VFS file for the active tab
  const vfsFile = useMemo((): VFSFile | null => {
    if (!activeTabId || !project) return null;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return node as VFSFile;
  }, [activeTabId, project]);

  // Safely extract DiagramView
  const diagramView = useMemo((): DiagramView | null => {
    if (!vfsFile) return null;
    return isDiagramView(vfsFile.content) ? vfsFile.content : null;
  }, [vfsFile]);

  // Ensure ModelStore is initialised and matches the current project.
  //
  // Two cases that require initialisation:
  //   (a) model is null — first visit or cleared storage.
  //   (b) model.id ≠ project.domainModelId — a persisted model from a different project
  //       is in storage; must be replaced so ViewNode.elementId lookups work correctly.
  //
  // Case (b) also acts as cross-project contamination protection now that ModelStore
  // is persisted: if the user switches projects the old model is never used.
  useEffect(() => {
    if (!vfsFile || !project) return;
    const ms = useModelStore.getState();
    if (!ms.model || ms.model.id !== project.domainModelId) {
      ms.initModel(project.domainModelId);
    }
  }, [vfsFile, project]);

  // Map ViewNodes → ReactFlow nodes.
  // Each node's onRename closure captures elementId and kind for targeted ModelStore updates.
  const nodes = useMemo((): VFSReactFlowNode[] => {
    if (!diagramView || !model) return [];

    return diagramView.nodes.map((viewNode: ViewNode) => {
      const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

      // NOTE nodes are visual-only — no semantic IR backing, no rename callback needed.
      if (kind === 'NOTE') {
        return makeReactFlowNoteNode(viewNode);
      }

      const label = element?.name ?? 'NewClass';
      const displayConfig = VFS_DISPLAY[kind] ?? VFS_DISPLAY.CLASS;

      // Each node gets a stable closure over its own elementId and kind.
      const onRename = (name: string, generics?: string) => {
        const ms = useModelStore.getState(); // safe: called from event handler
        if (!ms.model) return;
        switch (kind) {
          case 'CLASS':
          case 'ABSTRACT_CLASS':
            ms.updateClass(viewNode.elementId, {
              name,
              ...(generics !== undefined ? { stereotypes: [generics] } : {}),
            });
            break;
          case 'INTERFACE':
            ms.updateInterface(viewNode.elementId, { name });
            break;
          case 'ENUM':
            ms.updateEnum(viewNode.elementId, { name });
            break;
        }
      };

      return makeReactFlowNode(viewNode, label, displayConfig, onRename);
    });
  }, [diagramView, model]);

  // Map ViewEdges → ReactFlow edges.
  // Requires a reverse lookup from semantic elementId → ReactFlow node ID (ViewNode.id).
  const edges = useMemo((): VFSReactFlowEdge[] => {
    if (!diagramView || !model) return [];

    // Build reverse map: elementId → ViewNode.id (ReactFlow node ID)
    const elementIdToNodeId = new Map<string, string>();
    for (const vn of diagramView.nodes) {
      if (vn.elementId) {
        elementIdToNodeId.set(vn.elementId, vn.id);
      }
    }

    const result: VFSReactFlowEdge[] = [];
    for (const viewEdge of diagramView.edges) {
      const relation = model.relations[viewEdge.relationId];
      if (!relation) continue; // Orphaned ViewEdge — invisible until next explicit delete

      const sourceNodeId = elementIdToNodeId.get(relation.sourceId);
      const targetNodeId = elementIdToNodeId.get(relation.targetId);
      if (!sourceNodeId || !targetNodeId) continue; // Dangling reference — skip

      result.push({
        id: viewEdge.id,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'vfsUmlEdge',  // Purpose-built VFS renderer — reads data.kind directly
        data: {
          domainId: relation.id,
          kind: relation.kind,  // Raw RelationKind — no vocabulary translation needed
          isHovered: false,
        },
      });
    }
    return result;
  }, [diagramView, model]);

  // ── onNodesChange: position drag-save + node removal ──────────────────────

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!activeTabId) return;

      // Read current state directly — this is an event handler, not a render.
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      let updatedViewNodes = currentView.nodes;
      let updatedViewEdges = currentView.edges;
      let dirty = false;

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          // Strict separation: x, y belong to the VFS DiagramView.
          updatedViewNodes = updatedViewNodes.map((vn) =>
            vn.id === change.id
              ? { ...vn, x: change.position!.x, y: change.position!.y }
              : vn,
          );
          dirty = true;
        } else if (change.type === 'remove') {
          // Find the ViewNode to get its semantic elementId before removing.
          const removedVN = currentView.nodes.find((vn) => vn.id === change.id);
          if (removedVN) {
            // Remove from VFS view.
            updatedViewNodes = updatedViewNodes.filter((vn) => vn.id !== change.id);

            // Delete semantic element (notes have empty elementId — skip ModelStore).
            if (removedVN.elementId) {
              const ms = useModelStore.getState();
              if (ms.model) {
                if (ms.model.classes[removedVN.elementId]) {
                  ms.deleteClass(removedVN.elementId);
                } else if (ms.model.interfaces[removedVN.elementId]) {
                  ms.deleteInterface(removedVN.elementId);
                } else if (ms.model.enums[removedVN.elementId]) {
                  ms.deleteEnum(removedVN.elementId);
                }
                // cascadeDeleteRelations ran inside deleteClass/Interface/Enum.
                // Prune ViewEdges whose relationId is no longer in the model.
                const modelAfterDelete = useModelStore.getState().model;
                if (modelAfterDelete) {
                  updatedViewEdges = updatedViewEdges.filter(
                    (ve) => !!modelAfterDelete.relations[ve.relationId],
                  );
                }
              }
            }
            dirty = true;
          }
        }
      }

      if (dirty) {
        updateFileContent(activeTabId, {
          ...currentView,
          nodes: updatedViewNodes,
          edges: updatedViewEdges,
        });
      }
    },
    [activeTabId, updateFileContent],
  );

  // ── onEdgesChange: edge deletion (keyboard Delete / context menu) ──────────

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!activeTabId) return;

      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      let updatedEdges = currentView.edges;
      let dirty = false;

      for (const change of changes) {
        if (change.type === 'remove') {
          const viewEdge = currentView.edges.find((ve) => ve.id === change.id);
          if (viewEdge) {
            // Delete semantic relation from ModelStore.
            const ms = useModelStore.getState();
            if (ms.model && ms.model.relations[viewEdge.relationId]) {
              ms.deleteRelation(viewEdge.relationId);
            }
            // Remove ViewEdge from DiagramView.
            updatedEdges = updatedEdges.filter((ve) => ve.id !== change.id);
            dirty = true;
          }
        }
      }

      if (dirty) {
        updateFileContent(activeTabId, { ...currentView, edges: updatedEdges });
      }
    },
    [activeTabId, updateFileContent],
  );

  // ── onConnect: create edge from handle drag ────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!activeTabId || !connection.source || !connection.target) return;

      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;

      // Resolve ReactFlow node IDs (ViewNode.id) → semantic element IDs.
      const sourceVN = currentView.nodes.find((vn) => vn.id === connection.source);
      const targetVN = currentView.nodes.find((vn) => vn.id === connection.target);
      if (!sourceVN || !targetVN) return;

      // Skip connections involving notes — they have no IR backing.
      if (!sourceVN.elementId || !targetVN.elementId) return;

      const ms = useModelStore.getState();
      if (!ms.model) return;

      // Create semantic relation in ModelStore (default kind: ASSOCIATION).
      const relationId = ms.createRelation({
        kind: 'ASSOCIATION',
        sourceId: sourceVN.elementId,
        targetId: targetVN.elementId,
      });

      // Create visual ViewEdge linked to the new relation.
      const viewEdge: ViewEdge = {
        id: crypto.randomUUID(),
        relationId,
        waypoints: [],
      };

      updateFileContent(activeTabId, {
        ...currentView,
        edges: [...currentView.edges, viewEdge],
      });
    },
    [activeTabId, updateFileContent],
  );

  // ── deleteEdgeById: used by context menu "Delete" ─────────────────────────

  const deleteEdgeById = useCallback(
    (viewEdgeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      const ms = useModelStore.getState();
      if (ms.model && ms.model.relations[viewEdge.relationId]) {
        ms.deleteRelation(viewEdge.relationId);
      }
      updateFileContent(activeTabId, {
        ...currentView,
        edges: currentView.edges.filter((ve) => ve.id !== viewEdgeId),
      });
    },
    [activeTabId, updateFileContent],
  );

  // ── reverseEdgeById: used by context menu "Reverse" ───────────────────────

  const reverseEdgeById = useCallback(
    (viewEdgeId: string) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      const ms = useModelStore.getState();
      if (!ms.model) return;
      const relation = ms.model.relations[viewEdge.relationId];
      if (!relation) return;

      ms.updateRelation(viewEdge.relationId, {
        sourceId: relation.targetId,
        targetId: relation.sourceId,
      });
    },
    [activeTabId],
  );

  // ── changeEdgeKind: used by context menu "Change type" ────────────────────

  const changeEdgeKind = useCallback(
    (viewEdgeId: string, kind: RelationKind) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const viewEdge = currentView.edges.find((ve) => ve.id === viewEdgeId);
      if (!viewEdge) return;

      const ms = useModelStore.getState();
      if (!ms.model) return;
      ms.updateRelation(viewEdge.relationId, { kind });
    },
    [activeTabId],
  );

  return {
    isVFSFile: !!vfsFile && !!diagramView,
    nodes,
    edges,
    diagramView,
    vfsFile,
    activeTabId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    deleteEdgeById,
    reverseEdgeById,
    changeEdgeKind,
  };
}
