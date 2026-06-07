/**
 * useEdgeActions — integration coverage for canvas drag handlers that the
 * react-konva test mock cannot exercise directly.
 *
 * The canvas waypoint-edit cycle (insert / move / delete) and the inline
 * edge-style panel ultimately funnel through the store ops in useEdgeActions
 * (updateEdgeWaypoints / updateEdgeStyle / updateEdgeRoutingMode). We drive
 * those ops directly via renderHook — no Konva pointer simulation — and assert
 * the resulting ViewEdge shape, persistence, and single-undo semantics. This
 * converts the "R3b / R9 integration debt" into solid logic coverage.
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
          edges: [
            { id: EDGE_ID, relationId: REL_ID, waypoints: [], ...edge },
          ],
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
    useEdgeActions({
      activeTabId: FILE_ID,
      isStandalone: true,
      updateFileContent: () => {},
    }),
  ).result.current;
}

beforeEach(() => {
  undoManager.clear();
  useVFSStore.getState().loadProject(projectWithEdge());
});

describe('useEdgeActions.updateEdgeWaypoints — insert / move / delete cycle', () => {
  it('inserts waypoints onto an edge that had none', () => {
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 40, y: 30 }]);
    expect(currentEdge().waypoints).toEqual([{ x: 40, y: 30 }]);
  });

  it('moves an existing waypoint (replaces the array verbatim)', () => {
    useVFSStore.getState().loadProject(projectWithEdge({ waypoints: [{ x: 40, y: 30 }] }));
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 60, y: 80 }]);
    expect(currentEdge().waypoints).toEqual([{ x: 60, y: 80 }]);
  });

  it('deletes a waypoint by writing the shorter array', () => {
    useVFSStore.getState().loadProject(
      projectWithEdge({ waypoints: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }),
    );
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 10, y: 10 }]);
    expect(currentEdge().waypoints).toEqual([{ x: 10, y: 10 }]);
  });

  it('records one undo per call and reverts the whole waypoint change', () => {
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 40, y: 30 }, { x: 70, y: 50 }]);
    expect(currentEdge().waypoints).toHaveLength(2);
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(1);

    undoManager.undo(FILE_ID);
    expect(currentEdge().waypoints).toEqual([]);
  });

  it('full insert→move→delete cycle leaves three undo steps, each reversible', () => {
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 10, y: 10 }]);           // insert
    updateEdgeWaypoints(EDGE_ID, [{ x: 25, y: 25 }]);           // move
    updateEdgeWaypoints(EDGE_ID, []);                           // delete
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(3);

    expect(currentEdge().waypoints).toEqual([]);
    undoManager.undo(FILE_ID); // undo delete
    expect(currentEdge().waypoints).toEqual([{ x: 25, y: 25 }]);
    undoManager.undo(FILE_ID); // undo move
    expect(currentEdge().waypoints).toEqual([{ x: 10, y: 10 }]);
    undoManager.undo(FILE_ID); // undo insert
    expect(currentEdge().waypoints).toEqual([]);
  });

  it('does not touch other edge properties when writing waypoints', () => {
    useVFSStore.getState().loadProject(projectWithEdge({ color: '#ff0000', routingMode: 'curved' }));
    const { updateEdgeWaypoints } = renderActions();
    updateEdgeWaypoints(EDGE_ID, [{ x: 5, y: 5 }]);
    const e = currentEdge();
    expect(e.color).toBe('#ff0000');
    expect(e.routingMode).toBe('curved');
  });
});

describe('useEdgeActions.updateEdgeStyle — patch / clear semantics', () => {
  it('sets only the keys present in the patch', () => {
    const { updateEdgeStyle } = renderActions();
    updateEdgeStyle(EDGE_ID, { color: '#00ff00' });
    const e = currentEdge();
    expect(e.color).toBe('#00ff00');
    expect(e.lineWidth).toBeUndefined();
    expect(e.lineStyle).toBeUndefined();
  });

  it('leaves untouched a property whose key is omitted', () => {
    useVFSStore.getState().loadProject(projectWithEdge({ color: '#111111', lineWidth: 4 }));
    const { updateEdgeStyle } = renderActions();
    updateEdgeStyle(EDGE_ID, { lineWidth: 6 });
    const e = currentEdge();
    expect(e.color).toBe('#111111'); // untouched
    expect(e.lineWidth).toBe(6);
  });

  it('clears a property when its value is null', () => {
    useVFSStore.getState().loadProject(
      projectWithEdge({ color: '#222222', lineWidth: 3, lineStyle: 'dashed' }),
    );
    const { updateEdgeStyle } = renderActions();
    updateEdgeStyle(EDGE_ID, { color: null, lineStyle: null });
    const e = currentEdge();
    expect('color' in e).toBe(false);
    expect('lineStyle' in e).toBe(false);
    expect(e.lineWidth).toBe(3); // omitted key untouched
  });

  it('records a single undo that reverts the style patch', () => {
    const { updateEdgeStyle } = renderActions();
    updateEdgeStyle(EDGE_ID, { color: '#abcdef', lineWidth: 5 });
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(1);
    undoManager.undo(FILE_ID);
    const e = currentEdge();
    expect(e.color).toBeUndefined();
    expect(e.lineWidth).toBeUndefined();
  });
});

describe('useEdgeActions.updateEdgeRoutingMode', () => {
  it('sets the routing mode and is undoable', () => {
    const { updateEdgeRoutingMode } = renderActions();
    updateEdgeRoutingMode(EDGE_ID, 'orthogonal');
    expect(currentEdge().routingMode).toBe('orthogonal');
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(1);
    undoManager.undo(FILE_ID);
    expect(currentEdge().routingMode).toBeUndefined();
  });
});
