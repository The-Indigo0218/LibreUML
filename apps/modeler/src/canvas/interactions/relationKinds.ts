import type { RelationKind } from '../../core/domain/vfs/vfs.types';

/**
 * Palette connection mode → the `RelationKind` persisted on the IR.
 *
 * This lived in two copies, one in `useConnectionDraw` (which decides whether a
 * drag is legal) and one in `useCanvasEventHandlers` (which creates the
 * relation). Two copies of the same table is one bug away from the draw path
 * and the create path disagreeing about what the user is drawing, so it lives
 * here now and both import it.
 */
export const TOOL_TO_RELATION_KIND: Record<string, RelationKind> = {
  ASSOCIATION:    'ASSOCIATION',
  INHERITANCE:    'GENERALIZATION',
  IMPLEMENTATION: 'REALIZATION',
  DEPENDENCY:     'DEPENDENCY',
  AGGREGATION:    'AGGREGATION',
  COMPOSITION:    'COMPOSITION',
  GENERALIZATION: 'GENERALIZATION',
  INCLUDE:        'INCLUDE',
  EXTEND:         'EXTEND',
  PACKAGE_IMPORT: 'PACKAGE_IMPORT',
  PACKAGE_MERGE:  'PACKAGE_MERGE',
  PACKAGE_ACCESS: 'PACKAGE_ACCESS',
  // Activity diagrams (A1)
  CONTROL_FLOW:   'CONTROL_FLOW',
  OBJECT_FLOW:    'OBJECT_FLOW',
  // Activity diagrams (v1.1)
  EXCEPTION_HANDLER: 'EXCEPTION_HANDLER',
};
