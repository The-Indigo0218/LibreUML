/**
 * E2EHarness — deterministic, auth-free entry point for Playwright drag tests.
 *
 * Konva renders the whole diagram into a single <canvas>, so individual nodes
 * are NOT DOM elements — Playwright cannot select or drag them via the DOM.
 * This harness solves that by:
 *   1. Seeding a known diagram straight into the stores (no UI clicks, no auth).
 *   2. Exposing `window.__libreumlE2E` so a test can read the live DiagramView
 *      back and translate a node id into on-screen pixel coordinates (via the
 *      Konva stage), which it then drags with page.mouse.
 *
 * Only mounted on the `/__e2e` route, which is registered exclusively when the
 * `VITE_E2E` build flag is set — it never ships in a normal build.
 */
import { useEffect } from 'react';
import Konva from 'konva';
import DiagramEditor from '../features/diagram/components/layout/DiagramEditor';
import { useVFSStore } from '../store/project-vfs.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useAuthStore } from '../features/auth/store/auth.store';
import { useSettingsStore } from '../store/settingsStore';
import type {
  LibreUMLProject,
  SemanticModel,
  DiagramView,
  ViewNode,
} from '../core/domain/vfs/vfs.types';

const FILE_ID = 'e2e-file';

export interface E2ENodeSpec {
  id: string;
  elementId: string;
  name: string;
  x: number;
  y: number;
}

export interface E2EEdgeSpec {
  id: string;
  relationId: string;
  /** Element ids (not view-node ids) of the endpoints. */
  source: string;
  target: string;
  kind?: string;
  routingMode?: 'straight' | 'orthogonal' | 'curved';
}

/** Minimal sequence-diagram seed (verification harness). Lifelines become
 *  ViewNodes; messages/activations/fragments are derived (no ViewNode). */
export interface E2ESequenceSpec {
  diagramType: 'SEQUENCE_DIAGRAM';
  lifelines: { id: string; vnId: string; name: string; x: number; y: number }[];
  messages?: {
    id: string; name?: string; messageKind: string;
    sourceLifelineId: string; targetLifelineId: string; sequenceNumber: number;
  }[];
  activations?: { id: string; lifelineId: string; startMessageId: string; endMessageId?: string }[];
  fragments?: {
    id: string; fragmentKind: string; coveredLifelineIds: string[];
    messageIds?: string[]; messageSet?: string[];
  }[];
}

export interface E2EDiagramSpec {
  nodes: E2ENodeSpec[];
  edges?: E2EEdgeSpec[];
}

const DEFAULT_SPEC: E2EDiagramSpec = {
  nodes: [
    { id: 'vn-a', elementId: 'cls-a', name: 'Alpha', x: 120, y: 120 },
    { id: 'vn-b', elementId: 'cls-b', name: 'Beta', x: 480, y: 360 },
  ],
};

function emptyModel(): SemanticModel {
  const now = Date.now();
  return {
    id: 'e2e-model', name: 'E2E', version: '1.0.0',
    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
    createdAt: now, updatedAt: now,
  } as SemanticModel;
}

function buildProject(spec: E2EDiagramSpec): LibreUMLProject {
  const now = Date.now();
  const model = emptyModel();
  for (const n of spec.nodes) {
    (model.classes as Record<string, unknown>)[n.elementId] = {
      id: n.elementId, name: n.name, kind: 'CLASS',
      isAbstract: false, attributeIds: [], operationIds: [],
    };
  }
  for (const e of spec.edges ?? []) {
    (model.relations as Record<string, unknown>)[e.relationId] = {
      id: e.relationId, kind: e.kind ?? 'ASSOCIATION', sourceId: e.source, targetId: e.target,
    };
  }
  const viewNodes: ViewNode[] = spec.nodes.map((n) => ({ id: n.id, elementId: n.elementId, x: n.x, y: n.y }));
  const viewEdges = (spec.edges ?? []).map((e) => ({
    id: e.id, relationId: e.relationId, waypoints: [], routingMode: e.routingMode,
  }));
  const content: DiagramView = { diagramId: FILE_ID, nodes: viewNodes, edges: viewEdges as DiagramView['edges'] };

  return {
    id: 'e2e-project', projectName: 'E2E', version: '1.0.0', domainModelId: 'e2e-dm',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'E2E.luml', type: 'FILE', parentId: null,
        diagramType: 'CLASS_DIAGRAM', extension: '.luml', isExternal: false,
        standalone: true, content, localModel: model,
        createdAt: now, updatedAt: now,
      },
    },
    createdAt: now, updatedAt: now,
  } as unknown as LibreUMLProject;
}

