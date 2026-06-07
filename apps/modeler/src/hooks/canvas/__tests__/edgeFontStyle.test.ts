/**
 * useEdgeActions.updateEdgeStyle — per-edge label font override (fontFamily /
 * fontSize). Mirrors the color/line-style coverage but for the font keys added
 * for "edge label fonts". Patch sets present keys, omits absent ones, and a
 * null value clears the override; each call is a single undo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEdgeActions } from '../useEdgeActions';
import { useVFSStore } from '../../../store/project-vfs.store';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject, ViewEdge } from '../../../core/domain/vfs/vfs.types';

const FILE_ID = 'file-1';
const EDGE_ID = 'edge-1';
const REL_ID = 'rel-1';

function projectWithEdge(edge: Partial<ViewEdge> = {}): LibreUMLProject {
  const now = Date.now();
  return {
    id: 'proj-1',
    projectName: 'Test',
    version: '1.0.0',
    domainModelId: 'dm-1',
    nodes: {
      [FILE_ID]: {
        id: FILE_ID,
        name: 'Diagram.luml',
        type: 'FILE',
        parentId: null,
        diagramType: 'CLASS_DIAGRAM',
        extension: '.luml',
        isExternal: false,
        standalone: true,
        content: {
          diagramId: FILE_ID,
          nodes: [],
          edges: [{ id: EDGE_ID, relationId: REL_ID, waypoints: [], ...edge }],
        },
        createdAt: now,
        updatedAt: now,
      } as any,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function currentEdge(): ViewEdge {
  const file = useVFSStore.getState().project!.nodes[FILE_ID] as any;
  return file.content.edges.find((e: ViewEdge) => e.id === EDGE_ID);
}

function renderActions() {
  return renderHook(() =>
    useEdgeActions({ activeTabId: FILE_ID, isStandalone: true, updateFileContent: () => {} }),
  ).result.current;
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(projectWithEdge());
});

describe('updateEdgeStyle — label font override', () => {
  it('sets fontFamily and fontSize', () => {
    renderActions().updateEdgeStyle(EDGE_ID, { fontFamily: 'Georgia, serif', fontSize: 16 });
    const e = currentEdge();
    expect(e.fontFamily).toBe('Georgia, serif');
    expect(e.fontSize).toBe(16);
  });

  it('only touches keys present in the patch', () => {
    renderActions().updateEdgeStyle(EDGE_ID, { fontFamily: 'Mono', fontSize: 18 });
    renderActions().updateEdgeStyle(EDGE_ID, { fontSize: 14 });
    const e = currentEdge();
    expect(e.fontFamily).toBe('Mono'); // untouched
    expect(e.fontSize).toBe(14);
  });

  it('clears an override when the value is null', () => {
    renderActions().updateEdgeStyle(EDGE_ID, { fontFamily: 'Mono', fontSize: 18 });
    renderActions().updateEdgeStyle(EDGE_ID, { fontFamily: null, fontSize: null });
    const e = currentEdge();
    expect(e.fontFamily).toBeUndefined();
    expect(e.fontSize).toBeUndefined();
  });

  it('does not disturb line-style keys', () => {
    renderActions().updateEdgeStyle(EDGE_ID, { color: '#ff0000', lineWidth: 3 });
    renderActions().updateEdgeStyle(EDGE_ID, { fontSize: 20 });
    const e = currentEdge();
    expect(e.color).toBe('#ff0000');
    expect(e.lineWidth).toBe(3);
    expect(e.fontSize).toBe(20);
  });

  it('is a single undo per call', () => {
    renderActions().updateEdgeStyle(EDGE_ID, { fontSize: 22 });
    expect(currentEdge().fontSize).toBe(22);
    undoManager.undo();
    expect(currentEdge().fontSize).toBeUndefined();
  });
});
