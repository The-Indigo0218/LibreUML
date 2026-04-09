/**
 * useKonvaAutoLayout — dagre-based auto-layout for Konva canvas (MAG-01.13)
 *
 * Replaces useAutoLayout (ReactFlow) with a Konva-native version.
 * Reads node/edge data from VFSStore, runs dagre layout, writes back
 * updated positions via updateFileContent, then calls fitView.
 */

import dagre from 'dagre';
import { useCallback } from 'react';
import { useVFSStore } from '../../store/project-vfs.store';
import { useModelStore } from '../../store/model.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useUiStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toast.store';
import { useViewportControlStore } from '../store/viewportControlStore';
import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';
import { withUndo } from '../../core/undo/undoBridge';
import type { VFSFile, RelationKind } from '../../core/domain/vfs/vfs.types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 120;
const NODE_SEP = 80;
const RANK_SEP = 150;
const MARGIN = 40;

const REVERSED_KINDS = new Set<RelationKind>(['GENERALIZATION', 'REALIZATION']);

export const LOCKED_WARNING_KEY = 'libreuml.autoLayout.skipLockedWarning';

export function useKonvaAutoLayout() {
  const fitView = useViewportControlStore((s) => s.fitView);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openAutoLayoutLockedWarning = useUiStore((s) => s.openAutoLayoutLockedWarning);

  const executeLayout = useCallback(() => {
    const project = useVFSStore.getState().project;
    if (!activeTabId || !project) return;

    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return;

    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) return;

    const view = content;
    const model = useModelStore.getState().model;
    if (!model) return;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB',
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
      marginx: MARGIN,
      marginy: MARGIN,
    });

    for (const vn of view.nodes) {
      g.setNode(vn.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    const elementToViewNode = new Map<string, string>();
    for (const vn of view.nodes) {
      if (vn.elementId) elementToViewNode.set(vn.elementId, vn.id);
    }

    for (const ve of view.edges) {
      if (ve.anchorLocked) continue;
      const rel = model.relations[ve.relationId];
      if (!rel) continue;
      const srcVN = elementToViewNode.get(rel.sourceId);
      const tgtVN = elementToViewNode.get(rel.targetId);
      if (!srcVN || !tgtVN || srcVN === tgtVN) continue;

      if (REVERSED_KINDS.has(rel.kind)) {
        g.setEdge(tgtVN, srcVN);
      } else {
        g.setEdge(srcVN, tgtVN);
      }
    }

    dagre.layout(g);

    const updatedNodes = view.nodes.map((vn) => {
      if (!g.hasNode(vn.id)) return vn;
      const dn = g.node(vn.id);
      return {
        ...vn,
        x: dn.x - NODE_WIDTH / 2,
        y: dn.y - NODE_HEIGHT / 2,
      };
    });

    withUndo('vfs', 'Auto-layout', activeTabId, (draft: any) => {
      const node = draft.project?.nodes[activeTabId];
      if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
      node.content.nodes = updatedNodes;
    });

    requestAnimationFrame(() => {
      fitView();
    });
  }, [activeTabId, fitView]);

  const runLayout = useCallback(() => {
    const project = useVFSStore.getState().project;
    if (!activeTabId || !project) return;

    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== 'FILE') return;

    const content = (fileNode as VFSFile).content;
    if (!isDiagramView(content)) return;

    const hasLockedEdges = content.edges.some((e) => e.anchorLocked);

    if (hasLockedEdges) {
      const skipWarning = localStorage.getItem(LOCKED_WARNING_KEY) === 'true';
      if (skipWarning) {
        executeLayout();
        useToastStore.getState().show('Auto Layout applied (Locked edges were ignored)');
      } else {
        openAutoLayoutLockedWarning();
      }
    } else {
      executeLayout();
    }
  }, [activeTabId, executeLayout, openAutoLayoutLockedWarning]);

  return { runLayout, executeLayout };
}
