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
} from '../../../store/standaloneModelOps';
import {
  useCanvasEventHandlers,
  useNodeActions,
  useEdgeActions,
} from '../../../hooks/canvas';
import type { NodeStylePatch } from '../../../hooks/canvas/useNodeActions';
import type { EdgeStylePatch } from '../../../hooks/canvas/useEdgeActions';
import type {
  DiagramView,
  VFSFile,
  VFSFolder,
  LibreUMLProject,
  SemanticModel,
  RelationKind,
  EdgeRoutingMode,
  NodeBorderStyle,
} from '../../../core/domain/vfs/vfs.types';
import { buildClassDiagramNodes } from './controllers/classDiagramNodes';
import { buildUseCaseDiagramNodes } from './controllers/useCaseDiagramNodes';
import { buildDomainModelNodes } from './controllers/domainModelNodes';
import { buildSequenceDiagramNodes } from './controllers/sequenceDiagramNodes';
import {
  resolveSemanticElement,
  type NodeBuilderContext,
} from './controllers/sharedNodeBuilders';
import type {
  AnyNodeViewModel,
} from '../../../adapters/view-models/node.view-model';

// ─── Module-scoped state ──────────────────────────────────────────────────────

/** Per-tab dedup for orphan elementId warnings — fires once per session per tab. */
const warnedOrphanTabs = new Set<string>();

// ─── Type guard ───────────────────────────────────────────────────────────────

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

// ─── Exported node/edge types ─────────────────────────────────────────────────

export type VFSCanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: AnyNodeViewModel;
  domainId?: string;
};

