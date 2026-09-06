import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import { useUiStore } from '../../../../store/uiStore';
import { undoTransaction } from '../../../../core/undo/undoBridge';
import { openDiagramContainingElement } from './traceabilityNav';
import { isDiagramView } from '../useVFSCanvasController';
import { reparentViewNodeCoords } from '../../../../canvas/interactions/usePackageDrop';
import {
  relayoutPartitionViewNodes,
  computePartitionSwap,
  DEFAULT_PARTITION_WIDTH,
  type PartitionOrderEntry,
} from '../../../../canvas/engine/partitionLayout';
import {
  applyUpdateActivityPartition,
  applyDeleteActivityPartition,
  resolveCallsOperationLabel,
  resolveObjectNodeClassifierLabel,
} from '../../../../store/activityModelOps';
import type {
  IRActivityNode,
  IRActivityPartition,
  ViewNode,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  ActivityActionViewModel,
  ActivityControlNodeViewModel,
  ActivityControlKindVM,
  ActivityDecisionViewModel,
  ActivityDecisionKindVM,
  ActivityForkJoinViewModel,
  ActivityForkJoinKindVM,
  ActivityPartitionViewModel,
  ActivityObjectNodeViewModel,
} from '../../../../adapters/view-models/node.view-model';
import {
  resolveSemanticElement,
  getAbsolutePosition,
  makeNoteNode,
  type NodeBuilderContext,
} from './sharedNodeBuilders';

/** IR activity types that render as the rounded action box. */
const ACTION_TYPES = new Set<IRActivityNode['activityType']>(['ACTION', 'CALL_OPERATION']);

/** IR activity types that render as a control glyph, and the glyph they map to. */
const CONTROL_TYPES: Partial<Record<IRActivityNode['activityType'], ActivityControlKindVM>> = {
  INITIAL: 'INITIAL',
  ACTIVITY_FINAL: 'ACTIVITY_FINAL',
  FLOW_FINAL: 'FLOW_FINAL',
};

/** IR activity types that render as the decision/merge rhombus (A2). */
const DECISION_TYPES: Partial<Record<IRActivityNode['activityType'], ActivityDecisionKindVM>> = {
  DECISION: 'DECISION',
  MERGE: 'MERGE',
};

/** IR activity types that render as the fork/join bar (A2). */
const FORK_JOIN_TYPES: Partial<Record<IRActivityNode['activityType'], ActivityForkJoinKindVM>> = {
  FORK: 'FORK',
  JOIN: 'JOIN',
};

