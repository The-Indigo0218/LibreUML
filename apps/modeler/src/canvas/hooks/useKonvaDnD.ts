import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type Konva from 'konva';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toast.store';
import { getLocalModel } from '../../store/standaloneModelOps';
import {
  getOrCreateActivityId,
  applyCreateActivityNode,
  applyCreateActivityPartition,
} from '../../store/activityModelOps';
import { DEFAULT_PARTITION_WIDTH } from '../engine/partitionLayout';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { getAbsolutePosition } from '../../features/diagram/hooks/controllers/sharedNodeBuilders';
import { undoTransaction, withUndo } from '../../core/undo/undoBridge';
import type {
  DiagramView, ViewNode, VFSFile, SemanticModel, ActivityNodeKind,
} from '../../core/domain/vfs/vfs.types';
import type { stereotype } from '../../features/diagram/types/diagram.types';
import { SB_DEFAULT_W, SB_DEFAULT_H } from '../shapes/SystemBoundaryShape';
import { UCM_DEFAULT_W, UCM_DEFAULT_H } from '../shapes/UCModuleShape';
import { measureElementSize } from '../engine/elementSize';
import {
  getAllTools,
  getNativeNodeToolIds,
  getDiagramRegistry,
} from '../../core/registry/diagram-registry';

export const DRAG_TYPE_NEW = 'application/libreuml-node' as const;
export const DRAG_TYPE_EXISTING = 'application/libreuml-existing-node' as const;
export const DRAG_TYPE_PACKAGE = 'application/libreuml-package' as const;
export const SIDEBAR_DND_TYPE = 'application/libreuml-sidebar-class' as const;

const NODE_WIDTH = 256;
const NODE_HEIGHT = 120;
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

/**
 * A control-node drop config for the activity kinds that carry no name — a
 * filled circle, a rhombus or a bar has nothing to label (A1/A2 precedent:
 * these kinds render with `editor: 'none'`).
 */
function controlNodeDropConfig(activityType: ActivityNodeKind): DropConfig {
  return {
    getNextName: () => '',
    applyToModelDraft: (m, id, _name, _isExternal, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(m, existingViewNodes, 'Activity');
      applyCreateActivityNode(m, id, { activityType, activityId, name: '' });
    },
    applyToLocalModelDraft: (lm, id, _name, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(lm, existingViewNodes, 'Activity');
      applyCreateActivityNode(lm, id, { activityType, activityId, name: '' });
    },
  };
}

