import { useCallback, useMemo } from "react";
import { useReactFlow, type Node } from "reactflow";
import { useDiagram } from "../../workspace/hooks/useDiagram";
import { checkCollision } from "../../../util/geometry";
import { NODE_WIDTH, NODE_HEIGHT } from "../../../config/theme.config";
import type { stereotype } from "../types/diagram.types";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/vfs.store";
import { useModelStore } from "../../../store/model.store";
import { isDiagramView } from "./useVFSCanvasController";
import type { DiagramView, ViewNode, VFSFile, SemanticModel } from "../../../core/domain/vfs/vfs.types";

// ─── Drag type constants ──────────────────────────────────────────────────────

/** Payload set by the tool palette — creates a NEW semantic element on drop. */
export const DRAG_TYPE_NEW = "application/reactflow" as const;

/**
 * Payload set by the Model Explorer SSOT sidebar — the semantic element already
 * exists. The drop handler must ONLY create a ViewNode; it must NOT touch ModelStore.
 */
export const DRAG_TYPE_EXISTING = "application/reactflow-existing-node" as const;

// ─── VFS name helper ──────────────────────────────────────────────────────────

/**
 * Scans an array of IR element names and returns the next available "Prefix N" name.
 * Mirrors the logic of getNextDefaultName but works with plain string arrays
 * so it can operate on SemanticModel collections without depending on DomainNode types.
 */
