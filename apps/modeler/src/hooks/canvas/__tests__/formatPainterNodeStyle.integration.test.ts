/**
 * Format painter copy → paste, end to end at the store/op level.
 *
 * The canvas format-painter gesture (copy style from one node, click another to
 * paste) cannot be driven through the react-konva mock. The actual data flow is:
 *   useFormatPainterStore.copyStyle(style)  →  KonvaCanvas reads `copied`  →
 *   vfsController.applyNodeStyle([targetIds], copied)
 * We exercise both ends directly: the store holds the copied patch, and
 * applyNodeStyle (from useNodeActions) applies that exact patch to the target
 * view nodes, with patch/clear semantics and single-undo behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeActions } from '../useNodeActions';
import { useFormatPainterStore, type CopiedNodeStyle } from '../../../store/formatPainter.store';
import { useVFSStore } from '../../../store/project-vfs.store';
import { undoManager } from '../../../core/undo/instance';
import type { LibreUMLProject, ViewNode } from '../../../core/domain/vfs/vfs.types';

const FILE_ID = 'file-1';

function projectWithNodes(nodes: Partial<ViewNode>[]): LibreUMLProject {
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
          nodes: nodes.map((n, i) => ({ id: `vn-${i}`, elementId: `el-${i}`, x: 0, y: 0, ...n })),
          edges: [],
        },
        createdAt: now,
        updatedAt: now,
      } as any,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function viewNodes(): ViewNode[] {
  const file = useVFSStore.getState().project!.nodes[FILE_ID] as any;
  return file.content.nodes;
}
function nodeById(id: string): ViewNode {
  return viewNodes().find((n) => n.id === id)!;
}

function renderActions() {
  return renderHook(() =>
    useNodeActions({ activeTabId: FILE_ID, isStandalone: true, updateFileContent: () => {} }),
  ).result.current;
}

beforeEach(() => {
  undoManager.clear();
  useFormatPainterStore.getState().clear();
});

describe('useFormatPainterStore', () => {
  it('holds the copied style and clears it', () => {
    const style: CopiedNodeStyle = {
      color: '#abc', borderWidth: 3, borderStyle: 'dashed', fontFamily: 'Arial', fontSize: 14,
    };
    useFormatPainterStore.getState().copyStyle(style);
    expect(useFormatPainterStore.getState().copied).toEqual(style);
    useFormatPainterStore.getState().clear();
    expect(useFormatPainterStore.getState().copied).toBeNull();
  });
});

describe('format painter copy → applyNodeStyle paste', () => {
  it('pastes the full copied style patch onto the target node', () => {
    useVFSStore.getState().loadProject(
      projectWithNodes([
        { id: 'src', color: '#ff0000', borderWidth: 4, borderStyle: 'dotted', fontFamily: 'Mono', fontSize: 18 },
        { id: 'dst' },
      ]),
    );
    // Simulate copy from the source node's resolved style.
    const src = nodeById('src');
    const copied: CopiedNodeStyle = {
      color: src.color ?? null,
      borderWidth: src.borderWidth ?? null,
      borderStyle: src.borderStyle ?? null,
      fontFamily: src.fontFamily ?? null,
      fontSize: src.fontSize ?? null,
    };
    useFormatPainterStore.getState().copyStyle(copied);

    const { applyNodeStyle } = renderActions();
    applyNodeStyle(['dst'], useFormatPainterStore.getState().copied!);

    const dst = nodeById('dst');
    expect(dst.color).toBe('#ff0000');
    expect(dst.borderWidth).toBe(4);
    expect(dst.borderStyle).toBe('dotted');
    expect(dst.fontFamily).toBe('Mono');
    expect(dst.fontSize).toBe(18);
  });

  it('clears target properties when the copied style carries nulls', () => {
    useVFSStore.getState().loadProject(
      projectWithNodes([{ id: 'dst', color: '#123456', borderWidth: 5, fontSize: 20 }]),
    );
    const copied: CopiedNodeStyle = {
      color: null, borderWidth: null, borderStyle: null, fontFamily: null, fontSize: null,
    };
    useFormatPainterStore.getState().copyStyle(copied);

    const { applyNodeStyle } = renderActions();
    applyNodeStyle(['dst'], copied);

    const dst = nodeById('dst');
    expect('color' in dst).toBe(false);
    expect('borderWidth' in dst).toBe(false);
    expect('fontSize' in dst).toBe(false);
  });

  it('applies to multiple targets in a single undo transaction', () => {
    useVFSStore.getState().loadProject(
      projectWithNodes([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
    );
    const { applyNodeStyle } = renderActions();
    applyNodeStyle(['a', 'b'], { color: '#00ff00' });

    expect(nodeById('a').color).toBe('#00ff00');
    expect(nodeById('b').color).toBe('#00ff00');
    expect(nodeById('c').color).toBeUndefined(); // not targeted
    expect(undoManager.getUndoStack(FILE_ID)).toHaveLength(1);

    undoManager.undo(FILE_ID);
    expect(nodeById('a').color).toBeUndefined();
    expect(nodeById('b').color).toBeUndefined();
  });

  it('only touches keys present in the patch (omitted keys untouched)', () => {
    useVFSStore.getState().loadProject(
      projectWithNodes([{ id: 'dst', color: '#aaaaaa', fontSize: 12 }]),
    );
    const { applyNodeStyle } = renderActions();
    applyNodeStyle(['dst'], { fontSize: 22 });
    const dst = nodeById('dst');
    expect(dst.color).toBe('#aaaaaa'); // untouched
    expect(dst.fontSize).toBe(22);
  });
});