/** Builds a SEQUENCE_DIAGRAM project from a sequence seed spec. */
function buildSequenceProject(spec: E2ESequenceSpec): LibreUMLProject {
  const now = Date.now();
  const model = emptyModel() as unknown as Record<string, unknown>;
  model.lifelines = {};
  model.messages = {};
  model.activations = {};
  model.interactionFragments = {};
  for (const ll of spec.lifelines) {
    (model.lifelines as Record<string, unknown>)[ll.id] = {
      id: ll.id, kind: 'LIFELINE', name: ll.name, participantKind: 'ANONYMOUS', alias: ll.name,
    };
  }
  for (const m of spec.messages ?? []) {
    (model.messages as Record<string, unknown>)[m.id] = {
      id: m.id, kind: 'MESSAGE', name: m.name ?? '', messageKind: m.messageKind,
      sourceLifelineId: m.sourceLifelineId, targetLifelineId: m.targetLifelineId,
      sequenceNumber: m.sequenceNumber,
    };
  }
  for (const a of spec.activations ?? []) {
    (model.activations as Record<string, unknown>)[a.id] = {
      id: a.id, kind: 'ACTIVATION', name: '', lifelineId: a.lifelineId,
      startMessageId: a.startMessageId, endMessageId: a.endMessageId,
    };
  }
  for (const f of spec.fragments ?? []) {
    (model.interactionFragments as Record<string, unknown>)[f.id] = {
      id: f.id, kind: 'FRAGMENT', name: f.id, fragmentKind: f.fragmentKind,
      coveredLifelineIds: f.coveredLifelineIds,
      operands: [{ id: `${f.id}-op1`, messageIds: f.messageIds ?? [], fragmentIds: [] }],
      messageSet: f.messageSet,
    };
  }
  const viewNodes: ViewNode[] = spec.lifelines.map((ll) => ({ id: ll.vnId, elementId: ll.id, x: ll.x, y: ll.y }));
  const content: DiagramView = { diagramId: FILE_ID, nodes: viewNodes, edges: [] };

  return {
    id: 'e2e-project', projectName: 'E2E', version: '1.0.0', domainModelId: 'e2e-dm',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID, name: 'E2E.luml', type: 'FILE', parentId: null,
        diagramType: 'SEQUENCE_DIAGRAM', extension: '.luml', isExternal: false,
        standalone: true, content, localModel: model,
        createdAt: now, updatedAt: now,
      },
    },
    createdAt: now, updatedAt: now,
  } as unknown as LibreUMLProject;
}

export interface E2ENodeRect { x: number; y: number; width: number; height: number; }

export interface E2EApi {
  seed: (spec?: E2EDiagramSpec) => void;
  /** Seed a sequence diagram (verification harness). */
  seedSequence: (spec: E2ESequenceSpec) => void;
  /** Read a collection of the active file's localModel back (lifelines/messages/…). */
  modelDump: (collection: string) => Record<string, unknown> | null;
  /** All Konva Text strings currently painted on the stage (render assertions). */
  stageTexts: () => string[];
  getView: () => DiagramView | null;
  /** Page-space bounding rect of a rendered shape (group id = view node id). */
  nodeRect: (id: string) => E2ENodeRect | null;
  /** Page-space midpoint of a rendered edge line (id = view edge id). */
  edgeMidpoint: (edgeId: string) => { x: number; y: number } | null;
  /** Page-space coords of an edge line's source (first) or target (last) point. */
  edgeEndpoint: (edgeId: string, end: 'source' | 'target') => { x: number; y: number } | null;
  /**
   * Viewport culling on/off, plus silencing the warning modal that would
   * otherwise cover the canvas past 20 shapes. A0-bis (ADR-0014) measures the
   * canvas with culling both ways, so the budget can say what it buys.
   */
  setCulling: (on: boolean) => void;
  /** How many shape groups the stage is actually painting right now. */
  renderedShapeCount: () => number;
}

