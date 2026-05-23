import { useRef, useCallback, useMemo } from 'react';
import { useViewportControlStore } from '../store/viewportControlStore';
import {
  isNoteViewModel,
  isPackageViewModel,
} from '../../adapters/view-models/node.view-model';
import type { NodeBounds } from '../edges/geometry';

const MM_W      = 200;
const MM_H      = 130;
const WORLD_PAD = 60; // world-unit padding around content bounds

interface MiniMapShape {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface MiniMapProps {
  shapes: MiniMapShape[];
  boundsMap: Map<string, NodeBounds>;
  viewport: { x: number; y: number; scale: number };
  stageWidth: number;
  stageHeight: number;
}

export default function MiniMap({
  shapes,
  boundsMap,
  viewport,
  stageWidth,
  stageHeight,
}: MiniMapProps) {
  const panTo   = useViewportControlStore((s) => s.panTo);
  const dragging = useRef(false);

  const { worldBounds, mmScale, offsetX, offsetY, shapeRects, vpRect } = useMemo(() => {
    // Compute world AABB
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of shapes) {
      const b = boundsMap.get(shape.id);
      if (!b) continue;
      if (b.x             < minX) minX = b.x;
      if (b.y             < minY) minY = b.y;
      if (b.x + b.width   > maxX) maxX = b.x + b.width;
      if (b.y + b.height  > maxY) maxY = b.y + b.height;
    }
    const wb = minX === Infinity
      ? { x: -500, y: -500, width: 1000, height: 1000 }
      : {
          x:      minX - WORLD_PAD,
          y:      minY - WORLD_PAD,
          width:  maxX - minX + WORLD_PAD * 2,
          height: maxY - minY + WORLD_PAD * 2,
        };

    // Uniform scale to fit worldBounds into MM_W × MM_H
    const sc = Math.min(MM_W / wb.width, MM_H / wb.height);
    const ox = (MM_W - wb.width  * sc) / 2;
    const oy = (MM_H - wb.height * sc) / 2;

    const toMM = (wx: number, wy: number) => ({
      x: (wx - wb.x) * sc + ox,
      y: (wy - wb.y) * sc + oy,
    });

    // Build shape rectangles
    const rects = shapes
      .map((shape) => {
        const b = boundsMap.get(shape.id);
        if (!b) return null;
        const { x, y } = toMM(b.x, b.y);
        const kind = isPackageViewModel(shape.data)
          ? 'pkg'
          : isNoteViewModel(shape.data)
          ? 'note'
          : 'node';
        return {
          id:   shape.id,
          x,    y,
          w:    Math.max(2, b.width  * sc),
          h:    Math.max(2, b.height * sc),
          kind,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Viewport indicator rect
    const vpTopLeft = toMM(-viewport.x / viewport.scale, -viewport.y / viewport.scale);
    const vp = {
      x: vpTopLeft.x,
      y: vpTopLeft.y,
      w: (stageWidth  / viewport.scale) * sc,
      h: (stageHeight / viewport.scale) * sc,
    };

    return {
      worldBounds: wb,
      mmScale:     sc,
      offsetX:     ox,
      offsetY:     oy,
      shapeRects:  rects,
      vpRect:      vp,
    };
  }, [shapes, boundsMap, viewport, stageWidth, stageHeight]);

  const mmToWorld = useCallback(
    (mx: number, my: number) => ({
      x: (mx - offsetX) / mmScale + worldBounds.x,
      y: (my - offsetY) / mmScale + worldBounds.y,
    }),
    [offsetX, offsetY, mmScale, worldBounds],
  );

  const applyPan = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const w = mmToWorld(e.clientX - rect.left, e.clientY - rect.top);
      panTo(w.x, w.y);
    },
    [mmToWorld, panTo],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      dragging.current = true;
      applyPan(e);
    },
    [applyPan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging.current) return;
      applyPan(e);
    },
    [applyPan],
  );

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  return (
    <div className="absolute bottom-4 left-4 pointer-events-auto select-none">
      <div className="bg-surface-primary/90 backdrop-blur-sm border border-surface-border rounded-xl shadow-xl overflow-hidden">
        <svg
          width={MM_W}
          height={MM_H}
          className="block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          {/* Packages (outline only) */}
          {shapeRects
            .filter((r) => r.kind === 'pkg')
            .map((r) => (
              <rect
                key={r.id}
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill="none"
                stroke="#475569"
                strokeWidth={1}
                rx={1}
                opacity={0.8}
              />
            ))}

          {/* Nodes and notes (filled) */}
          {shapeRects
            .filter((r) => r.kind !== 'pkg')
            .map((r) => (
              <rect
                key={r.id}
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={r.kind === 'note' ? '#f59e0b' : '#3b82f6'}
                rx={1}
                opacity={0.75}
              />
            ))}

          {/* Viewport indicator */}
          <rect
            x={vpRect.x}
            y={vpRect.y}
            width={Math.max(6, vpRect.w)}
            height={Math.max(6, vpRect.h)}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
            rx={1}
            style={{ pointerEvents: 'none' }}
          />
        </svg>
      </div>
    </div>
  );
}
