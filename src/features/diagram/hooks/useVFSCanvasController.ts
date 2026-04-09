import { useMemo, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type {
  KonvaNodeChange,
  KonvaEdgeChange,
  KonvaConnection,
} from '../../../canvas/types/canvas.types';
import { useWorkspaceStore } from '../../../store/workspace.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import {
  ensureLocalModel,
  standaloneModelOps,
} from '../../../store/standaloneModelOps';
import {
  useCanvasEventHandlers,
  useNodeActions,
  useEdgeActions,
} from '../../../hooks/canvas';
import type {
  DiagramView,
  ViewNode,
  VFSFile,
  VFSFolder,
  LibreUMLProject,
  IRClass,
  IRInterface,
  IREnum,
  IRPackage,
  SemanticModel,
  RelationKind,
} from '../../../core/domain/vfs/vfs.types';
import type {
  NodeViewModel,
  NoteViewModel,
  PackageViewModel,
  NodeStyleConfig,
  NodeSection,
} from '../../../adapters/react-flow/view-models/node.view-model';
import type { Visibility } from '../../../core/domain/vfs/vfs.types';

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

type SemanticKind = 'CLASS' | 'ABSTRACT_CLASS' | 'INTERFACE' | 'ENUM' | 'PACKAGE' | 'NOTE' | 'UNKNOWN';

interface ResolvedElement {
  element: IRClass | IRInterface | IREnum | IRPackage | null;
  kind: SemanticKind;
}

/**
 * Looks up a semantic element by ID across all relevant dictionaries in SemanticModel.
 * An empty elementId is the sentinel for visual-only elements (notes).
 */
