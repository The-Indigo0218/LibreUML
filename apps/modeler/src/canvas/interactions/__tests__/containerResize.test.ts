import { describe, it, expect } from 'vitest';
import { commitContainerResize } from '../containerResize';

const TAB = 'diagram-1';
const SB = 'vn-boundary';

function draft() {
  return {
    project: {
      nodes: {
        [TAB]: {
          type: 'FILE',
          content: {
            diagramId: 'dg-1',
            nodes: [
              { id: SB, elementId: 'sb-1', x: 200, y: 100, width: 420, height: 320 },
              { id: 'vn-uc', elementId: 'uc-1', x: 40, y: 60, parentPackageId: SB },
              { id: 'vn-loose', elementId: 'act-1', x: 900, y: 900 },
            ],
            edges: [],
          },
        },
      },
    },
  };
}

const nodeById = (d: ReturnType<typeof draft>, id: string) =>
  (d.project.nodes[TAB].content.nodes as any[]).find((n) => n.id === id);

describe('commitContainerResize', () => {
  it('writes width/height and leaves the origin alone for a bottom-right resize', () => {
    const d = draft();
    commitContainerResize(d, TAB, SB, 600, 500, 0, 0);

    const sb = nodeById(d, SB);
    expect(sb).toMatchObject({ x: 200, y: 100, width: 600, height: 500 });
    expect(nodeById(d, 'vn-uc')).toMatchObject({ x: 40, y: 60 });
  });

  it('persists the origin shift a left/top anchor produces', () => {
    const d = draft();
    // Dragging the top-left anchor up-left by (80, 50): the Transformer moved
    // the node's origin, so the store has to follow or the shape snaps back.
    commitContainerResize(d, TAB, SB, 500, 370, -80, -50);

    expect(nodeById(d, SB)).toMatchObject({ x: 120, y: 50, width: 500, height: 370 });
  });

  it('keeps contained nodes visually put by compensating the delta', () => {
    const d = draft();
    commitContainerResize(d, TAB, SB, 500, 370, -80, -50);

    // Child coords are parent-relative: +80/+50 here cancels the parent's shift,
    // so the child's absolute position (240, 160) is unchanged.
    const child = nodeById(d, 'vn-uc');
    expect(child).toMatchObject({ x: 120, y: 110 });
    const sb = nodeById(d, SB);
    expect({ x: sb.x + child.x, y: sb.y + child.y }).toEqual({ x: 240, y: 160 });
  });

  it('does not touch nodes that are not children of the resized container', () => {
    const d = draft();
    commitContainerResize(d, TAB, SB, 500, 370, -80, -50);
    expect(nodeById(d, 'vn-loose')).toMatchObject({ x: 900, y: 900 });
  });

  it('is a no-op when the view node is missing', () => {
    const d = draft();
    const before = JSON.stringify(d);
    commitContainerResize(d, TAB, 'nope', 500, 370, -80, -50);
    expect(JSON.stringify(d)).toBe(before);
  });

  it('is a no-op when the tab is not a diagram file', () => {
    const d = draft();
    (d.project.nodes as any)[TAB].type = 'FOLDER';
    const before = JSON.stringify(d);
    commitContainerResize(d, TAB, SB, 500, 370, 0, 0);
    expect(JSON.stringify(d)).toBe(before);
  });
});