export function getNextVFSName(existingNames: string[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
  let max = 0;
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix} ${max + 1}`;
}

// ─── Legacy node type mapping ─────────────────────────────────────────────────

const stereotypeToNodeType: Record<stereotype, string> = {
  class: 'CLASS',
  interface: 'INTERFACE',
  abstract: 'ABSTRACT_CLASS',
  enum: 'ENUM',
  note: 'NOTE',
};

// ─── VFS semantic drop configuration ─────────────────────────────────────────

/**
 * Configuration for each stereotype when dropped onto a VFS .luml canvas.
 * - `getNextName(model)` : Generates an auto-incremented name by scanning the
 *                          relevant SemanticModel collection (e.g. "Class 3").
 * - `create(name)`       : Calls the appropriate ModelStore factory and returns
 *                          the new semantic element's stable ID.
 */
const VFS_DROP_CONFIG: Partial<
  Record<stereotype, { getNextName: (model: SemanticModel) => string; create: (name: string) => string }>
> = {
  class: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.classes).filter((c) => !c.isAbstract).map((c) => c.name),
        'Class',
      ),
    create: (name) =>
      useModelStore.getState().createClass({ name, attributeIds: [], operationIds: [] }),
  },
  interface: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.interfaces).map((i) => i.name), 'Interface'),
    create: (name) =>
      useModelStore.getState().createInterface({ name, operationIds: [] }),
  },
  abstract: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.classes).filter((c) => !!c.isAbstract).map((c) => c.name),
        'Abstract',
      ),
    create: (name) =>
      useModelStore.getState().createAbstractClass({ name, attributeIds: [], operationIds: [] }),
  },
  enum: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.enums).map((e) => e.name), 'Enum'),
    create: (name) =>
      useModelStore.getState().createEnum({ name, literals: [] }),
  },
  // Notes are visual-only — no IR element, no auto-increment needed.
  note: {
    getNextName: () => 'Note',
    create: () => '',
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useDiagramDnD = () => {
  const { screenToFlowPosition } = useReactFlow();
  const { addNodeToDiagram, nodes: legacyNodes } = useDiagram();

  // VFS state ─────────────────────────────────────────────────────────────────
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  /**
   * Resolve the active VFS file and its DiagramView.
   * Null when the active tab is not a VFS .luml file.
   */
  const vfsContext = useMemo((): { file: VFSFile; view: DiagramView } | null => {
    if (!activeTabId || !project) return null;
    const node = project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    const content = (node as VFSFile).content;
    if (!isDiagramView(content)) return null;
    return { file: node as VFSFile, view: content };
  }, [activeTabId, project]);

  const isVFSFile = !!vfsContext;

  // ─── Position helpers ─────────────────────────────────────────────────────

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const rawPos = screenToFlowPosition({ x: clientX, y: clientY });
      return {
        x: rawPos.x - NODE_WIDTH / 2,
        y: rawPos.y - NODE_HEIGHT / 2,
      };
    },
    [screenToFlowPosition],
  );

  // ─── onDragOver ───────────────────────────────────────────────────────────

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      // VFS files allow drops anywhere (no collision detection needed yet).
      if (isVFSFile) return;

      const position = getCenteredPosition(event.clientX, event.clientY);
      const isColliding = checkCollision(position, legacyNodes as Node[]);
      if (isColliding) {
        event.dataTransfer.dropEffect = "none";
      }
    },
    [getCenteredPosition, legacyNodes, isVFSFile],
  );

  // ─── onDrop ───────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const position = getCenteredPosition(event.clientX, event.clientY);

      // ===================================================================
      // EXISTING ELEMENT DROP (Model Explorer SSOT sidebar)
      // The semantic element already lives in ModelStore. Only create a
      // ViewNode — do NOT touch ModelStore.
      // ===================================================================
      const existingElementId = event.dataTransfer.getData(DRAG_TYPE_EXISTING);
      if (existingElementId) {
        if (!activeTabId) return;

        const freshProject = useVFSStore.getState().project;
        if (!freshProject) return;
        const freshFileNode = freshProject.nodes[activeTabId];
        if (!freshFileNode || freshFileNode.type !== 'FILE') return;
        const freshContent = (freshFileNode as VFSFile).content;
        if (!isDiagramView(freshContent)) return;
        const freshView = freshContent as DiagramView;

        const viewNode: ViewNode = {
          id: crypto.randomUUID(),
          elementId: existingElementId,
          x: position.x,
          y: position.y,
        };

        updateFileContent(activeTabId, {
          ...freshView,
          nodes: [...freshView.nodes, viewNode],
        });
        return;
      }

      const stereotype = event.dataTransfer.getData(DRAG_TYPE_NEW) as stereotype;

      if (!stereotype) return;

      // ===================================================================
      // VFS SEMANTIC DROP
      // Active when the current tab is a .luml VFS file with a DiagramView.
      // ===================================================================
      if (isVFSFile && activeTabId) {
        const dropConfig = VFS_DROP_CONFIG[stereotype];

        if (!dropConfig) {
          console.warn(`[VFS Drop] Stereotype "${stereotype}" has no VFS semantic mapping. Drop ignored.`);
          return;
        }

        // Fresh read on every drop — avoids stale-closure overwrite on rapid drops.
        // If vfsContext.view were used here, rapid drops would each read the same
        // snapshot and overwrite each other; getState() always returns the latest.
        const freshProject = useVFSStore.getState().project;
        if (!freshProject) return;
        const freshFileNode = freshProject.nodes[activeTabId];
        if (!freshFileNode || freshFileNode.type !== 'FILE') return;
        const freshContent = (freshFileNode as VFSFile).content;
        if (!isDiagramView(freshContent)) return;
        const freshView = freshContent as DiagramView;

        // a) Ensure SemanticModel is initialized (may be null on first drop).
        const modelState = useModelStore.getState();
        if (!modelState.model) {
          modelState.initModel(freshProject.domainModelId ?? crypto.randomUUID());
        }

        // b) Compute auto-incremented name, then create the semantic IR element.
        const currentModel = useModelStore.getState().model!;
        const elementName = dropConfig.getNextName(currentModel);
        const semanticId = dropConfig.create(elementName);

        // c) Create the visual ViewNode linked to the semantic element.
        const viewNode: ViewNode = {
          id: crypto.randomUUID(),
          elementId: semanticId,
          x: position.x,
          y: position.y,
        };

        // d) Persist the updated DiagramView to VFSStore.
        const updatedView: DiagramView = {
          ...freshView,
          nodes: [...freshView.nodes, viewNode],
        };
        updateFileContent(activeTabId, updatedView);
        return;
      }

      // ===================================================================
      // LEGACY DROP (non-VFS files — ProjectStore + WorkspaceStore pipeline)
      // ===================================================================
      if (checkCollision(position, legacyNodes as Node[])) {
        return;
      }

      const nodeType = stereotypeToNodeType[stereotype];
      if (!nodeType) {
        console.warn(`Unknown stereotype: ${stereotype}`);
        return;
      }

      addNodeToDiagram(nodeType, position);
    },
    [
      addNodeToDiagram,
      getCenteredPosition,
      legacyNodes,
      isVFSFile,
      activeTabId,
      updateFileContent,
    ],
  );

  return { onDragOver, onDrop };
};
