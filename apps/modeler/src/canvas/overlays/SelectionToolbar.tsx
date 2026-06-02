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

import { Pencil, Copy, Trash2, ArrowLeftRight, Settings2 } from 'lucide-react';

export type ToolbarIcon = 'edit' | 'duplicate' | 'delete' | 'reverse' | 'properties';

export interface ToolbarAction {
  icon: ToolbarIcon;
  /** Accessible label / tooltip. */
  label: string;
  onClick: () => void;
  /** Renders in a destructive (red) style. */
  danger?: boolean;
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
};

export default function SelectionToolbar({ x, y, actions }: SelectionToolbarProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className="absolute z-30 pointer-events-auto flex items-center gap-0.5 px-1 py-1
                 rounded-lg border border-surface-border bg-surface-primary/95
                 shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
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
      {actions.map((action, i) => {
        const Icon = ICONS[action.icon];
        return (
          <button
            key={i}
            title={action.label}
            aria-label={action.label}
            onClick={action.onClick}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors
              ${action.danger
                ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
