/**
 * EdgeTooltip — HTML tooltip for edge hover (MAG-01.12)
 *
 * Shows the RelationKind label when hovering over an edge.
 * Positioned at the edge midpoint in screen coordinates.
 *
 * Architecture:
 * - Lives in CanvasOverlay (HTML Layer 0)
 * - pointer-events: auto (captures hover, but doesn't block clicks)
 * - Delay: 500ms before showing (prevents flicker on quick mouse moves)
 * - Fades in/out via CSS transitions
 *
 * Integration:
 * - EdgeShape onMouseEnter → store edge ID + midpoint position
 * - EdgeShape onMouseLeave → clear tooltip
 * - Tooltip reads from Zustand store (or local state in CanvasOverlay)
 */

import { useEffect, useState } from 'react';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';

interface EdgeTooltipProps {
  /** Edge kind to display */
  kind: RelationKind;
  /** Screen-space X coordinate */
  x: number;
  /** Screen-space Y coordinate */
  y: number;
  /** Whether tooltip is visible (after delay) */
  visible: boolean;
}

const RELATION_LABELS: Record<RelationKind, string> = {
  ASSOCIATION: 'Association',
  GENERALIZATION: 'Generalization',
  REALIZATION: 'Realization',
  DEPENDENCY: 'Dependency',
  AGGREGATION: 'Aggregation',
  COMPOSITION: 'Composition',
  USAGE: 'Usage',
  INCLUDE: 'Include',
  EXTEND: 'Extend',
  TRANSITION: 'Transition',
  CONTROL_FLOW: 'Control Flow',
  OBJECT_FLOW: 'Object Flow',
  DEPLOYMENT: 'Deployment',
  MANIFESTATION: 'Manifestation',
  PACKAGE_IMPORT: 'Package Import',
  PACKAGE_MERGE: 'Package Merge',
  PACKAGE_ACCESS: 'Package Access',
};

export default function EdgeTooltip({ kind, x, y, visible }: EdgeTooltipProps) {
  const [show, setShow] = useState(false);

  // Delay showing tooltip by 500ms to prevent flicker
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div
      className="absolute z-20 pointer-events-none px-2 py-1 bg-surface-secondary border border-surface-border rounded shadow-lg text-xs text-text-primary animate-in fade-in duration-200"
      style={{
        left: x,
        top: y - 30, // Position above the edge
        transform: 'translateX(-50%)', // Center horizontally
      }}
    >
      {RELATION_LABELS[kind]}
    </div>
  );
}