export interface DropConfig {
  getNextName: (model: SemanticModel) => string;
  /**
   * `existingViewNodes` is the dropped-on diagram's current nodes — only
   * Activity needs it, to find the Activity that already owns this diagram
   * instead of guessing (§ getOrCreateActivityId in activityModelOps.ts).
   */
  applyToModelDraft: (
    modelDraft: any, id: string, name: string, isExternal?: boolean,
    existingViewNodes?: readonly { elementId: string }[],
  ) => void;
  applyToLocalModelDraft: (
    lm: any, id: string, name: string,
    existingViewNodes?: readonly { elementId: string }[],
  ) => void;
  isVisualOnly?: boolean;
  /** Initial ViewNode dimensions — used for resizable containers like SystemBoundary. */
  initialDimensions?: { width: number; height: number };
  /** Override the drop position (x, y) — used by lifelines that must snap to y=0. */
  overridePosition?: (pos: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Per-stereotype recipe for creating a node: how to name it and how to write the
 * semantic element into the shared or local model. Shared with the Quick Linker,
 * which creates a node + relation in one transaction reusing these builders.
 */
export const VFS_DROP_CONFIG: Partial<Record<stereotype, DropConfig>> = {
  class: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.classes).filter((c) => !c.isAbstract).map((c) => c.name), 'Class'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.classes[id] = { id, name, kind: 'CLASS', attributeIds: [], operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.classes[id] = { id, name, kind: 'CLASS', attributeIds: [], operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  interface: {
    getNextName: (model) => getNextVFSName(Object.values(model.interfaces).map((i) => i.name), 'Interface'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.interfaces[id] = { id, name, kind: 'INTERFACE', operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.interfaces[id] = { id, name, kind: 'INTERFACE', operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  abstract: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.classes).filter((c) => !!c.isAbstract).map((c) => c.name), 'Abstract'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.classes[id] = { id, name, kind: 'CLASS', isAbstract: true, attributeIds: [], operationIds: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.classes[id] = { id, name, kind: 'CLASS', isAbstract: true, attributeIds: [], operationIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  enum: {
    getNextName: (model) => getNextVFSName(Object.values(model.enums).map((e) => e.name), 'Enum'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.enums[id] = { id, name, kind: 'ENUM', literals: [], ...(isExternal ? { isExternal: true } : {}) };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.enums[id] = { id, name, kind: 'ENUM', literals: [] };
      lm.updatedAt = Date.now();
    },
  },
  note: {
    getNextName: () => 'Note',
    applyToModelDraft: () => {},
    applyToLocalModelDraft: () => {},
    isVisualOnly: true,
  },
  actor: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.actors ?? {}).map((a) => a.name), 'Actor'),
    applyToModelDraft: (m, id, name) => {
      m.actors[id] = { id, name, kind: 'ACTOR' };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.actors = lm.actors ?? {};
      lm.actors[id] = { id, name, kind: 'ACTOR' };
      lm.updatedAt = Date.now();
    },
  },
  use_case: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.useCases ?? {}).map((uc) => uc.name), 'UseCase'),
    applyToModelDraft: (m, id, name) => {
      m.useCases[id] = { id, name, kind: 'USECASE', extensionPoints: [] };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.useCases = lm.useCases ?? {};
      lm.useCases[id] = { id, name, kind: 'USECASE', extensionPoints: [] };
      lm.updatedAt = Date.now();
    },
  },
  system_boundary: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.systemBoundaries ?? {}).map((sb) => sb.name), 'System'),
    applyToModelDraft: (m, id, name) => {
      m.systemBoundaries = m.systemBoundaries ?? {};
      m.systemBoundaries[id] = { id, name, kind: 'SYSTEM_BOUNDARY' };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.systemBoundaries = lm.systemBoundaries ?? {};
      lm.systemBoundaries[id] = { id, name, kind: 'SYSTEM_BOUNDARY' };
      lm.updatedAt = Date.now();
    },
    initialDimensions: { width: SB_DEFAULT_W, height: SB_DEFAULT_H },
  },
  uc_module: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.ucModules ?? {}).map((m) => m.name), 'Module'),
    applyToModelDraft: (m, id, name) => {
      m.ucModules = m.ucModules ?? {};
      m.ucModules[id] = { id, name, kind: 'UC_MODULE' };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.ucModules = lm.ucModules ?? {};
      lm.ucModules[id] = { id, name, kind: 'UC_MODULE' };
      lm.updatedAt = Date.now();
    },
    initialDimensions: { width: UCM_DEFAULT_W, height: UCM_DEFAULT_H },
  },
  domain_entity: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.domainEntities ?? {}).map((e) => e.name), 'Entity'),
    applyToModelDraft: (m, id, name) => {
      m.domainEntities = m.domainEntities ?? {};
      m.domainAttributes = m.domainAttributes ?? {};
      m.domainEntities[id] = { id, name, kind: 'DOMAIN_ENTITY', attributeIds: [] };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.domainEntities = lm.domainEntities ?? {};
      lm.domainAttributes = lm.domainAttributes ?? {};
      lm.domainEntities[id] = { id, name, kind: 'DOMAIN_ENTITY', attributeIds: [] };
      lm.updatedAt = Date.now();
    },
  },
  lifeline: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.lifelines ?? {}).map((l) => l.alias ?? l.name), 'Lifeline'),
    applyToModelDraft: (m, id, name) => {
      m.lifelines = m.lifelines ?? {};
      m.lifelines[id] = { id, name, kind: 'LIFELINE', participantKind: 'ANONYMOUS', alias: name };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.lifelines = lm.lifelines ?? {};
      lm.lifelines[id] = { id, name, kind: 'LIFELINE', participantKind: 'ANONYMOUS', alias: name };
      lm.updatedAt = Date.now();
    },
    // Sequence diagram constraint: lifelines always sit at y=0 (head at the top).
    overridePosition: (pos) => ({ x: pos.x, y: 0 }),
  },
  actor_lifeline: {
    getNextName: (model) =>
      getNextVFSName(Object.values(model.lifelines ?? {}).map((l) => l.alias ?? l.name), 'Actor'),
    applyToModelDraft: (m, id, name) => {
      m.lifelines = m.lifelines ?? {};
      m.lifelines[id] = { id, name, kind: 'LIFELINE', participantKind: 'ACTOR', alias: name };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.lifelines = lm.lifelines ?? {};
      lm.lifelines[id] = { id, name, kind: 'LIFELINE', participantKind: 'ACTOR', alias: name };
      lm.updatedAt = Date.now();
    },
    overridePosition: (pos) => ({ x: pos.x, y: 0 }),
  },
  package: {
    getNextName: (model) => getNextVFSName(Object.values(model.packages).map((p) => p.name), 'Package'),
    applyToModelDraft: (m, id, name, isExternal) => {
      m.packages[id] = {
        id,
        name,
        kind: 'PACKAGE',
        packageIds: [],
        classIds: [],
        interfaceIds: [],
        enumIds: [],
        dataTypeIds: [],
        ...(isExternal ? { isExternal: true } : {}),
      };
      m.updatedAt = Date.now();
    },
    applyToLocalModelDraft: (lm, id, name) => {
      lm.packages[id] = {
        id,
        name,
        kind: 'PACKAGE',
        packageIds: [],
        classIds: [],
        interfaceIds: [],
        enumIds: [],
        dataTypeIds: [],
      };
      lm.updatedAt = Date.now();
    },
  },
  // ── Activity Diagram (A2.5) ─────────────────────────────────────────────
  // Registered in activityDiagramRegistry.tools.nodes since A1, but never
  // wired into VFS_DROP_CONFIG — dropping any of these tools silently did
  // nothing (`console.warn('has no VFS semantic mapping')`) until now.
  action: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.activityNodes ?? {})
          .filter((n) => n.activityType === 'ACTION')
          .map((n) => n.name),
        'Action',
      ),
    applyToModelDraft: (m, id, name, _isExternal, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(m, existingViewNodes, 'Activity');
      applyCreateActivityNode(m, id, { activityType: 'ACTION', activityId, name });
    },
    applyToLocalModelDraft: (lm, id, name, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(lm, existingViewNodes, 'Activity');
      applyCreateActivityNode(lm, id, { activityType: 'ACTION', activityId, name });
    },
  },
  call_operation: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.activityNodes ?? {})
          .filter((n) => n.activityType === 'CALL_OPERATION')
          .map((n) => n.name),
        'Call Operation',
      ),
    applyToModelDraft: (m, id, name, _isExternal, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(m, existingViewNodes, 'Activity');
      applyCreateActivityNode(m, id, { activityType: 'CALL_OPERATION', activityId, name });
    },
    applyToLocalModelDraft: (lm, id, name, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(lm, existingViewNodes, 'Activity');
      applyCreateActivityNode(lm, id, { activityType: 'CALL_OPERATION', activityId, name });
    },
  },
  initial_node: controlNodeDropConfig('INITIAL'),
  activity_final: controlNodeDropConfig('ACTIVITY_FINAL'),
  flow_final: controlNodeDropConfig('FLOW_FINAL'),
  decision: controlNodeDropConfig('DECISION'),
  merge: controlNodeDropConfig('MERGE'),
  fork: controlNodeDropConfig('FORK'),
  join: controlNodeDropConfig('JOIN'),
  // ── Activity Diagram (A6/v1.1) ───────────────────────────────────────────
  object_node: {
    getNextName: (model) =>
      getNextVFSName(
        Object.values(model.activityNodes ?? {})
          .filter((n) => n.activityType === 'OBJECT_NODE')
          .map((n) => n.name),
        'Object',
      ),
    applyToModelDraft: (m, id, name, _isExternal, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(m, existingViewNodes, 'Activity');
      applyCreateActivityNode(m, id, { activityType: 'OBJECT_NODE', activityId, name });
    },
    applyToLocalModelDraft: (lm, id, name, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(lm, existingViewNodes, 'Activity');
      applyCreateActivityNode(lm, id, { activityType: 'OBJECT_NODE', activityId, name });
    },
  },
  // ── Activity Diagram (A3) ────────────────────────────────────────────────
  activity_partition: {
    getNextName: (model: SemanticModel) =>
      getNextVFSName(
        Object.values(model.activityPartitions ?? {}).map((p) => p.name),
        'Lane',
      ),
    applyToModelDraft: (m: SemanticModel, id, name, _isExternal, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(m, existingViewNodes, 'Activity');
      const index = Object.values(m.activityPartitions ?? {}).filter(
        (p) => p.activityId === activityId,
      ).length;
      applyCreateActivityPartition(m, id, { activityId, name, index });
    },
    applyToLocalModelDraft: (lm: SemanticModel, id, name, existingViewNodes = []) => {
      const activityId = getOrCreateActivityId(lm, existingViewNodes, 'Activity');
      const index = Object.values(lm.activityPartitions ?? {}).filter(
        (p) => p.activityId === activityId,
      ).length;
      applyCreateActivityPartition(lm, id, { activityId, name, index });
    },
    // Height is never read for a lane (shared/derived, see partitionLayout.ts)
    // — only `width` matters here, but the shape requires both.
    initialDimensions: { width: DEFAULT_PARTITION_WIDTH, height: 200 },
  },
};

function getParentContent(
  parentPath: string,
  draggingPath: string,
  model: SemanticModel | null,
): { classCount: number; subPackageCount: number; siblingCount: number } {
  if (!model) return { classCount: 0, subPackageCount: 0, siblingCount: 0 };

  const classCount = [
    ...Object.values(model.classes),
    ...Object.values(model.interfaces),
    ...Object.values(model.enums),
  ].filter((el: any) => el.packageName === parentPath).length;

  const allPkgPaths = new Set([
    ...Object.values(model.packages).map((p) => p.name),
    ...(model.packageNames ?? []),
  ]);
  const directSubs = [...allPkgPaths].filter((n) => {
    if (!n.startsWith(parentPath + '.')) return false;
    return !n.slice(parentPath.length + 1).includes('.');
  });

  return {
    classCount,
    subPackageCount: directSubs.length,
    siblingCount: directSubs.filter((n) => n !== draggingPath).length,
  };
}

export interface UseKonvaDnDParams {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export interface UseKonvaDnDResult {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  duplicateModal: {
    isOpen: boolean;
    fileName: string;
    onReplace: () => void;
    onCancel: () => void;
    onDontShowAgain: (checked: boolean) => void;
  };
  hierarchyModal: {
    isOpen: boolean;
    packageFullPath: string;
    parentPath: string;
    classCount: number;
    subPackageCount: number;
    onPlaceSimple: () => void;
    onPlaceHierarchy: () => void;
    onCancel: () => void;
  };
  crossDiagramModal: {
    isOpen: boolean;
    toolLabel: string;
    diagramLabel: string;
    onAddAnyway: () => void;
    onCancel: () => void;
  };
  packageRestoreModal: {
    isOpen: boolean;
    elementName: string;
    packagePath: string;
    onNest: () => void;
    onFree: () => void;
    onCancel: () => void;
  };
}

export function useKonvaDnD({ stageRef }: UseKonvaDnDParams): UseKonvaDnDResult {
  const { t } = useTranslation();
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);
  const hideDuplicateFileWarning = useSettingsStore((s) => s.hideDuplicateFileWarning);
  const setHideDuplicateFileWarning = useSettingsStore((s) => s.setHideDuplicateFileWarning);
  const showToast = useToastStore((s) => s.show);

