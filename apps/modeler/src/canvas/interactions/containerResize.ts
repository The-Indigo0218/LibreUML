/**
 * containerResize — commits a Transformer-driven resize of a container node
 * (system boundary, UC module, package) onto a diagram view.
 *
 * Width/height alone are not enough. Konva's Transformer resizes by rewriting
 * the node's whole local transform, so dragging a left or top anchor also moves
 * the node's origin. A shift that is never persisted leaves the store one step
 * behind the canvas: the shape stays where the pointer left it until the page
 * reloads, then snaps back to the stale origin.
 *
 * `dx`/`dy` carry that shift. Contained nodes store parent-relative
 * coordinates, so they are moved back by the same delta — the container edge
 * extends past them and the contents stay visually put.
 */

import { isDiagramView } from '../../features/diagram/hooks/useVFSCanvasController';

export function commitContainerResize(
  draft: any,
  tabId: string,
  shapeId: string,
  width: number,
  height: number,
  dx: number,
  dy: number,
): void {
  const file = draft.project?.nodes[tabId];
  if (!file || file.type !== 'FILE' || !isDiagramView(file.content)) return;
  const viewNode = file.content.nodes.find((vn: any) => vn.id === shapeId);
  if (!viewNode) return;

  viewNode.width = width;
  viewNode.height = height;
  if (dx === 0 && dy === 0) return;

  viewNode.x += dx;
  viewNode.y += dy;
  for (const child of file.content.nodes) {
    if (child.parentPackageId === shapeId) {
      child.x -= dx;
      child.y -= dy;
    }
  }
}