export interface VFSCanvasEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** P4 — free continuous border anchors (nx, ny ∈ [0,1]). */
  sourceAnchor?: { nx: number; ny: number };
  targetAnchor?: { nx: number; ny: number };
  /** Manual user waypoints. */
  waypoints?: { x: number; y: number }[];
  /** Line routing style. Undefined = 'straight'. */
  routingMode?: EdgeRoutingMode;
  /** Per-edge style overrides: color / line width / line style / font. */
  color?: string;
  lineWidth?: number;
  lineStyle?: NodeBorderStyle;
  fontFamily?: string;
  fontSize?: number;
  style?: CSSProperties;
  data: {
    domainId: string;
    kind: RelationKind;
    isHovered: boolean;
    label?: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    sourceRole?: string;
    targetRole?: string;
    anchorLocked?: boolean;
    condition?: string;
    extensionPoint?: string;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface VFSCanvasResult {
  isVFSFile: boolean;
  isStandalone: boolean;
  localModel: SemanticModel | null;
  nodes: VFSCanvasNode[];
  edges: VFSCanvasEdge[];
  diagramView: DiagramView | null;
  vfsFile: VFSFile | null;
  activeTabId: string | null;
  onConnect: (connection: KonvaConnection) => void;
  onKonvaNodesChange: (changes: KonvaNodeChange[]) => void;
  onKonvaEdgesChange: (changes: KonvaEdgeChange[]) => void;
  removeNodeFromDiagram: (viewNodeId: string) => void;
  deleteElementFromModel: (viewNodeId: string) => void;
  duplicateNode: (viewNodeId: string) => void;
  applyNodeStyle: (viewNodeIds: string[], style: NodeStylePatch) => void;
  deleteEdgeById: (viewEdgeId: string) => void;
  reverseEdgeById: (viewEdgeId: string) => void;
  changeEdgeKind: (viewEdgeId: string, kind: RelationKind) => void;
  updateVFSEdgeProps: (
    viewEdgeId: string,
    props: {
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
      sourceRole?: string;
      targetRole?: string;
      anchorLocked?: boolean;
      sourceHandle?: string;
      targetHandle?: string;
      sourceAnchor?: { nx: number; ny: number };
      targetAnchor?: { nx: number; ny: number };
    },
  ) => void;
  relinkEdgeEndpoint: (
    viewEdgeId: string,
    end: 'source' | 'target',
    newNodeViewId: string,
  ) => boolean;
  updateEdgeWaypoints: (viewEdgeId: string, waypoints: { x: number; y: number }[]) => void;
  updateEdgeRoutingMode: (viewEdgeId: string, routingMode: EdgeRoutingMode) => void;
  updateEdgeStyle: (viewEdgeId: string, style: EdgeStylePatch) => void;
}

// ─── Default project bootstrap ────────────────────────────────────────────────

function ensureDefaultVFSProject(): void {
  const vfs = useVFSStore.getState();
  if (vfs.project) return;

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

// ─── Router ───────────────────────────────────────────────────────────────────

type NodeBuilder = (ctx: NodeBuilderContext) => VFSCanvasNode[];

// Extend this record when adding a new diagram type — the switch is gone.
const NODE_BUILDERS: Partial<Record<string, NodeBuilder>> = {
  CLASS_DIAGRAM:     (ctx) => buildClassDiagramNodes(ctx) as VFSCanvasNode[],
  PACKAGE_DIAGRAM:   (ctx) => buildClassDiagramNodes(ctx) as VFSCanvasNode[],
  OBJECT_DIAGRAM:    (ctx) => buildClassDiagramNodes(ctx) as VFSCanvasNode[],
  USE_CASE_DIAGRAM:  (ctx) => buildUseCaseDiagramNodes(ctx) as VFSCanvasNode[],
  DOMAIN_MODEL_DIAGRAM: (ctx) => buildDomainModelNodes(ctx) as VFSCanvasNode[],
  SEQUENCE_DIAGRAM:  (ctx) => buildSequenceDiagramNodes(ctx) as VFSCanvasNode[],
};

function routeNodes(vfsFile: VFSFile, ctx: NodeBuilderContext): VFSCanvasNode[] {
  return (NODE_BUILDERS[vfsFile.diagramType] ?? NODE_BUILDERS.CLASS_DIAGRAM!)(ctx);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVFSCanvasController(): VFSCanvasResult {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const globalModel = useModelStore((s) => s.model);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  useEffect(() => {
    if (!project) ensureDefaultVFSProject();
  }, [project]);

  const vfsFile = useMemo((): VFSFile | null => {
    if (!activeTabId || !project) return null;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return node as VFSFile;
  }, [activeTabId, project]);

  const isStandalone = vfsFile?.standalone === true;

  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  const model = isStandalone ? localModel : globalModel;

  const diagramView = useMemo((): DiagramView | null => {
    if (!vfsFile) return null;
    return isDiagramView(vfsFile.content) ? vfsFile.content : null;
  }, [vfsFile]);

  useEffect(() => {
    if (!activeTabId || !isStandalone) return;
    ensureLocalModel(activeTabId);
  }, [activeTabId, isStandalone]);

  useEffect(() => {
    if (!diagramView || !model || !activeTabId) return;
    const orphanIds: string[] = [];
    for (const vn of diagramView.nodes) {
      if (!vn.elementId) continue;
      if (resolveSemanticElement(model, vn.elementId).kind === 'UNKNOWN') {
        orphanIds.push(vn.elementId);
      }
    }
    if (orphanIds.length === 0) return;
    if (warnedOrphanTabs.has(activeTabId)) return;
    warnedOrphanTabs.add(activeTabId);
    console.warn(
      `[LibreUML] Diagram "${vfsFile?.name ?? activeTabId}" references ` +
        `${orphanIds.length} element(s) not present in the semantic model. ` +
        `These nodes will render as Notes. Orphan elementIds:`,
      orphanIds,
    );
  }, [diagramView, model, activeTabId, vfsFile]);

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

  // ── Route nodes by diagram type ───────────────────────────────────────────

  const nodes = useMemo((): VFSCanvasNode[] => {
    if (!diagramView || !model || !vfsFile) return [];
    const ctx: NodeBuilderContext = {
      diagramView,
      model,
      isStandalone,
      activeTabId,
      handleNoteUpdate,
    };
    return routeNodes(vfsFile, ctx);
  }, [diagramView, model, vfsFile, isStandalone, activeTabId, handleNoteUpdate]);

  // ── Edges (generic — all diagram types share the relations model) ─────────

  const edges = useMemo((): VFSCanvasEdge[] => {
    if (!diagramView || !model) return [];

    const elementIdToNodeId = new Map<string, string>();
    for (const vn of diagramView.nodes) {
      if (vn.elementId) {
        elementIdToNodeId.set(vn.elementId, vn.id);
      } else {
        elementIdToNodeId.set(vn.id, vn.id);
      }
    }

    const result: VFSCanvasEdge[] = [];
    for (const viewEdge of diagramView.edges) {
      const relation = model.relations[viewEdge.relationId];
      if (!relation) continue;

      const sourceNodeId = elementIdToNodeId.get(relation.sourceId);
      const targetNodeId = elementIdToNodeId.get(relation.targetId);
      if (!sourceNodeId || !targetNodeId) continue;

      result.push({
        id: viewEdge.id,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'vfsUmlEdge',
        sourceHandle: viewEdge.anchorLocked ? viewEdge.sourceHandle : undefined,
        targetHandle: viewEdge.anchorLocked ? viewEdge.targetHandle : undefined,
        sourceAnchor: viewEdge.sourceAnchor,
        targetAnchor: viewEdge.targetAnchor,
        waypoints: viewEdge.waypoints,
        routingMode: viewEdge.routingMode,
        color: viewEdge.color,
        lineWidth: viewEdge.lineWidth,
        lineStyle: viewEdge.lineStyle,
        fontFamily: viewEdge.fontFamily,
        fontSize: viewEdge.fontSize,
        data: {
          domainId: relation.id,
          kind: relation.kind,
          isHovered: false,
          label: relation.name || undefined,
          sourceMultiplicity: relation.sourceEnd?.multiplicity ?? viewEdge.sourceMultiplicity,
          targetMultiplicity: relation.targetEnd?.multiplicity ?? viewEdge.targetMultiplicity,
          sourceRole: viewEdge.sourceRole,
          targetRole: viewEdge.targetRole,
          anchorLocked: viewEdge.anchorLocked,
          condition: relation.condition,
          extensionPoint: relation.extensionPoint,
        },
      });
    }
    return result;
  }, [diagramView, model]);

  // ── Delegate to extracted hooks ───────────────────────────────────────────

  const eventHandlers = useCanvasEventHandlers({ activeTabId, isStandalone });
  const nodeActions = useNodeActions({ activeTabId, isStandalone, updateFileContent });
  const edgeActions = useEdgeActions({ activeTabId, isStandalone, updateFileContent });

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
    applyNodeStyle: nodeActions.applyNodeStyle,
    deleteEdgeById: edgeActions.deleteEdgeById,
    reverseEdgeById: edgeActions.reverseEdgeById,
    changeEdgeKind: edgeActions.changeEdgeKind,
    updateVFSEdgeProps: edgeActions.updateVFSEdgeProps,
    relinkEdgeEndpoint: edgeActions.relinkEdgeEndpoint,
    updateEdgeWaypoints: edgeActions.updateEdgeWaypoints,
    updateEdgeRoutingMode: edgeActions.updateEdgeRoutingMode,
    updateEdgeStyle: edgeActions.updateEdgeStyle,
  };
}
