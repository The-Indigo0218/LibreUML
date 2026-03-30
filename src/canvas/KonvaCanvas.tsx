import { useRef, useEffect, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import GridPattern from './engine/GridPattern';
import { useViewport } from './engine/useViewport';
import { useSettingsStore } from '../store/settingsStore';

export default function KonvaCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const showGrid = useSettingsStore((s) => s.showGrid);
  const { stageRef, stageProps, viewport } = useViewport();

  // Track container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    ro.observe(container);
    setSize({ width: container.clientWidth, height: container.clientHeight });

    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-canvas-base">
      {size.width > 0 && size.height > 0 && (
        <Stage ref={stageRef} width={size.width} height={size.height} {...stageProps}>
          {/* ── Background layer — grid ───────────────────────────── */}
          <Layer>
            {showGrid && (
              <GridPattern
                viewport={viewport}
                stageWidth={size.width}
                stageHeight={size.height}
              />
            )}
          </Layer>

          {/* ── Edges layer ──────────────────────────────────────── */}
          <Layer name="edges" />

          {/* ── Nodes layer ──────────────────────────────────────── */}
          <Layer name="nodes" />

          {/* ── Selection layer ──────────────────────────────────── */}
          <Layer name="selection" />

          {/* ── Interaction layer ────────────────────────────────── */}
          <Layer name="interaction" />
        </Stage>
      )}
    </div>
  );
}