function resolveSemanticElement(model: SemanticModel, elementId: string): ResolvedElement {
  if (!elementId) return { element: null, kind: 'NOTE' };

  const cls = model.classes[elementId];
  if (cls) {
    return { element: cls, kind: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS' };
  }
  const iface = model.interfaces[elementId];
  if (iface) return { element: iface, kind: 'INTERFACE' };

  const enm = model.enums[elementId];
  if (enm) return { element: enm, kind: 'ENUM' };

  const pkg = model.packages[elementId];
  if (pkg) return { element: pkg, kind: 'PACKAGE' };

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

function makeReactFlowPackageNode(
  viewNode: ViewNode,
  pkg: IRPackage,
  allViewNodes: ViewNode[],
) {
  const childCount = allViewNodes.filter(vn => vn.parentPackageId === viewNode.id).length;
  
  const depth = (() => {
    let d = 0;
    let currentId = viewNode.parentPackageId;
    while (currentId && d < 10) {
      const parent = allViewNodes.find(vn => vn.id === currentId);
      if (!parent) break;
      d++;
      currentId = parent.parentPackageId;
    }
    return d;
  })();

  const viewModel: PackageViewModel = {
    __brand: 'package',
    id: viewNode.id,
    name: pkg.name,
    collapsed: viewNode.collapsed ?? false,
    color: viewNode.color,
    childCount,
    depth,
  };

  return {
    id: viewNode.id,
    type: 'umlPackage',
    position: { x: viewNode.x, y: viewNode.y },
    data: viewModel,
    domainId: viewNode.elementId,
  };
}

export type VFSReactFlowNode =
  | ReturnType<typeof makeReactFlowNode>
  | ReturnType<typeof makeReactFlowNoteNode>
  | ReturnType<typeof makeReactFlowPackageNode>;

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
  /** True when the active file is a standalone diagram (uses localModel). */
  isStandalone: boolean;
  /** The file's localModel when isStandalone, otherwise null. */
  localModel: SemanticModel | null;
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
  /** Konva-native onConnect handler (creates relation). */
  onConnect: (connection: KonvaConnection) => void;
  /** Konva-typed onNodesChange — used by useKonvaCanvasController. */
  onKonvaNodesChange: (changes: KonvaNodeChange[]) => void;
  /** Konva-typed onEdgesChange — used by useKonvaCanvasController. */
  onKonvaEdgesChange: (changes: KonvaEdgeChange[]) => void;
  /** View-only removal: removes ViewNode from this diagram only. */
  removeNodeFromDiagram: (viewNodeId: string) => void;
  /** Full cascade: deletes semantic element from ModelStore + all diagrams. */
  deleteElementFromModel: (viewNodeId: string) => void;
  /** Duplicates a node: creates a copy of the semantic element and ViewNode at +50px offset. */
  duplicateNode: (viewNodeId: string) => void;
  /** Deletes a VFS edge by ViewEdge.id. */
  deleteEdgeById: (viewEdgeId: string) => void;
  /** Reverses a VFS edge by swapping source ↔ target. */
  reverseEdgeById: (viewEdgeId: string) => void;
  /** Updates a VFS edge's IRRelation.kind. */
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
  /** Updates display properties stored on ViewEdge. */
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

// ─── Auto-VFS project generation ────────────────────────────────────────────

/**
 * Creates a default VFS project with a single empty class diagram file,
 * loads it into VFSStore, and opens a tab for the diagram.
 * Called silently when no project exists so the canvas is always VFS-backed.
 */
function ensureDefaultVFSProject(): void {
  const vfs = useVFSStore.getState();
  if (vfs.project) return; // Already has a project

  const now = Date.now();
  const projectId = crypto.randomUUID();
  const modelFileId = crypto.randomUUID();
  const diagramsFolderId = crypto.randomUUID();
  const defaultDiagramId = crypto.randomUUID();

  const modelFile: VFSFile = {
    id: modelFileId,
    name: 'domain.model',
    type: 'FILE',
    parentId: null,
    diagramType: 'UNSPECIFIED',
    extension: '.model',
    isExternal: false,
    content: null,
    createdAt: now,
    updatedAt: now,
  };

  const diagramsFolder: VFSFolder = {
    id: diagramsFolderId,
    name: 'diagrams',
    type: 'FOLDER',
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  const defaultDiagram: VFSFile = {
    id: defaultDiagramId,
    name: 'Main.luml',
    type: 'FILE',
    parentId: diagramsFolderId,
    diagramType: 'CLASS_DIAGRAM',
    extension: '.luml',
    isExternal: false,
    content: {
      diagramId: defaultDiagramId,
      nodes: [],
      edges: [],
    } as DiagramView,
    createdAt: now,
    updatedAt: now,
  };

  const project: LibreUMLProject = {
    id: projectId,
    projectName: 'Untitled Project',
    version: '1.0.0',
    domainModelId: modelFileId,
    nodes: {
      [modelFileId]: modelFile,
      [diagramsFolderId]: diagramsFolder,
      [defaultDiagramId]: defaultDiagram,
    },
    createdAt: now,
    updatedAt: now,
  };

  vfs.loadProject(project);
  useWorkspaceStore.getState().openTab(defaultDiagramId);
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
  const globalModel = useModelStore((s) => s.model);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  // Auto-generate a default VFS project if none exists.
  // This ensures the canvas always has a VFS-backed diagram to render.
  useEffect(() => {
    if (!project) {
      ensureDefaultVFSProject();
    }
  }, [project]);

  // Resolve VFS file for the active tab
  const vfsFile = useMemo((): VFSFile | null => {
    if (!activeTabId || !project) return null;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return node as VFSFile;
  }, [activeTabId, project]);

  const isStandalone = vfsFile?.standalone === true;

  // Subscribe to localModel from VFSStore (reactive — updates when model mutates)
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  // Active model: per-file local for standalone, shared global for project files
  const model = isStandalone ? localModel : globalModel;

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

  // Backward-compat: standalone files created before localModel was introduced
  // (or ejected via handleMakeStandalone) may lack a localModel. Seed it lazily.
  useEffect(() => {
    if (!activeTabId || !isStandalone) return;
    ensureLocalModel(activeTabId);
  }, [activeTabId, isStandalone]);

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

  const nodes = useMemo((): VFSReactFlowNode[] => {
    if (!diagramView || !model) return [];

    return diagramView.nodes.map((viewNode: ViewNode) => {
      const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

      if (kind === 'NOTE') {
        return makeReactFlowNoteNode(viewNode, handleNoteUpdate);
      }

      if (kind === 'PACKAGE') {
        return makeReactFlowPackageNode(viewNode, element as IRPackage, diagramView.nodes);
      }

      const label = element?.name ?? 'NewClass';
      const displayConfig = VFS_DISPLAY[kind] ?? VFS_DISPLAY.CLASS;
      const sections = element ? buildSections(model, element as IRClass | IRInterface | IREnum, kind) : [];
      const badge = (element as IRClass | IRInterface | IREnum | null)?.packageName ?? undefined;

      const onRename = (name: string, generics?: string) => {
        if (isStandalone && activeTabId) {
          const ops = standaloneModelOps(activeTabId);
          switch (kind) {
            case 'CLASS':
            case 'ABSTRACT_CLASS':
              ops.updateClass(viewNode.elementId, {
                name,
                ...(generics !== undefined ? { stereotypes: [generics] } : {}),
              });
              break;
            case 'INTERFACE':
              ops.updateInterface(viewNode.elementId, { name });
              break;
            case 'ENUM':
              ops.updateEnum(viewNode.elementId, { name });
              break;
          }
        } else {
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
        }
      };

      return makeReactFlowNode(viewNode, label, displayConfig, sections, onRename, badge);
    });
  }, [diagramView, model, isStandalone, activeTabId, handleNoteUpdate]);

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

  // ── Delegate to extracted hooks ───────────────────────────────────────────

  const eventHandlers = useCanvasEventHandlers({
    activeTabId,
    isStandalone,
    updateFileContent,
  });

  const nodeActions = useNodeActions({
    activeTabId,
    isStandalone,
    updateFileContent,
  });

  const edgeActions = useEdgeActions({
    activeTabId,
    isStandalone,
    updateFileContent,
  });

  return {
    isVFSFile: !!vfsFile && !!diagramView,
    isStandalone,
    localModel,
    nodes,
    edges,
    diagramView,
    vfsFile,
    activeTabId,
    onConnect: eventHandlers.onConnect,
    onKonvaNodesChange: eventHandlers.onNodesChange,
    onKonvaEdgesChange: eventHandlers.onEdgesChange,
    removeNodeFromDiagram: nodeActions.removeNodeFromDiagram,
    deleteElementFromModel: nodeActions.deleteElementFromModel,
    duplicateNode: nodeActions.duplicateNode,
    deleteEdgeById: edgeActions.deleteEdgeById,
    reverseEdgeById: edgeActions.reverseEdgeById,
    changeEdgeKind: edgeActions.changeEdgeKind,
    updateVFSEdgeProps: edgeActions.updateVFSEdgeProps,
  };
}
