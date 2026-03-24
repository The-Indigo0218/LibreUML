import { useMemo, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import { useToastStore } from '../../../store/toast.store';
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
  NodeSection,
} from '../../../adapters/react-flow/view-models/node.view-model';
import type { Visibility } from '../../../core/domain/vfs/vfs.types';
import type { RelationKind } from '../../../core/domain/vfs/vfs.types';

// ─── Tool → RelationKind mapping ─────────────────────────────────────────────
// Mirrors the palette tool IDs (stored uppercase in file metadata) to semantic kinds.

const TOOL_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION:    'ASSOCIATION',
  INHERITANCE:    'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY:     'DEPENDENCY',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  INCLUDE:        'INCLUDE',
  EXTEND:         'EXTEND',
  GENERALIZATION: 'GENERALIZATION',
};

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

// ─── Visibility symbol ────────────────────────────────────────────────────────

function irVisSymbol(v: Visibility | undefined): string {
  switch (v) {
    case 'private':   return '-';
    case 'protected': return '#';
    case 'package':   return '~';
    default:          return '+';
  }
}

// ─── Section builder ──────────────────────────────────────────────────────────

function buildSections(
  model: SemanticModel,
  element: IRClass | IRInterface | IREnum,
  kind: SemanticKind,
): NodeSection[] {
  const sections: NodeSection[] = [];

  if (kind === 'CLASS' || kind === 'ABSTRACT_CLASS') {
    const cls = element as IRClass;
    const attrs = cls.attributeIds.map((id) => model.attributes[id]).filter(Boolean);
    const ops = cls.operationIds.map((id) => model.operations[id]).filter(Boolean);

    sections.push({
      id: 'attributes',
      items: attrs.map((a) => ({
        id: a.id,
        text: `${irVisSymbol(a.visibility)}${a.name}: ${a.type}`,
        isStatic: a.isStatic,
      })),
    });

    sections.push({
      id: 'operations',
      items: ops.map((o) => {
        const paramsStr = o.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
        // A constructor's name matches the enclosing class name — omit the return type.
        const isConstructor = o.name === element.name;
        const text = isConstructor
          ? `${irVisSymbol(o.visibility)}${o.name}(${paramsStr})`
          : `${irVisSymbol(o.visibility)}${o.name}(${paramsStr}): ${o.returnType ?? 'void'}`;
        return { id: o.id, text, isStatic: o.isStatic, isAbstract: o.isAbstract };
      }),
    });
  } else if (kind === 'INTERFACE') {
    const iface = element as IRInterface;
    const ops = iface.operationIds.map((id) => model.operations[id]).filter(Boolean);

    sections.push({
      id: 'operations',
      items: ops.map((o) => {
        const paramsStr = o.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
        const isConstructor = o.name === element.name;
        const text = isConstructor
          ? `${irVisSymbol(o.visibility)}${o.name}(${paramsStr})`
          : `${irVisSymbol(o.visibility)}${o.name}(${paramsStr}): ${o.returnType ?? 'void'}`;
        return { id: o.id, text, isAbstract: o.isAbstract };
      }),
    });
  } else if (kind === 'ENUM') {
    const enm = element as IREnum;
    sections.push({
      id: 'literals',
      items: enm.literals.map((lit, i) => ({
        id: `${enm.id}-lit-${i}`,
        text: lit.name,
      })),
    });
  }

  return sections;
}

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
  sections: NodeSection[],
  onRename: (name: string, generics?: string) => void,
  badge?: string,
) {
  const viewModel: NodeViewModel = {
    id: viewNode.id,
    domainId: viewNode.elementId,
    label,
    stereotype: displayConfig.stereotype,
    badge: badge || undefined,
    sections,
    style: displayConfig.style,
    metadata: {
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
 * Content is persisted inside the ViewNode itself (content / noteTitle fields).
 * The onSave callback writes updates back to VFSStore so they survive re-renders.
 */
function makeReactFlowNoteNode(
  viewNode: ViewNode,
  onSave: (viewNodeId: string, update: { content?: string; title?: string }) => void,
) {
  const viewModel: NoteViewModel = {
    id: viewNode.id,
    domainId: viewNode.id,
    title: viewNode.noteTitle ?? 'Note',
    content: viewNode.content ?? '',
    onSave: (update) => onSave(viewNode.id, update),
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
  source: string;
  target: string;
  type: string;
  sourceHandle?: string;
  targetHandle?: string;
  style?: CSSProperties;
  data: {
    domainId: string;
    kind: RelationKind;
    isHovered: boolean;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    sourceRole?: string;
    targetRole?: string;
    anchorLocked?: boolean;
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
   * REMOVE: view-only — removes ViewNode + prunes dangling ViewEdges from this
   *         diagram only. Semantic element stays in ModelStore.
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
  /** Deletes a VFS edge by ViewEdge.id (removes IRRelation + ViewEdge). */
  deleteEdgeById: (viewEdgeId: string) => void;
  /** Reverses a VFS edge by swapping IRRelation.sourceId ↔ targetId. */
  reverseEdgeById: (viewEdgeId: string) => void;
  /** Updates a VFS edge's IRRelation.kind (e.g. ASSOCIATION → GENERALIZATION). */
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
  /** Updates display properties (multiplicity, roles, anchor) stored on ViewEdge. */
  updateVFSEdgeProps: (
    viewEdgeId: string,
    props: {
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
      sourceRole?: string;
      targetRole?: string;
      anchorLocked?: boolean;
    },
  ) => void;
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
    if (!project?.domainModelId) return;
    const ms = useModelStore.getState();
    if (!ms.model || ms.model.id !== project.domainModelId) {
      ms.initModel(project.domainModelId);
    }
  }, [project?.domainModelId]);

  // Stable callback: persists note content / title back into the ViewNode inside VFSStore.
  const handleNoteUpdate = useCallback(
    (viewNodeId: string, update: { content?: string; title?: string }) => {
      if (!activeTabId || !diagramView) return;
      const updatedNodes = diagramView.nodes.map((vn) => {
        if (vn.id !== viewNodeId) return vn;
        return {
          ...vn,
          ...(update.content !== undefined ? { content: update.content } : {}),
          ...(update.title !== undefined ? { noteTitle: update.title } : {}),
        };
      });
      useVFSStore.getState().updateFileContent(activeTabId, {
        ...diagramView,
        nodes: updatedNodes,
      });
    },
    [activeTabId, diagramView],
  );

  // Map ViewNodes → ReactFlow nodes.
  // Each node's onRename closure captures elementId and kind for targeted ModelStore updates.
  const nodes = useMemo((): VFSReactFlowNode[] => {
    if (!diagramView || !model) return [];

    return diagramView.nodes.map((viewNode: ViewNode) => {
      const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

      // NOTE nodes are visual-only — no semantic IR backing, no rename callback needed.
      if (kind === 'NOTE') {
        return makeReactFlowNoteNode(viewNode, handleNoteUpdate);
      }

      const label = element?.name ?? 'NewClass';
      const displayConfig = VFS_DISPLAY[kind] ?? VFS_DISPLAY.CLASS;
      const sections = element ? buildSections(model, element, kind) : [];
      const badge = (element as IRClass | IRInterface | IREnum | null)?.packageName ?? undefined;

      const onRename = (name: string, generics?: string) => {
        const ms = useModelStore.getState();
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

      return makeReactFlowNode(viewNode, label, displayConfig, sections, onRename, badge);
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
        type: 'vfsUmlEdge',
        sourceHandle: viewEdge.anchorLocked ? viewEdge.sourceHandle : undefined,
        targetHandle: viewEdge.anchorLocked ? viewEdge.targetHandle : undefined,
        data: {
          domainId: relation.id,
          kind: relation.kind,
          isHovered: false,
          sourceMultiplicity: viewEdge.sourceMultiplicity,
          targetMultiplicity: viewEdge.targetMultiplicity,
          sourceRole: viewEdge.sourceRole,
          targetRole: viewEdge.targetRole,
          anchorLocked: viewEdge.anchorLocked,
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
          // Find the ViewNode before removing it.
          const removedVN = currentView.nodes.find((vn) => vn.id === change.id);
          if (removedVN) {
            // View-only removal: delete the ViewNode from this diagram only.
            // The semantic element stays in ModelStore — it can still appear in other diagrams.
            updatedViewNodes = updatedViewNodes.filter((vn) => vn.id !== change.id);

            // Prune ViewEdges whose relation involves the removed element.
            // (No ModelStore cascade — use "Delete from Model" for that.)
            if (removedVN.elementId) {
              const ms = useModelStore.getState();
              if (ms.model) {
                updatedViewEdges = updatedViewEdges.filter((ve) => {
                  const relation = ms.model!.relations[ve.relationId];
                  if (!relation) return false;
                  return (
                    relation.sourceId !== removedVN.elementId &&
                    relation.targetId !== removedVN.elementId
                  );
                });
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

      // Block self-inheritance and self-realization — UML forbids these.
      const wsState = useWorkspaceStore.getState();
      const rawMode = wsState.connectionModes?.[activeTabId ?? ''] as string | undefined;
      const kind: RelationKind = TOOL_TO_RELATION_KIND[rawMode ?? ''] ?? 'ASSOCIATION';

      const SELF_LOOP_FORBIDDEN = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);
      if (sourceVN.elementId === targetVN.elementId && SELF_LOOP_FORBIDDEN.has(kind)) {
        useToastStore.getState().show('⚠️ Una clase no puede heredar de sí misma');
        return;
      }

      const ms = useModelStore.getState();
      if (!ms.model) return;

      const isExternalFile = !!(fileNode as VFSFile).isExternal;

      // Create semantic relation in ModelStore with the active tool's kind.
      const relationId = ms.createRelation({
        kind,
        sourceId: sourceVN.elementId,
        targetId: targetVN.elementId,
        ...(isExternalFile ? { isExternal: true } : {}),
      });

      // Create visual ViewEdge linked to the new relation.
      const viewEdge: ViewEdge = {
        id: crypto.randomUUID(),
        relationId,
        waypoints: [],
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };

      updateFileContent(activeTabId, {
        ...currentView,
        edges: [...currentView.edges, viewEdge],
      });
    },
    [activeTabId, updateFileContent],
  );

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

      // Prune ViewEdges involving this element — no ModelStore cascade.
      let updatedEdges = currentView.edges;
      if (removedVN.elementId) {
        const ms = useModelStore.getState();
        if (ms.model) {
          updatedEdges = currentView.edges.filter((ve) => {
            const relation = ms.model!.relations[ve.relationId];
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
    [activeTabId, updateFileContent],
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

  // ── updateVFSEdgeProps: used by EditRelationModal ─────────────────────────

  const updateVFSEdgeProps = useCallback(
    (
      viewEdgeId: string,
      props: {
        sourceMultiplicity?: string;
        targetMultiplicity?: string;
        sourceRole?: string;
        targetRole?: string;
        anchorLocked?: boolean;
      },
    ) => {
      if (!activeTabId) return;
      const currentProject = useVFSStore.getState().project;
      if (!currentProject) return;
      const fileNode = currentProject.nodes[activeTabId];
      if (!fileNode || fileNode.type !== 'FILE') return;
      if (!isDiagramView((fileNode as VFSFile).content)) return;

      const currentView = (fileNode as VFSFile).content as DiagramView;
      const updatedEdges = currentView.edges.map((ve) =>
        ve.id === viewEdgeId ? { ...ve, ...props } : ve,
      );
      updateFileContent(activeTabId, { ...currentView, edges: updatedEdges });
    },
    [activeTabId, updateFileContent],
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
    removeNodeFromDiagram,
    deleteElementFromModel,
    deleteEdgeById,
    reverseEdgeById,
    changeEdgeKind,
    updateVFSEdgeProps,
  };
}
