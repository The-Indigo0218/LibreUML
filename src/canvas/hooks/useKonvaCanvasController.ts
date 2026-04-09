/**
 * useKonvaCanvasController — Konva-native canvas state hook.
 *
 * Wraps useVFSCanvasController and adapts its RF-typed output into
 * Konva-native types (ShapeDescriptor, EdgeDescriptor). No ReactFlow
 * types escape this module.
 *
 * Returns:
 *   shapes       — flat node descriptors for the Konva canvas
 *   edges        — flat edge descriptors for KonvaEdge routing
 *   activeTabId  — current tab (pass to useConnectionDraw)
 *   onNodeChange — persists position/remove changes to VFSStore
 *   onEdgeChange — persists edge removal to VFSStore
 *   onConnect    — creates a new relation + ViewEdge in VFSStore
 */

import { useMemo } from 'react';
import { useVFSCanvasController } from '../../features/diagram/hooks/useVFSCanvasController';
import { isNoteViewModel, isPackageViewModel } from '../../adapters/react-flow/view-models/node.view-model';
import type {
  ShapeDescriptor,
  EdgeDescriptor,
  KonvaNodeChange,
  KonvaEdgeChange,
  KonvaConnection,
} from '../types/canvas.types';

// ─── Public API ────────────────────────────────────────────────────────────────

export interface KonvaCanvasControllerResult {
  /** Flat node descriptors — one per ViewNode in the active DiagramView. */
  shapes: ShapeDescriptor[];
  /** Flat edge descriptors — one per ViewEdge with a resolvable IRRelation. */
  edges: EdgeDescriptor[];
  /** Active tab ID from WorkspaceStore (pass through to useConnectionDraw). */
  activeTabId: string | null;
  /** Persists position + remove changes to VFSStore. */
  onNodeChange: (changes: KonvaNodeChange[]) => void;
  /** Persists edge removal to VFSStore (cascades to ModelStore). */
  onEdgeChange: (changes: KonvaEdgeChange[]) => void;
  /** Creates IRRelation + ViewEdge in VFSStore. */
  onConnect: (connection: KonvaConnection) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useKonvaCanvasController(): KonvaCanvasControllerResult {
  const {
    nodes,
    edges,
    activeTabId,
    diagramView,
    onKonvaNodesChange,
    onKonvaEdgesChange,
    onConnect,
  } = useVFSCanvasController();

  const shapes = useMemo((): ShapeDescriptor[] => {
    const viewNodeMap = new Map(diagramView?.nodes.map(vn => [vn.id, vn]) ?? []);
    
    return nodes.map((n) => {
      const viewNode = viewNodeMap.get(n.id);
      const parentPackageId = viewNode?.parentPackageId ?? null;
      
      if (isPackageViewModel(n.data)) {
        return {
          id: n.id,
          type: 'package' as const,
          x: n.position.x,
          y: n.position.y,
          data: n.data,
          parentPackageId,
          width: viewNode?.width,
          height: viewNode?.height,
        };
      }
      
      return {
        id: n.id,
        type: isNoteViewModel(n.data) ? 'note' as const : 'class' as const,
        x: n.position.x,
        y: n.position.y,
        data: n.data,
        parentPackageId,
      };
    });
  }, [nodes, diagramView]);

  const konvaEdges = useMemo((): EdgeDescriptor[] =>
    edges.map((e) => ({
      id: e.id,
      sourceId: e.source,
      targetId: e.target,
      kind: e.data.kind,
      sourceMultiplicity: e.data.sourceMultiplicity,
      targetMultiplicity: e.data.targetMultiplicity,
      sourceRole: e.data.sourceRole,
      targetRole: e.data.targetRole,
    })),
    [edges],
  );

  return {
    shapes,
    edges: konvaEdges,
    activeTabId,
    onNodeChange: onKonvaNodesChange,
    onEdgeChange: onKonvaEdgesChange,
    onConnect,
  };
}
