/**
 * canvas.types.ts — Konva-native types for the canvas layer.
 *
 * These types are intentionally free of ReactFlow dependencies.
 * They are used by useKonvaCanvasController, useDragHandler, and KonvaCanvas.
 */

import type { AnyNodeViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import type { RelationKind } from '../../core/domain/vfs/vfs.types';

// ─── Shape / Edge descriptors ─────────────────────────────────────────────────

/** Flat Konva-native node descriptor — replaces VFSReactFlowNode for the Konva canvas. */
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

/** Flat Konva-native edge descriptor — replaces VFSReactFlowEdge for the Konva canvas. */
export interface EdgeDescriptor {
  id: string;
  sourceId: string;
  targetId: string;
  kind: RelationKind;
  // Label data (MAG-01.28)
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
}

// ─── Change types ─────────────────────────────────────────────────────────────

/** Konva-native equivalent of ReactFlow's NodeChange (position + remove only). */
export type KonvaNodeChange =
  | { type: 'position'; id: string; position: { x: number; y: number } }
  | { type: 'remove'; id: string };

/** Konva-native equivalent of ReactFlow's EdgeChange (remove only). */
export type KonvaEdgeChange = { type: 'remove'; id: string };

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Plain connection descriptor — structurally identical to ReactFlow's Connection.
 * Defined here so the canvas layer has no RF dependency.
 */
export interface KonvaConnection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
}