function makeActionNode(
  viewNode: ViewNode,
  node: IRActivityNode,
  allViewNodes: ViewNode[],
  callsOperationName: string | undefined,
  onRename: (name: string) => void,
) {
  const vm: ActivityActionViewModel = {
    __brand: 'activityAction',
    id: viewNode.id,
    domainId: viewNode.elementId,
    label: node.name,
    manualWidth: viewNode.width,
    manualHeight: viewNode.height,
    callsOperationName,
    colorOverride: viewNode.color,
    borderWidthOverride: viewNode.borderWidth,
    borderStyleOverride: viewNode.borderStyle,
    fontFamilyOverride: viewNode.fontFamily,
    fontSizeOverride: viewNode.fontSize,
    onRename,
    onOpenProps: () => useUiStore.getState().openActivityActionProps(viewNode.elementId),
  };
  return {
    id: viewNode.id,
    type: 'umlActivityAction',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeControlNode(
  viewNode: ViewNode,
  controlKind: ActivityControlKindVM,
  allViewNodes: ViewNode[],
) {
  const vm: ActivityControlNodeViewModel = {
    __brand: 'activityControlNode',
    id: viewNode.id,
    domainId: viewNode.elementId,
    controlKind,
    colorOverride: viewNode.color,
  };
  return {
    id: viewNode.id,
    type: 'umlActivityControlNode',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeDecisionNode(
  viewNode: ViewNode,
  decisionKind: ActivityDecisionKindVM,
  allViewNodes: ViewNode[],
) {
  const vm: ActivityDecisionViewModel = {
    __brand: 'activityDecision',
    id: viewNode.id,
    domainId: viewNode.elementId,
    decisionKind,
    colorOverride: viewNode.color,
  };
  return {
    id: viewNode.id,
    type: 'umlActivityDecision',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeForkJoinNode(
  viewNode: ViewNode,
  forkJoinKind: ActivityForkJoinKindVM,
  barOrientation: 'HORIZONTAL' | 'VERTICAL',
  allViewNodes: ViewNode[],
) {
  const vm: ActivityForkJoinViewModel = {
    __brand: 'activityForkJoin',
    id: viewNode.id,
    domainId: viewNode.elementId,
    forkJoinKind,
    barOrientation,
    colorOverride: viewNode.color,
  };
  return {
    id: viewNode.id,
    type: 'umlActivityForkJoin',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeObjectNode(
  viewNode: ViewNode,
  node: IRActivityNode,
  allViewNodes: ViewNode[],
  classifierName: string | undefined,
  onRename: (name: string) => void,
) {
  const vm: ActivityObjectNodeViewModel = {
    __brand: 'activityObjectNode',
    id: viewNode.id,
    domainId: viewNode.elementId,
    label: node.name,
    manualWidth: viewNode.width,
    manualHeight: viewNode.height,
    classifierName,
    colorOverride: viewNode.color,
    borderWidthOverride: viewNode.borderWidth,
    borderStyleOverride: viewNode.borderStyle,
    fontFamilyOverride: viewNode.fontFamily,
    fontSizeOverride: viewNode.fontSize,
    onRename,
    onOpenProps: () => useUiStore.getState().openActivityObjectNodeProps(viewNode.elementId),
  };
  return {
    id: viewNode.id,
    type: 'umlActivityObjectNode',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

/**
 * Reorders a lane by swapping `index` with its left/right neighbour (A3,
 * spec §4.2) — never coordinates. `index` lives on the semantic model;
 * lane `x` lives on the ViewNode, derived by `relayoutPartitionViewNodes`.
 * For a project-backed diagram those are two stores, so both mutations run
 * inside one `undoTransaction`: one step to undo, exactly like
 * `usePackageDrop`'s `commitAssignment`.
 */
function reorderActivityPartition(
  ctx: NodeBuilderContext,
  activityId: string,
  elementId: string,
  direction: 'left' | 'right',
): void {
  const { model, isStandalone, activeTabId } = ctx;
  if (!activeTabId) return;

  const siblings: PartitionOrderEntry[] = Object.values(model.activityPartitions ?? {})
    .filter((p) => p.activityId === activityId)
    .map((p) => ({ elementId: p.id, index: p.index }));

  const swap = computePartitionSwap(siblings, elementId, direction);
  if (!swap) return;

  // A snapshot of every lane's post-swap index, so relayout repositions the
  // whole row — not just the two that moved.
  const partitionsById: Record<string, { index: number }> = {};
  for (const p of Object.values(model.activityPartitions ?? {})) {
    if (p.id === swap.a.elementId) partitionsById[p.id] = { index: swap.a.index };
    else if (p.id === swap.b.elementId) partitionsById[p.id] = { index: swap.b.index };
    else partitionsById[p.id] = { index: p.index };
  }

  const label = 'Reorder Lane';

  if (isStandalone) {
    undoTransaction({
      label,
      scope: activeTabId,
      mutations: [{
        store: 'vfs',
        mutate: (draft: any) => {
          const file = draft.project?.nodes[activeTabId];
          if (!file || !isDiagramView(file.content) || !file.localModel) return;
          applyUpdateActivityPartition(file.localModel, swap.a.elementId, { index: swap.a.index });
          applyUpdateActivityPartition(file.localModel, swap.b.elementId, { index: swap.b.index });
          relayoutPartitionViewNodes(file.content.nodes, partitionsById);
        },
      }],
    });
  } else {
    undoTransaction({
      label,
      scope: 'global',
      mutations: [
        {
          store: 'model',
          mutate: (draft: any) => {
            if (!draft.model) return;
            applyUpdateActivityPartition(draft.model, swap.a.elementId, { index: swap.a.index });
            applyUpdateActivityPartition(draft.model, swap.b.elementId, { index: swap.b.index });
          },
        },
        {
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || !isDiagramView(file.content)) return;
            relayoutPartitionViewNodes(file.content.nodes, partitionsById);
          },
        },
      ],
    });
  }
}

/**
 * Deletes a lane. Its nodes are not deleted with it (spec §4, A1 decision
 * log): `applyDeleteActivityPartition` clears their `partitionId` on the
 * model, and the mirrored view-side reparent (`reparentViewNodeCoords` to
 * `null`) converts their coordinates back to absolute so they stay put on
 * screen instead of collapsing to the deleted lane's origin.
 */
function deleteActivityPartition(ctx: NodeBuilderContext, viewNode: ViewNode): void {
  const { isStandalone, activeTabId, model } = ctx;
  if (!activeTabId) return;
  const elementId = viewNode.elementId;

  const remaining: Record<string, { index: number }> = {};
  for (const p of Object.values(model.activityPartitions ?? {})) {
    if (p.id !== elementId) remaining[p.id] = { index: p.index };
  }

  const applyView = (nodes: ViewNode[]) => {
    for (const child of nodes) {
      if (child.parentPackageId === viewNode.id) {
        reparentViewNodeCoords(nodes, child.id, null);
      }
    }
    const idx = nodes.findIndex((n) => n.id === viewNode.id);
    if (idx !== -1) nodes.splice(idx, 1);
    relayoutPartitionViewNodes(nodes, remaining);
  };

  const label = 'Delete Lane';

  if (isStandalone) {
    undoTransaction({
      label,
      scope: activeTabId,
      mutations: [{
        store: 'vfs',
        mutate: (draft: any) => {
          const file = draft.project?.nodes[activeTabId];
          if (!file || !isDiagramView(file.content) || !file.localModel) return;
          applyDeleteActivityPartition(file.localModel, elementId);
          applyView(file.content.nodes);
        },
      }],
    });
  } else {
    undoTransaction({
      label,
      scope: 'global',
      mutations: [
        {
          store: 'model',
          mutate: (draft: any) => {
            if (!draft.model) return;
            applyDeleteActivityPartition(draft.model, elementId);
          },
        },
        {
          store: 'vfs',
          mutate: (draft: any) => {
            const file = draft.project?.nodes[activeTabId];
            if (!file || !isDiagramView(file.content)) return;
            applyView(file.content.nodes);
          },
        },
      ],
    });
  }
}

function makePartitionNode(
  ctx: NodeBuilderContext,
  viewNode: ViewNode,
  partition: IRActivityPartition,
  siblings: IRActivityPartition[],
  allViewNodes: ViewNode[],
) {
  const sorted = [...siblings].sort((a, b) => a.index - b.index);
  const pos = sorted.findIndex((p) => p.id === partition.id);

  const representative = partition.representsId
    ? ctx.model.classes[partition.representsId]?.name ??
      ctx.model.actors?.[partition.representsId]?.name
    : undefined;

  const vm: ActivityPartitionViewModel = {
    __brand: 'activityPartition',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: partition.name,
    index: partition.index,
    width: viewNode.width ?? DEFAULT_PARTITION_WIDTH,
    representsId: partition.representsId,
    representsName: representative,
    onNavigateToRepresents: partition.representsId
      ? () => openDiagramContainingElement(partition.representsId!)
      : undefined,
    canMoveLeft: pos > 0,
    canMoveRight: pos !== -1 && pos < sorted.length - 1,
    onRename: (name) => {
      if (ctx.isStandalone && ctx.activeTabId) {
        standaloneModelOps(ctx.activeTabId).updateActivityPartition(viewNode.elementId, { name });
      } else {
        useModelStore.getState().updateActivityPartition(viewNode.elementId, { name });
      }
    },
    onMoveLeft: () => reorderActivityPartition(ctx, partition.activityId, partition.id, 'left'),
    onMoveRight: () => reorderActivityPartition(ctx, partition.activityId, partition.id, 'right'),
    onDelete: () => deleteActivityPartition(ctx, viewNode),
    onOpenProps: () => useUiStore.getState().openActivityPartitionProps(viewNode.elementId),
  };

  return {
    id: viewNode.id,
    type: 'umlActivityPartition',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

/**
 * Builds the canvas nodes for an activity diagram (A1/A2).
 *
 * A ViewNode whose element is not in the model is **omitted**, not rendered as
 * an "Unknown" note the way the class-diagram builder does. A dangling
 * reference here means the element was deleted while the view kept its node,
 * and drawing a placeholder invites the user to interact with something that
 * no longer exists.
 */
export function buildActivityDiagramNodes(ctx: NodeBuilderContext) {
  const { diagramView, model, isStandalone, activeTabId, handleNoteUpdate } = ctx;

  const built = diagramView.nodes.map((viewNode: ViewNode) => {
    const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

    if (kind === 'NOTE') {
      return makeNoteNode(viewNode, handleNoteUpdate, diagramView.nodes);
    }

    if (kind === 'ACTIVITY_PARTITION' && element) {
      const partition = element as IRActivityPartition;
      const siblings = Object.values(model.activityPartitions ?? {}).filter(
        (p) => p.activityId === partition.activityId,
      );
      return makePartitionNode(ctx, viewNode, partition, siblings, diagramView.nodes);
    }

    if (kind !== 'ACTIVITY_NODE' || !element) return null;

    const node = element as IRActivityNode;

    if (ACTION_TYPES.has(node.activityType)) {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateActivityNode(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateActivityNode(viewNode.elementId, { name });
        }
      };

      const callsOperationLabel = node.callsOperationId
        ? resolveCallsOperationLabel(model, node.callsOperationId)
        : undefined;

      return makeActionNode(viewNode, node, diagramView.nodes, callsOperationLabel, onRename);
    }

    const controlKind = CONTROL_TYPES[node.activityType];
    if (controlKind) {
      return makeControlNode(viewNode, controlKind, diagramView.nodes);
    }

    const decisionKind = DECISION_TYPES[node.activityType];
    if (decisionKind) {
      return makeDecisionNode(viewNode, decisionKind, diagramView.nodes);
    }

    const forkJoinKind = FORK_JOIN_TYPES[node.activityType];
    if (forkJoinKind) {
      return makeForkJoinNode(viewNode, forkJoinKind, node.barOrientation ?? 'HORIZONTAL', diagramView.nodes);
    }

    if (node.activityType === 'OBJECT_NODE') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateActivityNode(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateActivityNode(viewNode.elementId, { name });
        }
      };
      const classifierName = node.classifierId
        ? resolveObjectNodeClassifierLabel(model, node.classifierId)
        : undefined;
      return makeObjectNode(viewNode, node, diagramView.nodes, classifierName, onRename);
    }

    return null;
  });

  return built.filter((n): n is NonNullable<typeof n> => n !== null);
}
