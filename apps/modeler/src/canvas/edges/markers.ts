/**
 * markers.ts — pure marker-resolution logic shared by the Konva renderer
 * (EdgeMarker.tsx) and the SVG exporter (diagramToSvg.ts).
 *
 * A relation draws up to two endpoint markers, one per end. Which glyph an end
 * shows depends on the relation kind AND — for association-family kinds — the
 * per-end navigability stored on IRAssociationEnd.isNavigable.
 *
 * UML convention (matches EA / StarUML):
 *   - A plain association has NO arrowheads. Navigability is opt-in:
 *       isNavigable === true      → open arrow at that end (navigable)
 *       isNavigable === false     → small ✕ at that end (explicitly not navigable)
 *       isNavigable === undefined → nothing (navigability unspecified)
 *   - Generalization / realization → hollow triangle at the target (no navigability).
 *   - Aggregation / composition    → hollow / filled diamond at the target (the
 *     "whole" end); the other (part) end can still carry a navigability arrow.
 *   - Dependency / usage / include / extend / package-* / activity flows are
 *     inherently directional → open arrow at the target, unaffected by navigability.
 */

import type { RelationKind } from '../../core/domain/vfs/vfs.types';

export type MarkerShape =
  | 'arrow'          // open chevron
  | 'triangle'       // hollow triangle (generalization / realization)
  | 'diamondHollow'  // aggregation
  | 'diamondFilled'  // composition
  | 'cross';         // ✕ — explicitly non-navigable end

export type RelationEnd = 'source' | 'target';

/** Kinds whose target carries a hollow triangle. */
const TRIANGLE_KINDS = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);

/** Inherently directional kinds — always an open arrow at the target. */
const DIRECTIONAL_ARROW_KINDS = new Set<RelationKind>([
  'DEPENDENCY', 'USAGE', 'INCLUDE', 'EXTEND',
  'PACKAGE_IMPORT', 'PACKAGE_MERGE', 'PACKAGE_ACCESS',
  'TRANSITION', 'CONTROL_FLOW', 'OBJECT_FLOW', 'EXCEPTION_HANDLER', 'DEPLOYMENT', 'MANIFESTATION',
]);

/** Kinds whose ends carry navigability (arrow / ✕ / nothing) instead of a fixed glyph. */
export const ASSOCIATION_FAMILY = new Set<RelationKind>([
  'ASSOCIATION', 'AGGREGATION', 'COMPOSITION',
]);

/** True when either end of this kind can show a navigability control in the UI. */
export function isNavigableKind(kind: RelationKind): boolean {
  return ASSOCIATION_FAMILY.has(kind);
}

/**
 * The fixed (navigability-independent) marker an end shows, or null when the end
 * is free to reflect navigability. Only the target end ever has a fixed marker.
 */
function fixedMarker(kind: RelationKind, end: RelationEnd): MarkerShape | null {
  if (end !== 'target') return null;
  if (TRIANGLE_KINDS.has(kind)) return 'triangle';
  if (kind === 'AGGREGATION') return 'diamondHollow';
  if (kind === 'COMPOSITION') return 'diamondFilled';
  if (DIRECTIONAL_ARROW_KINDS.has(kind)) return 'arrow';
  return null; // ASSOCIATION target → navigability decides
}

/**
 * Resolves the marker glyph for one end of a relation, or null for no marker.
 *
 * A fixed semantic marker (triangle / diamond / directional arrow) always wins.
 * Otherwise, for association-family kinds, per-end navigability decides:
 *   true → arrow, false → cross, undefined → nothing.
 */
export function resolveEndMarker(
  kind: RelationKind,
  end: RelationEnd,
  navigable: boolean | undefined,
): MarkerShape | null {
  const fixed = fixedMarker(kind, end);
  if (fixed) return fixed;
  if (ASSOCIATION_FAMILY.has(kind)) {
    if (navigable === true) return 'arrow';
    if (navigable === false) return 'cross';
  }
  return null;
}

/**
 * Depth (px) the line body must retract at the target so a solid glyph sits
 * flush against the node border. Arrows / crosses overlay the line (retract 0).
 */
export function markerRetract(kind: RelationKind): number {
  if (TRIANGLE_KINDS.has(kind)) return 16;
  if (kind === 'AGGREGATION' || kind === 'COMPOSITION') return 24;
  return 0;
}
