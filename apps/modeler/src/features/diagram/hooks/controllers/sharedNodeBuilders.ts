import type {
  SemanticModel,
  ViewNode,
  DiagramView,
} from '../../../../core/domain/vfs/vfs.types';
import type { NoteViewModel } from '../../../../adapters/view-models/node.view-model';
import { diagramRegistry } from '../../../../core/registry/diagram-registry';

// ─── Shared types ─────────────────────────────────────────────────────────────

// SemanticKind and ResolvedElement live in vfs.types.ts (canonical location).
// Re-exported here so existing importers don't break.
export type { SemanticKind, ResolvedElement } from '../../../../core/domain/vfs/vfs.types';
import type { ResolvedElement } from '../../../../core/domain/vfs/vfs.types';

export interface NodeBuilderContext {
  diagramView: DiagramView;
  model: SemanticModel;
  isStandalone: boolean;
  activeTabId: string | null;
  handleNoteUpdate: (viewNodeId: string, update: { content?: string; title?: string }) => void;
}

// ─── Semantic resolution ──────────────────────────────────────────────────────

/**
 * Resolves an elementId to its IR element and kind by iterating the registered
 * diagram-type lookup functions. Adding a new diagram type only requires
 * adding its semanticLookup to the registry — this function never changes.
 */
export function resolveSemanticElement(model: SemanticModel, elementId: string): ResolvedElement {
  if (!elementId) return { element: null, kind: 'NOTE' };

  for (const entry of Object.values(diagramRegistry)) {
    const result = entry.semanticLookup(model, elementId);
    if (result) return result;
  }

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

export function makeNoteNode(
  viewNode: ViewNode,
  onSave: (viewNodeId: string, update: { content?: string; title?: string }) => void,
  allViewNodes: ViewNode[],
) {
  const viewModel: NoteViewModel = {
    id: viewNode.id,
    domainId: viewNode.id,
    title: viewNode.noteTitle ?? 'Note',
    content: viewNode.content ?? '',
    colorOverride: viewNode.color,
    borderWidthOverride: viewNode.borderWidth,
    borderStyleOverride: viewNode.borderStyle,
    onSave: (update) => onSave(viewNode.id, update),
  };
  return {
    id: viewNode.id,
    type: 'umlNote',
    position: getAbsolutePosition(viewNode, allViewNodes),
    data: viewModel,
  };
}
