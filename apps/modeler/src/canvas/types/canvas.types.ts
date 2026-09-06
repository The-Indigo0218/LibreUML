/**
 * canvas.types.ts — Konva-native types for the canvas layer.
 *
 * Used by useKonvaCanvasController, useDragHandler, and KonvaCanvas.
 */

import type { AnyNodeViewModel } from '../../adapters/view-models/node.view-model';
import type { RelationKind, EdgeRoutingMode, NodeBorderStyle } from '../../core/domain/vfs/vfs.types';

// ─── Shape / Edge descriptors ─────────────────────────────────────────────────

/** Flat node descriptor consumed by the Konva renderer. */
export interface ShapeDescriptor {
  id: string;
  type: 'class' | 'note' | 'package';
  x: number;
  y: number;
  data: AnyNodeViewModel;
  parentPackageId?: string | null;
  /** Stored user-defined dimensions (packages only). Used for hybrid manual+minimum sizing. */
  width?: number;
  height?: number;
}

/** Flat edge descriptor consumed by the Konva renderer. */
export interface EdgeDescriptor {
  id: string;
  sourceId: string;
  targetId: string;
  kind: RelationKind;
  // Label data (MAG-01.28)
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
  // UML navigability per end (IRAssociationEnd.isNavigable):
  //   true → open arrow · false → ✕ · undefined → nothing.
  sourceNavigable?: boolean;
  targetNavigable?: boolean;
  // Locked anchor points
  anchorLocked?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  // P4 — free continuous border anchors (nx, ny ∈ [0,1] relative to bounds).
  sourceAnchor?: { nx: number; ny: number };
  targetAnchor?: { nx: number; ny: number };
  // «extend» specific
  condition?: string;
  extensionPoint?: string;
  // CONTROL_FLOW/OBJECT_FLOW specific (A2)
  guard?: string;
  weight?: string;
  /** Manual user waypoints — when present, the edge routes through them. */
  waypoints?: { x: number; y: number }[];
  /** Line routing style. Undefined = 'straight' (free-form). */
  routingMode?: EdgeRoutingMode;
  /** Per-edge style overrides: color / line width / line style. */
  color?: string;
  lineWidth?: number;
  lineStyle?: NodeBorderStyle;
  /** Per-edge label font overrides. */
  fontFamily?: string;
  fontSize?: number;
}

// ─── Change types ─────────────────────────────────────────────────────────────

/** Node change emitted by the Konva canvas (position move or removal). */
export type KonvaNodeChange =
  | { type: 'position'; id: string; position: { x: number; y: number } }
  | { type: 'remove'; id: string };

/** Edge change emitted by the Konva canvas (removal only — no reroute). */
export type KonvaEdgeChange = { type: 'remove'; id: string };

// ─── Connection ───────────────────────────────────────────────────────────────

/** Plain connection descriptor produced when the user finishes drawing an edge. */
export interface KonvaConnection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
  /**
   * True when the user dropped precisely on one of the 8 connection points →
   * the new edge locks to sourceHandle/targetHandle. Absent/false → floating
   * connection (endpoints slide along the border, the draw.io default).
   */
  anchorLocked?: boolean;
  /**
   * P4 — free continuous border anchors (nx, ny ∈ [0,1]) captured at draw time.
   * When present they supersede the handle/lock fields on the new edge.
   */
  sourceAnchor?: { nx: number; ny: number };
  targetAnchor?: { nx: number; ny: number };
  /**
   * World-space Y of the release point. Sequence diagrams use it to insert the
   * new message at the slot under the cursor instead of always appending (P1).
   */
  dropY?: number;
}
