import type { AnyNodeViewModel } from './node.view-model';
import { isNodeViewModel, isNoteViewModel } from './node.view-model';

/**
 * The discriminant every canvas capability dispatches on (ADR-0009).
 *
 * Seventeen of the nineteen `AnyNodeViewModel` members carry a `__brand`; the
 * two oldest — the class node and the note — predate it and are still told
 * apart by shape. `getNodeKind` is the single place that reconciles both, so
 * everything downstream can index a plain table instead of re-running a chain
 * of type guards.
 */
export type NodeKind =
  | 'class'
  | 'note'
  | 'package'
  | 'actor'
  | 'useCase'
  | 'systemBoundary'
  | 'ucModule'
  | 'domainEntity'
  | 'lifeline'
  | 'message'
  | 'activation'
  | 'fragment'
  | 'stateInvariant'
  | 'interactionUse'
  | 'gate'
  | 'generalOrdering'
  | 'timeConstraint'
  | 'coregion'
  | 'continuation'
  | 'activityAction'
  | 'activityControlNode'
  | 'activityDecision'
  | 'activityForkJoin';

/** Every kind, for exhaustiveness checks over descriptor tables. */
export const ALL_NODE_KINDS: readonly NodeKind[] = [
  'class',
  'note',
  'package',
  'actor',
  'useCase',
  'systemBoundary',
  'ucModule',
  'domainEntity',
  'lifeline',
  'message',
  'activation',
  'fragment',
  'stateInvariant',
  'interactionUse',
  'gate',
  'generalOrdering',
  'timeConstraint',
  'coregion',
  'continuation',
  'activityAction',
  'activityControlNode',
  'activityDecision',
  'activityForkJoin',
] as const;

/**
 * Resolves a view model to its kind.
 *
 * Branded view models answer directly. The class node and the note have no
 * brand, so they fall back to the structural guards they have always used:
 * `sections` for the class, `content` without `sections` for the note.
 *
 * Returns `null` for anything else. Callers decide what an unknown kind means
 * — historically `getShapeSize` and `renderShape` silently treated it as a
 * class, which hid bugs rather than surfacing them.
 */
export function getNodeKind(vm: AnyNodeViewModel): NodeKind | null {
  const branded = (vm as { __brand?: string }).__brand;
  if (branded) return branded as NodeKind;
  if (isNodeViewModel(vm)) return 'class';
  if (isNoteViewModel(vm)) return 'note';
  return null;
}
