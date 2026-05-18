import type {
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
  IRPackage,
  IRActor,
  IRUseCase,
  IRSystemBoundary,
  IRUCModule,
  IRDomainEntity,
  ViewNode,
  DiagramView,
} from '../../../../core/domain/vfs/vfs.types';
import type { NoteViewModel } from '../../../../adapters/react-flow/view-models/node.view-model';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type SemanticKind =
  | 'CLASS'
  | 'ABSTRACT_CLASS'
  | 'INTERFACE'
  | 'ENUM'
  | 'PACKAGE'
  | 'NOTE'
  | 'ACTOR'
  | 'USECASE'
  | 'SYSTEM_BOUNDARY'
  | 'UC_MODULE'
  | 'DOMAIN_ENTITY'
  | 'UNKNOWN';

export interface ResolvedElement {
  element:
    | IRClass
    | IRInterface
    | IREnum
    | IRPackage
    | IRActor
    | IRUseCase
    | IRSystemBoundary
    | IRUCModule
    | IRDomainEntity
    | null;
  kind: SemanticKind;
}

export interface NodeBuilderContext {
  diagramView: DiagramView;
  model: SemanticModel;
  isStandalone: boolean;
  activeTabId: string | null;
  handleNoteUpdate: (viewNodeId: string, update: { content?: string; title?: string }) => void;
}

// ─── Semantic resolution ──────────────────────────────────────────────────────

export function resolveSemanticElement(model: SemanticModel, elementId: string): ResolvedElement {
  if (!elementId) return { element: null, kind: 'NOTE' };

  const cls = model.classes[elementId];
  if (cls) return { element: cls, kind: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS' };

  const iface = model.interfaces[elementId];
  if (iface) return { element: iface, kind: 'INTERFACE' };

  const enm = model.enums[elementId];
  if (enm) return { element: enm, kind: 'ENUM' };

  const pkg = model.packages[elementId];
  if (pkg) return { element: pkg, kind: 'PACKAGE' };

  const actor = model.actors?.[elementId];
  if (actor) return { element: actor, kind: 'ACTOR' };

  const uc = model.useCases?.[elementId];
  if (uc) return { element: uc, kind: 'USECASE' };

  const sb = model.systemBoundaries?.[elementId];
  if (sb) return { element: sb, kind: 'SYSTEM_BOUNDARY' };

  const ucm = model.ucModules?.[elementId];
  if (ucm) return { element: ucm, kind: 'UC_MODULE' };

  const de = model.domainEntities?.[elementId];
  if (de) return { element: de, kind: 'DOMAIN_ENTITY' };

  return { element: null, kind: 'UNKNOWN' };
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

export function getAbsolutePosition(
  viewNode: ViewNode,
  allViewNodes: ViewNode[],
): { x: number; y: number } {
  if (!viewNode.parentPackageId) return { x: viewNode.x, y: viewNode.y };
  const parentNode = allViewNodes.find((n) => n.id === viewNode.parentPackageId);
  if (!parentNode) return { x: viewNode.x, y: viewNode.y };
  const parentPos = getAbsolutePosition(parentNode, allViewNodes);
  return { x: parentPos.x + viewNode.x, y: parentPos.y + viewNode.y };
}

export function makeReactFlowNoteNode(
  viewNode: ViewNode,
  onSave: (viewNodeId: string, update: { content?: string; title?: string }) => void,
  allViewNodes: ViewNode[],
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
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: viewModel,
  };
}
