/**
 * SelectionToolbar — floating contextual action bar for the selected element (R1).
 *
 * A small HTML bar anchored to the selection's bounding box (a node's top-center
 * or an edge's midpoint), floating over the Konva <Stage>. It shows only the
 * actions relevant to the selected element type and applies them live.
 *
 * Positioning is computed by the parent (KonvaCanvas) via worldToScreen and
 * passed as screen-space (container) pixels. The bar anchors to the bounding box
 * — it does NOT follow the cursor (deliberate: avoids jitter, per the UX brief).
 *
 * Mounted inside CanvasOverlay (pointer-events: none container) and opts back
 * into pointer-events so its buttons are clickable.
 */

import { useState } from 'react';
import { Pencil, Copy, Trash2, ArrowLeftRight, Settings2, Palette, Paintbrush, PaintBucket, Ban, Minus, Spline, Waypoints } from 'lucide-react';
import type { EdgeRoutingMode } from '../../core/domain/vfs/vfs.types';

export type ToolbarIcon =
  | 'edit' | 'duplicate' | 'delete' | 'reverse' | 'properties'
  | 'color' | 'copyStyle' | 'pasteStyle' | 'routing';

/** Icon + label for each routing mode, shown in the routing popover. */
const ROUTING_OPTIONS: { mode: EdgeRoutingMode; Icon: typeof Minus; key: string }[] = [
  { mode: 'straight',   Icon: Minus,     key: 'straight' },
  { mode: 'orthogonal', Icon: Waypoints, key: 'orthogonal' },
  { mode: 'curved',     Icon: Spline,    key: 'curved' },
];

export interface ToolbarAction {
  icon: ToolbarIcon;
  /** Accessible label / tooltip. */
  label: string;
  onClick: () => void;
  /** Renders in a destructive (red) style. */
  danger?: boolean;
  /**
   * When set, clicking the button opens a color-swatch popover instead of firing
   * onClick (R10 color setter). Picking a swatch calls onPickColor (null = clear).
   */
  swatches?: string[];
  onPickColor?: (color: string | null) => void;
  /**
   * When set, the button opens a routing-mode popover (straight/orthogonal/curved).
   * The trigger icon reflects the current mode; picking an option calls onPickRouting.
   */
  routing?: EdgeRoutingMode;
  onPickRouting?: (mode: EdgeRoutingMode) => void;
  /** Per-option tooltip labels for the routing popover, keyed by mode. */
  routingLabels?: Partial<Record<EdgeRoutingMode, string>>;
}

export interface SelectionToolbarProps {
  /** Screen-space (container px) anchor — typically the top-center of the selection. */
  x: number;
  y: number;
  actions: ToolbarAction[];
}

const ICONS: Record<ToolbarIcon, typeof Pencil> = {
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  reverse: ArrowLeftRight,
  properties: Settings2,
  color: Palette,
  copyStyle: Paintbrush,
  pasteStyle: PaintBucket,
  routing: Spline,
};

export default function SelectionToolbar({ x, y, actions }: SelectionToolbarProps) {
  // Index of the action whose popover (color swatches or routing modes) is open, or null.
  const [openSwatch, setOpenSwatch] = useState<number | null>(null);

  if (actions.length === 0) return null;

  const swatchAction = openSwatch !== null ? actions[openSwatch] : null;

  return (
    <div
      className="absolute z-30 pointer-events-auto flex flex-col items-center
                 animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        // Center horizontally on the anchor and sit just above it.
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
      // Don't let clicks on the bar bubble to the stage (would clear selection).
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-0.5 px-1 py-1 rounded-lg border border-surface-border
                   bg-surface-primary/95 shadow-xl backdrop-blur-sm"
      >
        {actions.map((action, i) => {
          // Routing buttons show the icon of the current mode; others use the static map.
          const Icon = action.routing
            ? (ROUTING_OPTIONS.find((o) => o.mode === action.routing)?.Icon ?? ICONS.routing)
            : ICONS[action.icon];
          const isPopover = !!action.swatches || !!action.onPickRouting;
          return (
            <button
              key={i}
              title={action.label}
              aria-label={action.label}
              onClick={() => (isPopover ? setOpenSwatch((p) => (p === i ? null : i)) : action.onClick())}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors
                ${action.danger
                  ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                  : openSwatch === i
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Routing-mode popover (straight / orthogonal / curved) */}
      {swatchAction?.onPickRouting && (
        <div
          className="mt-1.5 flex items-center gap-0.5 px-1 py-1 rounded-lg border border-surface-border
                     bg-surface-primary/97 shadow-xl backdrop-blur-sm"
        >
          {ROUTING_OPTIONS.map(({ mode, Icon, key }) => {
            const active = swatchAction.routing === mode;
            return (
              <button
                key={key}
                title={swatchAction.routingLabels?.[mode] ?? mode}
                aria-label={swatchAction.routingLabels?.[mode] ?? mode}
                onClick={() => { swatchAction.onPickRouting?.(mode); setOpenSwatch(null); }}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors
                  ${active
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Color-swatch popover (R10 color setter) */}
      {swatchAction?.swatches && (
        <div
          className="mt-1.5 flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-surface-border
                     bg-surface-primary/97 shadow-xl backdrop-blur-sm"
        >
          {swatchAction.swatches.map((c) => (
            <button
              key={c}
              title={c}
              aria-label={c}
              onClick={() => { swatchAction.onPickColor?.(c); setOpenSwatch(null); }}
              className="w-5 h-5 rounded-full border border-white/25 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
          {/* Clear color */}
          <button
            title="—"
            aria-label="clear color"
            onClick={() => { swatchAction.onPickColor?.(null); setOpenSwatch(null); }}
            className="w-5 h-5 rounded-full flex items-center justify-center border border-white/25
                       text-text-muted hover:bg-surface-hover"
          >
            <Ban className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