  const [duplicateModal, setDuplicateModal] = useState({
    isOpen: false,
    fileName: '',
    elementId: '',
    position: { x: 0, y: 0 },
  });

  const [hierarchyModal, setHierarchyModal] = useState<{
    isOpen: boolean;
    packageFullPath: string;
    parentPath: string;
    classCount: number;
    subPackageCount: number;
    position: { x: number; y: number };
    isStandaloneFile: boolean;
  }>({
    isOpen: false,
    packageFullPath: '',
    parentPath: '',
    classCount: 0,
    subPackageCount: 0,
    position: { x: 0, y: 0 },
    isStandaloneFile: false,
  });

  // Guard shown when a node tool that the active diagram type does not own is
  // dropped onto the canvas (see #1 "all-tools palette" — best-effort free mode).
  const [crossDiagramModal, setCrossDiagramModal] = useState<{
    isOpen: boolean;
    stereotype: stereotype | '';
    toolLabel: string;
    diagramLabel: string;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    stereotype: '',
    toolLabel: '',
    diagramLabel: '',
    position: { x: 0, y: 0 },
  });

  const getCenteredPosition = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };

      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const containerX = clientX - rect.left;
      const containerY = clientY - rect.top;
      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();
      const canvasX = (containerX - stageX) / scale;
      const canvasY = (containerY - stageY) / scale;

      return {
        x: canvasX - NODE_WIDTH / 2,
        y: canvasY - NODE_HEIGHT / 2,
      };
    },
    [stageRef],
  );

  const getElementName = useCallback((elementId: string): string => {
    if (!activeTabId) return 'Element';

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return 'Element';
    const freshFileNode = freshProject.nodes[activeTabId];
    if (!freshFileNode || freshFileNode.type !== 'FILE') return 'Element';

    const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;

    if (isStandaloneFile) {
      const localM = getLocalModel(activeTabId);
      if (!localM) return 'Element';
      return (
        localM.classes[elementId]?.name ??
        localM.interfaces[elementId]?.name ??
        localM.enums[elementId]?.name ??
        'Element'
      );
    } else {
      const ms = useModelStore.getState();
      if (!ms.model) return 'Element';
      return (
        ms.model.classes[elementId]?.name ??
        ms.model.interfaces[elementId]?.name ??
        ms.model.enums[elementId]?.name ??
        'Element'
      );
    }
  }, [activeTabId]);

  const checkDuplicateElement = useCallback(
    (elementId: string): ViewNode | null => {
      if (!activeTabId) return null;

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return null;
      const freshFileNode = freshProject.nodes[activeTabId];
      if (!freshFileNode || freshFileNode.type !== 'FILE') return null;
      const freshContent = (freshFileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return null;
      const freshView = freshContent as DiagramView;

      return freshView.nodes.find((vn) => vn.elementId === elementId) ?? null;
    },
    [activeTabId],
  );

  const addElementToDiagram = useCallback(
    (
      elementId: string,
      position: { x: number; y: number },
      replaceNodeId?: string,
      parentPackageId?: string,
    ) => {
      if (!activeTabId) return;
      const newViewNode: ViewNode = {
        id: crypto.randomUUID(),
        elementId,
        x: position.x,
        y: position.y,
        ...(parentPackageId ? { parentPackageId } : {}),
      };
      withUndo('vfs', 'Add to Diagram', activeTabId, (draft: any) => {
        const node = draft.project?.nodes[activeTabId];
        if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
        if (replaceNodeId) {
          node.content.nodes = node.content.nodes.filter((vn: ViewNode) => vn.id !== replaceNodeId);
        }
        node.content.nodes.push(newViewNode);
      });
    },
    [activeTabId, updateFileContent],
  );

  // ── Package membership restoration (R4) ──────────────────────────────────
  // Dropping a class/interface/enum from the Model Explorer whose package is not
  // on the canvas: nest it under the existing package node, or ask whether to
  // recreate the package (anidar) vs place it free.
  const [packageRestoreModal, setPackageRestoreModal] = useState<{
    isOpen: boolean;
    elementId: string;
    elementName: string;
    packagePath: string;
    position: { x: number; y: number };
    isStandaloneFile: boolean;
  }>({ isOpen: false, elementId: '', elementName: '', packagePath: '', position: { x: 0, y: 0 }, isStandaloneFile: false });

  /**
   * Returns true when the drop was handled as a package restoration (nested
   * directly, or the choice modal was opened). Returns false when the element
   * has no package membership and should be added normally.
   */
  const tryPackageRestore = useCallback(
    (elementId: string, position: { x: number; y: number }, isStandaloneFile: boolean): boolean => {
      if (!activeTabId) return false;
      const project = useVFSStore.getState().project;
      const file = project?.nodes[activeTabId] as VFSFile | undefined;
      if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return false;
      const model = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
      if (!model) return false;

      const el = model.classes[elementId] ?? model.interfaces[elementId] ?? model.enums[elementId];
      if (!el) return false;
      const pkgName = (el as { packageName?: string }).packageName;
      const pkgId = (el as { packageId?: string }).packageId;
      if (!pkgName && !pkgId) return false; // no membership → normal add

      const pkg = (pkgId && model.packages[pkgId])
        ? model.packages[pkgId]
        : Object.values(model.packages).find((p) => p.name === pkgName);
      if (!pkg) return false; // dangling membership → normal add

      const view = file.content as DiagramView;
      const pkgVN = view.nodes.find((vn) => vn.elementId === pkg.id);
      if (pkgVN) {
        // Package already on canvas → nest directly (position relative to it).
        const pkgAbs = getAbsolutePosition(pkgVN, view.nodes);
        addElementToDiagram(elementId, { x: position.x - pkgAbs.x, y: position.y - pkgAbs.y }, undefined, pkgVN.id);
        return true;
      }

      // Package absent → ask the user.
      setPackageRestoreModal({
        isOpen: true,
        elementId,
        elementName: el.name,
        packagePath: pkg.name,
        position,
        isStandaloneFile,
      });
      return true;
    },
    [activeTabId, addElementToDiagram],
  );

  const handleRestoreNest = useCallback(() => {
    const { elementId, packagePath, position, isStandaloneFile } = packageRestoreModal;
    setPackageRestoreModal((p) => ({ ...p, isOpen: false }));
    if (!activeTabId) return;
    const project = useVFSStore.getState().project;
    const file = project?.nodes[activeTabId] as VFSFile | undefined;
    if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
    const model = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
    if (!model) return;

    const view = file.content as DiagramView;
    const findPkgByName = (name: string) => Object.values(model.packages).find((p) => p.name === name);

    const PAD = 40;
    const TAB_H = 24;

    // Create any missing ancestor package view nodes ("A.B.C" → A, A.B, A.B.C),
    // nesting each under the previous; existing ones are reused as the parent.
    const segs = packagePath.split('.');
    const cumPaths = segs.map((_, i) => segs.slice(0, i + 1).join('.'));
    const newNodes: ViewNode[] = [];
    let parentVNId: string | null = null;
    for (const path of cumPaths) {
      const pkg = findPkgByName(path);
      if (!pkg) return; // unresolved package — abort
      const existing =
        view.nodes.find((vn) => vn.elementId === pkg.id) ??
        newNodes.find((vn) => vn.elementId === pkg.id);
      if (existing) { parentVNId = existing.id; continue; }
      const vnId = crypto.randomUUID();
      const isRoot = parentVNId === null;
      newNodes.push({
        id: vnId,
        elementId: pkg.id,
        x: isRoot ? position.x : PAD,
        y: isRoot ? position.y : TAB_H + PAD,
        collapsed: false,
        parentPackageId: parentVNId,
      });
      parentVNId = vnId;
    }

    // The dropped element nested inside the leaf package.
    newNodes.push({
      id: crypto.randomUUID(),
      elementId,
      x: PAD,
      y: TAB_H + PAD,
      ...(parentVNId ? { parentPackageId: parentVNId } : {}),
    });

    withUndo('vfs', 'Restore into Package', activeTabId, (draft: any) => {
      const node = draft.project?.nodes[activeTabId];
      if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
      node.content.nodes.push(...newNodes);
    });
  }, [packageRestoreModal, activeTabId]);

  const handleRestoreFree = useCallback(() => {
    const { elementId, position } = packageRestoreModal;
    setPackageRestoreModal((p) => ({ ...p, isOpen: false }));
    addElementToDiagram(elementId, position);
  }, [packageRestoreModal, addElementToDiagram]);

  const handleRestoreCancel = useCallback(() => {
    setPackageRestoreModal((p) => ({ ...p, isOpen: false }));
  }, []);

  const handleModalReplace = useCallback(() => {
    const { elementId, position } = duplicateModal;
    const existingNode = checkDuplicateElement(elementId);
    if (existingNode) {
      addElementToDiagram(elementId, position, existingNode.id);
    }
    setDuplicateModal({ isOpen: false, fileName: '', elementId: '', position: { x: 0, y: 0 } });
  }, [duplicateModal, checkDuplicateElement, addElementToDiagram]);

  const handleModalCancel = useCallback(() => {
    setDuplicateModal({ isOpen: false, fileName: '', elementId: '', position: { x: 0, y: 0 } });
  }, []);

  const handleDontShowAgain = useCallback(
    (checked: boolean) => {
      if (checked) {
        setHideDuplicateFileWarning(true);
      }
    },
    [setHideDuplicateFileWarning],
  );

  const handleHierarchyCancel = useCallback(() => {
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleHierarchyPlaceSimple = useCallback(() => {
    const { packageFullPath, position, isStandaloneFile } = hierarchyModal;
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
    if (!activeTabId) return;

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return;
    const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;

    const newElementId = crypto.randomUUID();
    const newViewNodeId = crypto.randomUUID();

    // If package already exists in model, just add a view node
    if (currentModel?.packages) {
      const existingPkg =
        Object.values(currentModel.packages).find((p) => p.name === packageFullPath) ??
        Object.values(currentModel.packages).find((p) => p.name === packageFullPath.split('.').pop());
      if (existingPkg) {
        undoTransaction({
          label: `Add to canvas: ${packageFullPath}`,
          scope: isStandaloneFile ? activeTabId : 'global',
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              if (node.content.nodes.some((vn: any) => vn.elementId === existingPkg.id)) return;
              node.content.nodes.push({
                id: newViewNodeId, elementId: existingPkg.id,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            },
          }],
          affectedElementIds: [existingPkg.id],
        });
        return;
      }
    }

    if (isStandaloneFile) {
      undoTransaction({
        label: `Create Package: ${packageFullPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const node = draft.project?.nodes[activeTabId];
            if (!node || node.type !== 'FILE') return;
            if (!node.localModel) {
              const now = Date.now();
              node.localModel = {
                id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                packageNames: [],
                createdAt: now, updatedAt: now,
              };
            }
            // Ensure packageNames array exists
            if (!node.localModel.packageNames) node.localModel.packageNames = [];
            
            node.localModel.packages[newElementId] = {
              id: newElementId, name: packageFullPath, kind: 'PACKAGE',
              packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
            };
            // Remove from packageNames to avoid duplication in sidebar
            node.localModel.packageNames = node.localModel.packageNames.filter(
              (name: string) => name !== packageFullPath
            );
            node.localModel.updatedAt = Date.now();
            if (isDiagramView(node.content)) {
              node.content.nodes.push({
                id: newViewNodeId, elementId: newElementId,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            }
          },
        }],
      });
    } else {
      const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();
      undoTransaction({
        label: `Create Package: ${packageFullPath}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) {
                const now = Date.now();
                draft.model = {
                  id: domainModelId, name: 'Domain Model', version: '1.0.0',
                  packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                  attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                  objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                  packageNames: [], createdAt: now, updatedAt: now,
                };
              }
              // Ensure packageNames array exists
              if (!draft.model.packageNames) draft.model.packageNames = [];
              
              draft.model.packages[newElementId] = {
                id: newElementId, name: packageFullPath, kind: 'PACKAGE',
                packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
              };
              // Remove from packageNames to avoid duplication in sidebar
              draft.model.packageNames = draft.model.packageNames.filter(
                (name: string) => name !== packageFullPath
              );
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              node.content.nodes.push({
                id: newViewNodeId, elementId: newElementId,
                x: position.x, y: position.y, collapsed: false, parentPackageId: null,
              });
            },
          },
        ],
      });
    }
  }, [hierarchyModal, activeTabId]);

  const handleHierarchyPlaceHierarchy = useCallback(() => {
    const { parentPath, position, isStandaloneFile } = hierarchyModal;
    setHierarchyModal((prev) => ({ ...prev, isOpen: false }));
    if (!activeTabId) return;

    const freshProject = useVFSStore.getState().project;
    if (!freshProject) return;
    const freshFileNode = freshProject.nodes[activeTabId] as VFSFile;
    if (!freshFileNode || freshFileNode.type !== 'FILE') return;
    if (!isDiagramView(freshFileNode.content)) return;

    const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
    if (!currentModel) return;

    // Layout constants — spacing is content-driven (real node sizes), so a
    // class with many members reserves more room and nodes never overlap.
    const PAD = 40;         // inner padding inside a package
    const TAB_H = 24;       // package header tab height
    const GAP_X = 28;       // horizontal gap between sibling nodes
    const GAP_Y = 28;       // vertical gap between rows
    const PKG_GAP = 32;     // vertical gap between stacked sub-packages
    const MAX_ROW_W = 1100; // wrap a row once it grows past this width
    const MIN_PKG_W = 240;
    const MIN_PKG_H = 160;

    // Collect elements
    const parentElements: Array<{ id: string }> = [
      ...Object.values(currentModel.classes).filter((c) => c.packageName === parentPath),
      ...Object.values(currentModel.interfaces).filter((i) => i.packageName === parentPath),
      ...Object.values(currentModel.enums).filter((e) => e.packageName === parentPath),
    ];

    const allPkgPaths = new Set([
      ...Object.values(currentModel.packages).map((p) => p.name),
      ...(currentModel.packageNames ?? []),
    ]);
    const directSubPkgPaths = [...allPkgPaths]
      .filter((n) => {
        if (!n.startsWith(parentPath + '.')) return false;
        return !n.slice(parentPath.length + 1).includes('.');
      })
      .sort();

    const subPkgElements = new Map<string, Array<{ id: string }>>();
    for (const subPkgPath of directSubPkgPaths) {
      subPkgElements.set(subPkgPath, [
        ...Object.values(currentModel.classes).filter((c) => c.packageName === subPkgPath),
        ...Object.values(currentModel.interfaces).filter((i) => i.packageName === subPkgPath),
        ...Object.values(currentModel.enums).filter((e) => e.packageName === subPkgPath),
      ]);
    }

    // Resolve a model element's real rendered size (name + every member).
    const sizeOf = (id: string): { width: number; height: number } => {
      const cls = currentModel.classes[id];
      if (cls) return measureElementSize(currentModel, cls, cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS');
      const iface = currentModel.interfaces[id];
      if (iface) return measureElementSize(currentModel, iface, 'INTERFACE');
      const enm = currentModel.enums[id];
      if (enm) return measureElementSize(currentModel, enm, 'ENUM');
      return { width: 256, height: 120 };
    };

    // Shelf-packing: lay elements left→right, wrapping to a new row once the
    // current row exceeds MAX_ROW_W. Each row is as tall as its tallest node,
    // so variable-height nodes never collide.
    const packElements = (
      els: Array<{ id: string }>,
      originX: number,
      originY: number,
    ): { offsets: Map<string, { x: number; y: number }>; right: number; bottom: number } => {
      const offsets = new Map<string, { x: number; y: number }>();
      let x = originX;
      let y = originY;
      let rowH = 0;
      let right = originX;
      for (const el of els) {
        const { width: w, height: h } = sizeOf(el.id);
        if (x > originX && x + w > originX + MAX_ROW_W) {
          x = originX;
          y += rowH + GAP_Y;
          rowH = 0;
        }
        offsets.set(el.id, { x, y });
        right = Math.max(right, x + w);
        x += w + GAP_X;
        rowH = Math.max(rowH, h);
      }
      return { offsets, right, bottom: y + rowH };
    };

    // Compute layout — the dragged package's own elements first…
    const parentPack = packElements(parentElements, PAD, TAB_H + PAD);
    const parentElOffsets = parentPack.offsets;
    let contentRight = parentPack.right;
    let cursorY = parentElements.length > 0 ? parentPack.bottom + PKG_GAP : TAB_H + PAD;

    // …then each sub-package, sized to its own packed contents, stacked below.
    const subPkgOffsets = new Map<string, { x: number; y: number }>();
    const subPkgElOffsets = new Map<string, Map<string, { x: number; y: number }>>();
    const subPkgDims = new Map<string, { w: number; h: number }>();
    for (const subPkgPath of directSubPkgPaths) {
      const subEls = subPkgElements.get(subPkgPath) ?? [];
      const inner = packElements(subEls, PAD, TAB_H + PAD);
      const subW = Math.max(MIN_PKG_W, inner.right + PAD);
      const subH = Math.max(MIN_PKG_H, inner.bottom + PAD);
      subPkgElOffsets.set(subPkgPath, inner.offsets);
      subPkgDims.set(subPkgPath, { w: subW, h: subH });
      subPkgOffsets.set(subPkgPath, { x: PAD, y: cursorY });
      cursorY += subH + PKG_GAP;
      contentRight = Math.max(contentRight, PAD + subW);
    }

    const lastBottom = directSubPkgPaths.length > 0 ? cursorY - PKG_GAP : parentPack.bottom;
    const parentW = Math.max(MIN_PKG_W, contentRight + PAD);
    const parentH = Math.max(MIN_PKG_H, lastBottom + PAD);

    // Find or create package element IDs — exact name match only to avoid
    // incorrectly reusing an unrelated package with the same short name.
    const findPkg = (name: string) =>
      Object.values(currentModel.packages).find((p) => p.name === name);

    const parentPkgExisting = findPkg(parentPath);
    const parentPkgElementId = parentPkgExisting?.id ?? crypto.randomUUID();
    const parentPkgIsNew = !parentPkgExisting;
    const parentPkgViewNodeId = crypto.randomUUID();

    const subPkgInfo = new Map<string, { elementId: string; viewNodeId: string; isNew: boolean }>();
    for (const subPkgPath of directSubPkgPaths) {
      const existing = findPkg(subPkgPath);
      subPkgInfo.set(subPkgPath, {
        elementId: existing?.id ?? crypto.randomUUID(),
        viewNodeId: crypto.randomUUID(),
        isNew: !existing,
      });
    }

    const parentElViewNodeIds = new Map<string, string>();
    for (const el of parentElements) parentElViewNodeIds.set(el.id, crypto.randomUUID());

    const subPkgElViewNodeIds = new Map<string, Map<string, string>>();
    for (const subPkgPath of directSubPkgPaths) {
      const m = new Map<string, string>();
      for (const el of subPkgElements.get(subPkgPath) ?? []) m.set(el.id, crypto.randomUUID());
      subPkgElViewNodeIds.set(subPkgPath, m);
    }

    // Relations between placed elements
    const allPlacedIds = new Set([
      ...parentElements.map((el) => el.id),
      ...[...subPkgElements.values()].flatMap((els) => els.map((el) => el.id)),
    ]);
    const relevantRelations = Object.values(currentModel.relations ?? {}).filter(
      (rel) => allPlacedIds.has(rel.sourceId) && allPlacedIds.has(rel.targetId),
    );

    const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();

    // Build flat view nodes array with absolute canvas coordinates
    const buildViewNodes = () => {
      const nodes: Array<Record<string, unknown>> = [];
      nodes.push({ id: parentPkgViewNodeId, elementId: parentPkgElementId, x: position.x, y: position.y, width: parentW, height: parentH, collapsed: false, parentPackageId: null });
      for (const el of parentElements) {
        const off = parentElOffsets.get(el.id);
        if (!off) continue;
        // Store position relative to parent package
        nodes.push({ id: parentElViewNodeIds.get(el.id)!, elementId: el.id, x: off.x, y: off.y, parentPackageId: parentPkgViewNodeId });
      }
      for (const subPkgPath of directSubPkgPaths) {
        const info = subPkgInfo.get(subPkgPath)!;
        const off = subPkgOffsets.get(subPkgPath)!;
        const dims = subPkgDims.get(subPkgPath)!;
        // Store position relative to parent package
        nodes.push({ id: info.viewNodeId, elementId: info.elementId, x: off.x, y: off.y, width: dims.w, height: dims.h, collapsed: false, parentPackageId: parentPkgViewNodeId });
        const elVNIds = subPkgElViewNodeIds.get(subPkgPath)!;
        const elOffs = subPkgElOffsets.get(subPkgPath)!;
        for (const el of subPkgElements.get(subPkgPath) ?? []) {
          const elOff = elOffs.get(el.id);
          if (!elOff) continue;
          // Store position relative to sub-package
          nodes.push({ id: elVNIds.get(el.id)!, elementId: el.id, x: elOff.x, y: elOff.y, parentPackageId: info.viewNodeId });
        }
      }
      return nodes;
    };

    // Edges drawn onto the canvas now default to free-form straight; legacy
    // edges (no routingMode) keep orthogonal so existing diagrams are unchanged.
    const viewEdges = relevantRelations.map((rel) => ({ id: crypto.randomUUID(), relationId: rel.id, waypoints: [], routingMode: 'straight' as const }));

    if (isStandaloneFile) {
      undoTransaction({
        label: `Place Hierarchy: ${parentPath}`,
        scope: activeTabId,
        mutations: [{
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || file.type !== 'FILE') return;
            if (!file.localModel) {
              const now = Date.now();
              file.localModel = {
                id: crypto.randomUUID(), name: `${file.name} (standalone)`, version: '1.0.0',
                packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                packageNames: [],
                createdAt: now, updatedAt: now,
              };
            }
            // Ensure packageNames array exists
            if (!file.localModel.packageNames) file.localModel.packageNames = [];
            
            if (parentPkgIsNew) {
              file.localModel.packages[parentPkgElementId] = {
                id: parentPkgElementId, name: parentPath, kind: 'PACKAGE',
                packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
              };
              // Remove from packageNames to avoid duplication in sidebar
              file.localModel.packageNames = file.localModel.packageNames.filter(
                (name: string) => name !== parentPath
              );
            }
            for (const subPkgPath of directSubPkgPaths) {
              const info = subPkgInfo.get(subPkgPath)!;
              if (info.isNew) {
                file.localModel.packages[info.elementId] = {
                  id: info.elementId, name: subPkgPath, kind: 'PACKAGE',
                  packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                };
                // Remove from packageNames to avoid duplication in sidebar
                file.localModel.packageNames = file.localModel.packageNames.filter(
                  (name: string) => name !== subPkgPath
                );
              }
            }
            file.localModel.updatedAt = Date.now();
            if (!isDiagramView(file.content)) return;
            const existingEls = new Set(file.content.nodes.map((vn: any) => vn.elementId));
            for (const vn of buildViewNodes()) {
              if (existingEls.has(vn.elementId)) continue;
              file.content.nodes.push(vn);
            }
            file.content.edges.push(...viewEdges);
          },
        }],
      });
    } else {
      undoTransaction({
        label: `Place Hierarchy: ${parentPath}`,
        scope: 'global',
        mutations: [
          {
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) {
                const now = Date.now();
                draft.model = {
                  id: domainModelId, name: 'Domain Model', version: '1.0.0',
                  packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                  attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                  objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                  packageNames: [], createdAt: now, updatedAt: now,
                };
              }
              // Ensure packageNames array exists
              if (!draft.model.packageNames) draft.model.packageNames = [];
              
              if (parentPkgIsNew) {
                draft.model.packages[parentPkgElementId] = {
                  id: parentPkgElementId, name: parentPath, kind: 'PACKAGE',
                  packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                };
                // Remove from packageNames to avoid duplication in sidebar
                draft.model.packageNames = draft.model.packageNames.filter(
                  (name: string) => name !== parentPath
                );
              }
              for (const subPkgPath of directSubPkgPaths) {
                const info = subPkgInfo.get(subPkgPath)!;
                if (info.isNew) {
                  draft.model.packages[info.elementId] = {
                    id: info.elementId, name: subPkgPath, kind: 'PACKAGE',
                    packageIds: [], classIds: [], interfaceIds: [], enumIds: [], dataTypeIds: [],
                  };
                  // Remove from packageNames to avoid duplication in sidebar
                  draft.model.packageNames = draft.model.packageNames.filter(
                    (name: string) => name !== subPkgPath
                  );
                }
              }
              draft.model.updatedAt = Date.now();
            },
          },
          {
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
              const existingEls = new Set(node.content.nodes.map((vn: any) => vn.elementId));
              for (const vn of buildViewNodes()) {
                if (existingEls.has(vn.elementId)) continue;
                node.content.nodes.push(vn);
              }
              node.content.edges.push(...viewEdges);
            },
          },
        ],
      });
    }
  }, [hierarchyModal, activeTabId]);

  /**
   * Creates a new semantic element + ViewNode for the given stereotype at a
   * canvas position. Extracted from onDrop so the cross-diagram "add anyway"
   * path can reuse the exact same creation logic.
   */
  const createNodeFromStereotype = useCallback(
    (stereotype: stereotype, position: { x: number; y: number }) => {
      if (!activeTabId) return;

      const dropConfig = VFS_DROP_CONFIG[stereotype];
      if (!dropConfig) {
        console.warn(`[VFS Drop] Stereotype "${stereotype}" has no VFS semantic mapping. Drop ignored.`);
        return;
      }

      const freshProject = useVFSStore.getState().project;
      if (!freshProject) return;
      const freshFileNode = freshProject.nodes[activeTabId];
      if (!freshFileNode || freshFileNode.type !== 'FILE') return;
      const freshContent = (freshFileNode as VFSFile).content;
      if (!isDiagramView(freshContent)) return;
      // Snapshot before either mutation runs — read-only lookup, so the
      // pre-drop node list is exactly what getOrCreateActivityId needs.
      const existingViewNodes = freshContent.nodes;

      const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;
      const isExternalFile = !!(freshFileNode as VFSFile).isExternal;
      const newElementId = crypto.randomUUID();
      const newViewNodeId = crypto.randomUUID();
      const effectivePosition = dropConfig.overridePosition
        ? dropConfig.overridePosition(position)
        : position;

      if (isStandaloneFile) {
        const currentLocalModel = getLocalModel(activeTabId);
        const elementName = (currentLocalModel && !dropConfig.isVisualOnly)
          ? dropConfig.getNextName(currentLocalModel)
          : 'Note';

        undoTransaction({
          label: `Create ${stereotype}`,
          scope: activeTabId,
          mutations: [{
            store: 'vfs',
            mutate: (draft: any) => {
              const node = draft.project?.nodes[activeTabId];
              if (!node || node.type !== 'FILE') return;
              if (!dropConfig.isVisualOnly) {
                if (!node.localModel) {
                  const now = Date.now();
                  node.localModel = {
                    id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                    createdAt: now, updatedAt: now,
                  };
                }
                dropConfig.applyToLocalModelDraft(node.localModel, newElementId, elementName, existingViewNodes);
              }
              if (isDiagramView(node.content)) {
                node.content.nodes.push({
                  id: newViewNodeId,
                  elementId: dropConfig.isVisualOnly ? '' : newElementId,
                  x: effectivePosition.x, y: effectivePosition.y,
                  ...(dropConfig.initialDimensions ?? {}),
                });
              }
            },
          }],
        });
      } else {
        const modelState = useModelStore.getState();
        const currentModel = modelState.model;
        const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();
        const elementName = (currentModel && !dropConfig.isVisualOnly)
          ? dropConfig.getNextName(currentModel)
          : 'Note';

        if (dropConfig.isVisualOnly) {
          withUndo('vfs', 'Add Note', activeTabId, (draft: any) => {
            const node = draft.project?.nodes[activeTabId];
            if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
            node.content.nodes.push({ id: newViewNodeId, elementId: '', x: effectivePosition.x, y: effectivePosition.y });
          });
        } else {
          undoTransaction({
            label: `Create ${stereotype}`,
            scope: 'global',
            mutations: [
              {
                store: 'model',
                mutate: (draft: any) => {
                  if (!draft.model) {
                    const now = Date.now();
                    draft.model = {
                      id: domainModelId, name: 'Domain Model', version: '1.0.0',
                      packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                      attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                      objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                      packageNames: [], createdAt: now, updatedAt: now,
                    };
                  }
                  dropConfig.applyToModelDraft(
                    draft.model, newElementId, elementName, isExternalFile || undefined, existingViewNodes,
                  );
                },
              },
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const node = draft.project?.nodes[activeTabId];
                  if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                  node.content.nodes.push({
                    id: newViewNodeId,
                    elementId: newElementId,
                    x: effectivePosition.x, y: effectivePosition.y,
                    ...(dropConfig.initialDimensions ?? {}),
                  });
                },
              },
            ],
          });
        }
      }
    },
    [activeTabId],
  );

  const handleCrossDiagramAddAnyway = useCallback(() => {
    const { stereotype, position } = crossDiagramModal;
    setCrossDiagramModal((prev) => ({ ...prev, isOpen: false }));
    if (stereotype) createNodeFromStereotype(stereotype, position);
  }, [crossDiagramModal, createNodeFromStereotype]);

  const handleCrossDiagramCancel = useCallback(() => {
    setCrossDiagramModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const hasPackageData = event.dataTransfer.types.includes(DRAG_TYPE_PACKAGE.toLowerCase());
      const hasNewData = event.dataTransfer.types.includes(DRAG_TYPE_NEW.toLowerCase());
      const hasExistingData = event.dataTransfer.types.includes(DRAG_TYPE_EXISTING.toLowerCase());
      const hasSidebarClass = event.dataTransfer.types.includes(SIDEBAR_DND_TYPE.toLowerCase());

      console.debug('[DnD:onDrop] types:', [...event.dataTransfer.types], { hasPackageData, hasNewData, hasExistingData, hasSidebarClass });

      if (!hasPackageData && !hasNewData && !hasExistingData && !hasSidebarClass) {
        return;
      }

      const position = getCenteredPosition(event.clientX, event.clientY);
      console.debug('[DnD:onDrop] position:', position, 'stageRef.current:', !!stageRef.current);

      const packageData = event.dataTransfer.getData(DRAG_TYPE_PACKAGE);
      console.debug('[DnD:onDrop] packageData:', packageData, 'activeTabId:', activeTabId);
      if (packageData) {
        if (!activeTabId) { console.debug('[DnD:onDrop] early return: no activeTabId'); return; }

        const freshProject = useVFSStore.getState().project;
        if (!freshProject) { console.debug('[DnD:onDrop] early return: no freshProject'); return; }
        const freshFileNode = freshProject.nodes[activeTabId];
        if (!freshFileNode || freshFileNode.type !== 'FILE') { console.debug('[DnD:onDrop] early return: bad fileNode', freshFileNode); return; }
        const freshContent = (freshFileNode as VFSFile).content;
        if (!isDiagramView(freshContent)) { console.debug('[DnD:onDrop] early return: isDiagramView failed', freshContent); return; }

        const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;
        console.debug('[DnD:onDrop] isStandaloneFile:', isStandaloneFile, 'packageFullPath:', packageData);
        const packageFullPath = packageData;
        let existingPackageId: string | null = null;
        let existingViewNodeId: string | null = null;
        
        const findParentPackageViewNode = (fullPath: string): string | null => {
          const segments = fullPath.split('.');
          if (segments.length <= 1) return null;
          
          const parentPath = segments.slice(0, -1).join('.');
          const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
          if (!currentModel) return null;
          
          for (const vn of freshContent.nodes) {
            const pkg = currentModel.packages?.[vn.elementId];
            if (!pkg) continue;
            
            let effectivePath = pkg.name;
            let currentVN = vn;
            while (currentVN.parentPackageId) {
              const parentVN = freshContent.nodes.find((n: ViewNode) => n.id === currentVN.parentPackageId);
              if (!parentVN) break;
              const parentPkg = currentModel.packages?.[parentVN.elementId];
              if (!parentPkg) break;
              effectivePath = `${parentPkg.name}.${effectivePath}`;
              currentVN = parentVN;
            }
            
            if (effectivePath === parentPath) {
              return vn.id;
            }
          }
          return null;
        };
        
        const currentModel = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
        if (currentModel?.packages) {
          for (const vn of freshContent.nodes) {
            const pkg = currentModel.packages[vn.elementId];
            if (!pkg) continue;
            
            let effectivePath = pkg.name;
            let currentVN = vn;
            while (currentVN.parentPackageId) {
              const parentVN = freshContent.nodes.find((n: ViewNode) => n.id === currentVN.parentPackageId);
              if (!parentVN) break;
              const parentPkg = currentModel.packages[parentVN.elementId];
              if (!parentPkg) break;
              effectivePath = `${parentPkg.name}.${effectivePath}`;
              currentVN = parentVN;
            }
            
            if (effectivePath === packageFullPath) {
              existingPackageId = pkg.id;
              existingViewNodeId = vn.id;
              break;
            }
          }
        }
        
        console.debug('[DnD:onDrop] existingViewNodeId:', existingViewNodeId, 'existingPackageId:', existingPackageId);

        if (existingViewNodeId) {
          showToast(`"${packageFullPath}" is already on canvas. Drag it directly to move it.`);
          return;
        }

        if (!existingPackageId && currentModel) {
          let pkg = Object.values(currentModel.packages ?? {}).find(p => p.name === packageFullPath);
          if (!pkg) {
            const lastSegment = packageFullPath.split('.').pop();
            pkg = Object.values(currentModel.packages ?? {}).find(p => p.name === lastSegment);
          }
          if (pkg) existingPackageId = pkg.id;
        }

        console.debug('[DnD:onDrop] after fallback — existingPackageId:', existingPackageId, 'currentModel packages:', Object.keys(currentModel?.packages ?? {}));

        const parentViewNodeId = findParentPackageViewNode(packageFullPath);

        // Check if we should show hierarchy modal BEFORE placing.
        // If the dropped package has its own content (classes or sub-packages),
        // offer to place it alone or with everything inside it.
        const ownContent = getParentContent(packageFullPath, packageFullPath, currentModel);
        console.debug('[DnD:onDrop] hierarchy-modal check — packageFullPath:', packageFullPath, { ...ownContent, willShow: ownContent.classCount > 0 || ownContent.subPackageCount > 0 });

        if (ownContent.classCount > 0 || ownContent.subPackageCount > 0) {
          setHierarchyModal({
            isOpen: true,
            packageFullPath,
            // Anchor the "place hierarchy" layout to the dragged package itself,
            // so it places the package with all its own classes & sub-packages.
            parentPath: packageFullPath,
            classCount: ownContent.classCount,
            subPackageCount: ownContent.subPackageCount,
            position,
            isStandaloneFile,
          });
          return;
        }

        // If package exists in model but not on canvas, just add view node
        if (existingPackageId) {
          console.debug('[DnD:onDrop] → calling undoTransaction to add view node, existingPackageId:', existingPackageId);
          undoTransaction({
            label: `Add to canvas: ${packageFullPath}`,
            scope: isStandaloneFile ? activeTabId : 'global',
            mutations: [{
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                console.debug('[DnD:mutate] node:', node?.type, 'isDiagramView:', isDiagramView(node?.content));
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                const newViewNodeId = crypto.randomUUID();
                const newVN = {
                  id: newViewNodeId,
                  elementId: existingPackageId,
                  x: position.x,
                  y: position.y,
                  collapsed: false,
                  parentPackageId: parentViewNodeId,
                };
                console.debug('[DnD:mutate] pushing view node:', newVN);
                node.content.nodes.push(newVN);
                console.debug('[DnD:mutate] nodes count after push:', node.content.nodes.length);
              },
            }],
            affectedElementIds: [existingPackageId],
          });
          console.debug('[DnD:onDrop] undoTransaction done');
          return;
        }

        // Create new package
        const newElementId = crypto.randomUUID();
        const newViewNodeId = crypto.randomUUID();
        const packageName = packageFullPath;

        if (isStandaloneFile) {
          undoTransaction({
            label: `Create Package: ${packageName}`,
            scope: activeTabId,
            mutations: [{
              store: 'vfs',
              mutate: (draft: any) => {
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE') return;
                if (!node.localModel) {
                  const now = Date.now();
                  node.localModel = {
                    id: crypto.randomUUID(), name: `${node.name} (standalone)`, version: '1.0.0',
                    packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                    attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                    objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                    createdAt: now, updatedAt: now,
                  };
                }
                node.localModel.packages[newElementId] = {
                  id: newElementId,
                  name: packageName,
                  kind: 'PACKAGE',
                  packageIds: [],
                  classIds: [],
                  interfaceIds: [],
                  enumIds: [],
                  dataTypeIds: [],
                };
                node.localModel.updatedAt = Date.now();
                if (isDiagramView(node.content)) {
                  node.content.nodes.push({
                    id: newViewNodeId,
                    elementId: newElementId,
                    x: position.x,
                    y: position.y,
                    collapsed: false,
                    parentPackageId: parentViewNodeId,
                  });
                }
              },
            }],
          });
        } else {
          const domainModelId = freshProject.domainModelId ?? crypto.randomUUID();

          undoTransaction({
            label: `Create Package: ${packageName}`,
            scope: 'global',
            mutations: [
              {
                store: 'model',
                mutate: (draft: any) => {
                  if (!draft.model) {
                    const now = Date.now();
                    draft.model = {
                      id: domainModelId, name: 'Domain Model', version: '1.0.0',
                      packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                      attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                      objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                      packageNames: [], createdAt: now, updatedAt: now,
                    };
                  }
                  draft.model.packages[newElementId] = {
                    id: newElementId,
                    name: packageName,
                    kind: 'PACKAGE',
                    packageIds: [],
                    classIds: [],
                    interfaceIds: [],
                    enumIds: [],
                    dataTypeIds: [],
                  };
                  draft.model.updatedAt = Date.now();
                },
              },
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const node = draft.project?.nodes[activeTabId];
                  if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                  node.content.nodes.push({
                    id: newViewNodeId,
                    elementId: newElementId,
                    x: position.x,
                    y: position.y,
                    collapsed: false,
                    parentPackageId: parentViewNodeId,
                  });
                },
              },
            ],
          });
        }
        return;
      }

      const existingElementId = event.dataTransfer.getData(DRAG_TYPE_EXISTING);
      if (existingElementId) {
        const existingNode = checkDuplicateElement(existingElementId);
        
        if (existingNode) {
          const elementName = getElementName(existingElementId);
          
          if (hideDuplicateFileWarning) {
            showToast(`"${elementName}" is already in the diagram`);
            return;
          }
          
          setDuplicateModal({
            isOpen: true,
            fileName: elementName,
            elementId: existingElementId,
            position,
          });
          return;
        }

        // R4 — if the element belongs to a package, nest it (or ask) instead of
        // dropping it free, so membership defined in the model is restored.
        const fnode = useVFSStore.getState().project?.nodes[activeTabId ?? ''];
        const isStandaloneFile = fnode?.type === 'FILE' && (fnode as VFSFile).standalone === true;
        if (tryPackageRestore(existingElementId, position, isStandaloneFile)) return;

        addElementToDiagram(existingElementId, position);
        return;
      }

      // ── Sidebar class/interface/actor → new Lifeline (Sequence Diagrams only) ──
      const sidebarClassRaw = event.dataTransfer.getData(SIDEBAR_DND_TYPE);
      if (sidebarClassRaw) {
        if (!activeTabId) return;
        const freshProject = useVFSStore.getState().project;
        if (!freshProject) return;
        const freshFileNode = freshProject.nodes[activeTabId];
        if (!freshFileNode || freshFileNode.type !== 'FILE') return;

        if ((freshFileNode as VFSFile).diagramType !== 'SEQUENCE_DIAGRAM') return;

        const freshContent = (freshFileNode as VFSFile).content;
        if (!isDiagramView(freshContent)) return;
        const freshView = freshContent as DiagramView;
        const isStandaloneFile = (freshFileNode as VFSFile).standalone === true;

        let parsed: { elementId: string };
        try { parsed = JSON.parse(sidebarClassRaw); }
        catch { return; }
        const { elementId } = parsed;

        const model = isStandaloneFile ? getLocalModel(activeTabId) : useModelStore.getState().model;
        if (!model) return;

        // Infer participantKind and display name from the element type.
        type ParticipantKind = 'CLASS' | 'INTERFACE' | 'ACTOR' | 'ANONYMOUS';
        let participantKind: ParticipantKind = 'ANONYMOUS';
        let elementName = 'Lifeline';

        if (model.classes[elementId]) {
          participantKind = 'CLASS';
          elementName = model.classes[elementId].name;
        } else if (model.interfaces[elementId]) {
          participantKind = 'INTERFACE';
          elementName = model.interfaces[elementId].name;
        } else if (model.actors[elementId]) {
          participantKind = 'ACTOR';
          elementName = model.actors[elementId].name;
        }

        // Duplicate check: any existing lifeline in this diagram that represents the same element.
        const isDuplicate = freshView.nodes.some((vn) => {
          const ll = model.lifelines?.[vn.elementId];
          return ll?.represents === elementId;
        });
        if (isDuplicate) {
          showToast(`"${elementName}" is already in this diagram`);
          return;
        }

        // Compute drop position: center the lifeline head (140px wide) at the cursor X, y=0.
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.container().getBoundingClientRect();
        const scale = stage.scaleX();
        const canvasX = (event.clientX - rect.left - stage.x()) / scale;
        const lifelineX = canvasX - 70; // 70 = LIFELINE_HEAD_W / 2

        const lifelineId = crypto.randomUUID();
        const viewNodeId = crypto.randomUUID();

        if (isStandaloneFile) {
          undoTransaction({
            label: `Add Lifeline: ${elementName}`,
            scope: activeTabId,
            mutations: [{
              store: 'vfs',
              mutate: (draft: any) => {
                const fileNode = draft.project?.nodes[activeTabId];
                if (!fileNode || fileNode.type !== 'FILE') return;
                fileNode.localModel = fileNode.localModel ?? {
                  id: crypto.randomUUID(), name: 'standalone', version: '1.0.0',
                  packages: {}, classes: {}, interfaces: {}, enums: {}, dataTypes: {},
                  attributes: {}, operations: {}, actors: {}, useCases: {}, activityNodes: {},
                  objectInstances: {}, components: {}, nodes: {}, artifacts: {}, relations: {},
                  createdAt: Date.now(), updatedAt: Date.now(),
                };
                fileNode.localModel.lifelines = fileNode.localModel.lifelines ?? {};
                fileNode.localModel.lifelines[lifelineId] = {
                  id: lifelineId, kind: 'LIFELINE', name: elementName,
                  participantKind, represents: elementId,
                };
                fileNode.localModel.updatedAt = Date.now();
                if (isDiagramView(fileNode.content)) {
                  fileNode.content.nodes.push({ id: viewNodeId, elementId: lifelineId, x: lifelineX, y: 0 });
                }
              },
            }],
          });
        } else {
          undoTransaction({
            label: `Add Lifeline: ${elementName}`,
            scope: 'global',
            mutations: [
              {
                store: 'model',
                mutate: (draft: any) => {
                  if (!draft.model) return;
                  draft.model.lifelines = draft.model.lifelines ?? {};
                  draft.model.lifelines[lifelineId] = {
                    id: lifelineId, kind: 'LIFELINE', name: elementName,
                    participantKind, represents: elementId,
                  };
                  draft.model.updatedAt = Date.now();
                },
              },
              {
                store: 'vfs',
                mutate: (draft: any) => {
                  const fileNode = draft.project?.nodes[activeTabId];
                  if (!fileNode || fileNode.type !== 'FILE' || !isDiagramView(fileNode.content)) return;
                  fileNode.content.nodes.push({ id: viewNodeId, elementId: lifelineId, x: lifelineX, y: 0 });
                },
              },
            ],
          });
        }
        return;
      }

      const stereotype = event.dataTransfer.getData(DRAG_TYPE_NEW) as stereotype;

      if (!stereotype) return;

      if (!activeTabId) return;

      if (!VFS_DROP_CONFIG[stereotype]) {
        console.warn(`[VFS Drop] Stereotype "${stereotype}" has no VFS semantic mapping. Drop ignored.`);
        return;
      }

      // Cross-diagram guard: a tool the active diagram type does not natively
      // own goes through a confirmation (add anyway in free mode / abstain).
      const activeNode = useVFSStore.getState().project?.nodes[activeTabId];
      const activeDiagramType =
        activeNode?.type === 'FILE' ? (activeNode as VFSFile).diagramType : undefined;
      if (activeDiagramType && !getNativeNodeToolIds(activeDiagramType).has(stereotype)) {
        const toolDef = getAllTools().nodes.find((tdef) => tdef.id === stereotype);
        const toolLabel = toolDef
          ? toolDef.translationKey ? t(toolDef.translationKey) : toolDef.label
          : stereotype;
        let diagramLabel: string = activeDiagramType;
        try {
          diagramLabel = getDiagramRegistry(activeDiagramType).displayName;
        } catch {
          /* unregistered type — fall back to the raw diagram type */
        }
        setCrossDiagramModal({ isOpen: true, stereotype, toolLabel, diagramLabel, position });
        return;
      }

      createNodeFromStereotype(stereotype, position);
    },
    [
      getCenteredPosition,
      activeTabId,
      updateFileContent,
      checkDuplicateElement,
      getElementName,
      hideDuplicateFileWarning,
      showToast,
      addElementToDiagram,
      stageRef,
      createNodeFromStereotype,
      t,
    ],
  );

  return {
    onDragOver,
    onDrop,
    duplicateModal: {
      isOpen: duplicateModal.isOpen,
      fileName: duplicateModal.fileName,
      onReplace: handleModalReplace,
      onCancel: handleModalCancel,
      onDontShowAgain: handleDontShowAgain,
    },
    hierarchyModal: {
      isOpen: hierarchyModal.isOpen,
      packageFullPath: hierarchyModal.packageFullPath,
      parentPath: hierarchyModal.parentPath,
      classCount: hierarchyModal.classCount,
      subPackageCount: hierarchyModal.subPackageCount,
      onPlaceSimple: handleHierarchyPlaceSimple,
      onPlaceHierarchy: handleHierarchyPlaceHierarchy,
      onCancel: handleHierarchyCancel,
    },
    crossDiagramModal: {
      isOpen: crossDiagramModal.isOpen,
      toolLabel: crossDiagramModal.toolLabel,
      diagramLabel: crossDiagramModal.diagramLabel,
      onAddAnyway: handleCrossDiagramAddAnyway,
      onCancel: handleCrossDiagramCancel,
    },
    packageRestoreModal: {
      isOpen: packageRestoreModal.isOpen,
      elementName: packageRestoreModal.elementName,
      packagePath: packageRestoreModal.packagePath,
      onNest: handleRestoreNest,
      onFree: handleRestoreFree,
      onCancel: handleRestoreCancel,
    },
  };
}