declare global {
  interface Window { __libreumlE2E?: E2EApi }
}

export default function E2EHarness() {
  useEffect(() => {
    const seed = (spec: E2EDiagramSpec = DEFAULT_SPEC) => {
      useVFSStore.getState().loadProject(buildProject(spec));
      useWorkspaceStore.getState().openTab(FILE_ID);
    };

    const seedSequence = (spec: E2ESequenceSpec) => {
      useVFSStore.getState().loadProject(buildSequenceProject(spec));
      useWorkspaceStore.getState().openTab(FILE_ID);
    };

    const api: E2EApi = {
      seed,
      seedSequence,
      modelDump: (collection) => {
        const node = useVFSStore.getState().project?.nodes[FILE_ID];
        const lm = node && node.type === 'FILE' ? (node as { localModel?: Record<string, unknown> }).localModel : null;
        return (lm?.[collection] as Record<string, unknown>) ?? null;
      },
      stageTexts: () => {
        const stage = Konva.stages[Konva.stages.length - 1];
        if (!stage) return [];
        return stage.find('Text').map((t) => (t as unknown as { text: () => string }).text());
      },
      getView: () => {
        const node = useVFSStore.getState().project?.nodes[FILE_ID];
        return node && node.type === 'FILE' ? ((node as { content?: DiagramView }).content ?? null) : null;
      },
      nodeRect: (id) => {
        const stage = Konva.stages[Konva.stages.length - 1];
        const shape = stage?.findOne(`#${id}`);
        if (!stage || !shape) return null;
        const box = shape.getClientRect();
        const c = stage.container().getBoundingClientRect();
        return { x: c.left + box.x, y: c.top + box.y, width: box.width, height: box.height };
      },
      edgeMidpoint: (edgeId) => {
        const stage = Konva.stages[Konva.stages.length - 1];
        const line = stage?.findOne(`#edge-line-${edgeId}`);
        if (!stage || !line) return null;
        const pts = (line as unknown as { points: () => number[] }).points();
        if (!pts || pts.length < 4) return null;
        const mid = { x: (pts[0] + pts[pts.length - 2]) / 2, y: (pts[1] + pts[pts.length - 1]) / 2 };
        const screen = stage.getAbsoluteTransform().point(mid);
        const c = stage.container().getBoundingClientRect();
        return { x: c.left + screen.x, y: c.top + screen.y };
      },
      edgeEndpoint: (edgeId, end) => {
        const stage = Konva.stages[Konva.stages.length - 1];
        const line = stage?.findOne(`#edge-line-${edgeId}`);
        if (!stage || !line) return null;
        const pts = (line as unknown as { points: () => number[] }).points();
        if (!pts || pts.length < 4) return null;
        const pt = end === 'source'
          ? { x: pts[0], y: pts[1] }
          : { x: pts[pts.length - 2], y: pts[pts.length - 1] };
        const screen = stage.getAbsoluteTransform().point(pt);
        const c = stage.container().getBoundingClientRect();
        return { x: c.left + screen.x, y: c.top + screen.y };
      },
      setCulling: (on) => {
        useSettingsStore.setState({ viewportCulling: on, suppressCullingWarning: true });
      },
      renderedShapeCount: () => {
        const stage = Konva.stages[Konva.stages.length - 1];
        if (!stage) return 0;
        // Culling hides shapes rather than unmounting them, so count the ones
        // actually being painted.
        return stage.find('Group').filter((g) => g.isVisible()).length;
      },
    };

    // Public route → no auth gate; local mode keeps any auth-aware chrome happy.
    useAuthStore.setState({ isLocalMode: true, isLoading: false });
    window.__libreumlE2E = api;
    seed();
    return () => { delete window.__libreumlE2E; };
  }, []);

  return (
    <div data-testid="e2e-harness" className="w-screen h-screen">
      <DiagramEditor />
    </div>
  );
}
