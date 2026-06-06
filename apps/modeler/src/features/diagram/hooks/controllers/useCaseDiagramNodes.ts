import { standaloneModelOps } from '../../../../store/standaloneModelOps';
import { useModelStore } from '../../../../store/model.store';
import { useUiStore } from '../../../../store/uiStore';
import type {
  IRActor,
  IRUseCase,
  IRSystemBoundary,
  IRUCModule,
  ViewNode,
} from '../../../../core/domain/vfs/vfs.types';
import type {
  ActorViewModel,
  UseCaseViewModel,
  SystemBoundaryViewModel,
  UCModuleViewModel,
} from '../../../../adapters/view-models/node.view-model';
import { SB_DEFAULT_W, SB_DEFAULT_H } from '../../../../canvas/shapes/SystemBoundaryShape';
import { UCM_DEFAULT_W, UCM_DEFAULT_H } from '../../../../canvas/shapes/UCModuleShape';
import {
  resolveSemanticElement,
  getAbsolutePosition,
  makeNoteNode,
  type NodeBuilderContext,
} from './sharedNodeBuilders';

// ─── Node builders ────────────────────────────────────────────────────────────

function makeActorNode(
  viewNode: ViewNode,
  actor: IRActor,
  allViewNodes: ViewNode[],
  onRename: (name: string) => void,
  onOpenProps: () => void,
) {
  const vm: ActorViewModel = {
    __brand: 'actor',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: actor.name,
    isAbstract: actor.isAbstract ?? false,
    actorType: actor.actorType,
    colorOverride: viewNode.color,
    onRename,
    onOpenProps,
  };
  return {
    id: viewNode.id,
    type: 'umlActor',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeUseCaseNode(
  viewNode: ViewNode,
  uc: IRUseCase,
  allViewNodes: ViewNode[],
  onRename: (name: string) => void,
  onOpenSpec: () => void,
) {
  const hasSpec = !!(
    uc.briefDescription ||
    uc.preconditions ||
    uc.postconditions ||
    uc.basicFlow?.length ||
    uc.alternativeFlows?.length
  );
  const vm: UseCaseViewModel = {
    __brand: 'useCase',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: uc.name,
    extensionPoints: uc.extensionPoints ?? [],
    hasSpec,
    colorOverride: viewNode.color,
    onRename,
    onOpenSpec,
  };
  return {
    id: viewNode.id,
    type: 'umlUseCase',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeSystemBoundaryNode(
  viewNode: ViewNode,
  sb: IRSystemBoundary,
  allViewNodes: ViewNode[],
  onRename: (name: string) => void,
) {
  const vm: SystemBoundaryViewModel = {
    __brand: 'systemBoundary',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: sb.name,
    width: viewNode.width ?? SB_DEFAULT_W,
    height: viewNode.height ?? SB_DEFAULT_H,
    onRename,
  };
  return {
    id: viewNode.id,
    type: 'umlSystemBoundary',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

function makeUCModuleNode(
  viewNode: ViewNode,
  ucm: IRUCModule,
  allViewNodes: ViewNode[],
  onRename: (name: string) => void,
) {
  const vm: UCModuleViewModel = {
    __brand: 'ucModule',
    id: viewNode.id,
    domainId: viewNode.elementId,
    name: ucm.name,
    width: viewNode.width ?? UCM_DEFAULT_W,
    height: viewNode.height ?? UCM_DEFAULT_H,
    onRename,
  };
  return {
    id: viewNode.id,
    type: 'umlUCModule',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: vm,
    domainId: viewNode.elementId,
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildUseCaseDiagramNodes(ctx: NodeBuilderContext) {
  const { diagramView, model, isStandalone, activeTabId, handleNoteUpdate } = ctx;

  return diagramView.nodes.map((viewNode: ViewNode) => {
    const { element, kind } = resolveSemanticElement(model, viewNode.elementId);

    if (kind === 'NOTE') {
      return makeNoteNode(viewNode, handleNoteUpdate, diagramView.nodes);
    }

    if (kind === 'ACTOR') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateActor(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateActor(viewNode.elementId, { name });
        }
      };
      const onOpenProps = () => useUiStore.getState().openActorProps(viewNode.elementId);
      return makeActorNode(viewNode, element as IRActor, diagramView.nodes, onRename, onOpenProps);
    }

    if (kind === 'USECASE') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateUseCase(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateUseCase(viewNode.elementId, { name });
        }
      };
      const onOpenSpec = () => useUiStore.getState().openUseCaseSpec(viewNode.elementId);
      return makeUseCaseNode(viewNode, element as IRUseCase, diagramView.nodes, onRename, onOpenSpec);
    }

    if (kind === 'SYSTEM_BOUNDARY') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateSystemBoundary(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateSystemBoundary(viewNode.elementId, { name });
        }
      };
      return makeSystemBoundaryNode(viewNode, element as IRSystemBoundary, diagramView.nodes, onRename);
    }

    if (kind === 'UC_MODULE') {
      const onRename = (name: string) => {
        if (isStandalone && activeTabId) {
          standaloneModelOps(activeTabId).updateUCModule(viewNode.elementId, { name });
        } else {
          useModelStore.getState().updateUCModule(viewNode.elementId, { name });
        }
      };
      return makeUCModuleNode(viewNode, element as IRUCModule, diagramView.nodes, onRename);
    }

    // Unknown element — render note as fallback
    return makeNoteNode(
      { ...viewNode, content: `Unknown: ${viewNode.elementId}` },
      handleNoteUpdate,
      diagramView.nodes,
    );
  });
}
