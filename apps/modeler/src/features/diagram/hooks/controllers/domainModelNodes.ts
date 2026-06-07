import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import { useUiStore } from '../../../../store/uiStore';
import type { IRDomainEntity, ViewNode } from '../../../../core/domain/vfs/vfs.types';
import type { DomainEntityViewModel } from '../../../../adapters/view-models/node.view-model';
import {
  resolveSemanticElement,
  getAbsolutePosition,
  makeNoteNode,
  type NodeBuilderContext,
} from './sharedNodeBuilders';

// ─── Node builder ─────────────────────────────────────────────────────────────

function makeDomainEntityNode(
  viewNode: ViewNode,
  entity: IRDomainEntity,
  model: { domainAttributes?: Record<string, { id: string; name: string }> },
  allViewNodes: ViewNode[],
  onRename: (name: string) => void,
  onOpenProps: () => void,
) {
  const attributes = entity.attributeIds
    .map((id) => model.domainAttributes?.[id])
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ id: a.id, name: a.name }));

  const vm: DomainEntityViewModel = {
    __brand: 'domainEntity',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: entity.name,
    attributes,
    colorOverride: viewNode.color,
    borderWidthOverride: viewNode.borderWidth,
    borderStyleOverride: viewNode.borderStyle,
    onRename,
    onOpenProps,
  };
  return {
    id: viewNode.id,
    type: 'umlDomainEntity',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildDomainModelNodes(ctx: NodeBuilderContext) {
  const { diagramView, model, isStandalone, activeTabId, handleNoteUpdate } = ctx;

  return diagramView.nodes.map((viewNode: ViewNode) => {
    const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

    if (kind === 'NOTE') {
      return makeNoteNode(viewNode, handleNoteUpdate, diagramView.nodes);
    }

    if (kind === 'DOMAIN_ENTITY') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateDomainEntity(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateDomainEntity(viewNode.elementId, { name });
        }
      };
      const onOpenProps = () => useUiStore.getState().openDomainEntityProps(viewNode.elementId);
      return makeDomainEntityNode(
        viewNode,
        element as IRDomainEntity,
        model,
        diagramView.nodes,
        onRename,
        onOpenProps,
      );
    }

    return makeNoteNode(
      { ...viewNode, content: `Unknown: ${viewNode.elementId}` },
      handleNoteUpdate,
      diagramView.nodes,
    );
  });
}
