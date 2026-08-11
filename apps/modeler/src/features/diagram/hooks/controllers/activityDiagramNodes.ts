import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import type { IRActivityNode, ViewNode } from '../../../../core/domain/vfs/vfs.types';
import type {
  ActivityActionViewModel,
  ActivityControlNodeViewModel,
  ActivityControlKindVM,
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

/**
 * Builds the canvas nodes for an activity diagram (A1).
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

      const operation = node.callsOperationId
        ? model.operations?.[node.callsOperationId]
        : undefined;

      return makeActionNode(viewNode, node, diagramView.nodes, operation?.name, onRename);
    }

    const controlKind = CONTROL_TYPES[node.activityType];
    if (controlKind) {
      return makeControlNode(viewNode, controlKind, diagramView.nodes);
    }

    // Decision/merge/fork/join land in A2; until their shapes exist, drawing
    // them as something else would misrepresent the model.
    return null;
  });

  return built.filter((n): n is NonNullable<typeof n> => n !== null);
}
