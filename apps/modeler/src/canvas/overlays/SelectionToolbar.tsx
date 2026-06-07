import { useState } from 'react';
import { Pencil, Copy, Trash2, ArrowLeftRight, Settings2, Palette, Paintbrush, PaintBucket, Ban, Minus, Spline, Waypoints, SquareDashed, Type } from 'lucide-react';
import type { EdgeRoutingMode, NodeBorderStyle } from '../../core/domain/vfs/vfs.types';

export type ToolbarIcon =
  | 'edit' | 'duplicate' | 'delete' | 'reverse' | 'properties'
  | 'color' | 'copyStyle' | 'pasteStyle' | 'routing' | 'border' | 'font';

const BORDER_STYLE_OPTIONS: NodeBorderStyle[] = ['solid', 'dashed', 'dotted'];

const ROUTING_OPTIONS: { mode: EdgeRoutingMode; Icon: typeof Minus; key: string }[] = [
  { mode: 'straight',   Icon: Minus,     key: 'straight' },
  { mode: 'orthogonal', Icon: Waypoints, key: 'orthogonal' },
  { mode: 'curved',     Icon: Spline,    key: 'curved' },
];

export interface ToolbarAction {
  icon: ToolbarIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  swatches?: string[];
  onPickColor?: (color: string | null) => void;
  routing?: EdgeRoutingMode;
  onPickRouting?: (mode: EdgeRoutingMode) => void;
  routingLabels?: Partial<Record<EdgeRoutingMode, string>>;
  border?: { width: number; style: NodeBorderStyle };
  borderWidths?: number[];
  onPickBorderWidth?: (w: number) => void;
  onPickBorderStyle?: (s: NodeBorderStyle) => void;
  onClearBorder?: () => void;
  borderStyleLabels?: Partial<Record<NodeBorderStyle, string>>;
  font?: { family: string; size: number };
  fontFamilies?: { label: string; value: string }[];
  fontSizes?: number[];
  onPickFontFamily?: (family: string) => void;
  onPickFontSize?: (size: number) => void;
  onClearFont?: () => void;
}

export interface SelectionToolbarProps {
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
  border: SquareDashed,
  font: Type,
};

export default function SelectionToolbar({ x, y, actions }: SelectionToolbarProps) {
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
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-0.5 px-1 py-1 rounded-lg border border-surface-border
                   bg-surface-primary/95 shadow-xl backdrop-blur-sm"
      >
        {actions.map((action, i) => {
          const Icon = action.routing
            ? (ROUTING_OPTIONS.find((o) => o.mode === action.routing)?.Icon ?? ICONS.routing)
            : ICONS[action.icon];
          const isPopover = !!action.swatches || !!action.onPickRouting || !!action.onPickBorderWidth || !!action.onPickFontFamily;
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

      {swatchAction?.onPickBorderWidth && (
        <div
          className="mt-1.5 flex flex-col gap-1.5 px-1.5 py-1.5 rounded-lg border border-surface-border
                     bg-surface-primary/97 shadow-xl backdrop-blur-sm text-text-secondary"
        >
          <div className="flex items-center gap-1">
            {(swatchAction.borderWidths ?? [1, 2, 3]).map((w) => {
              const active = swatchAction.border?.width === w;
              return (
                <button
                  key={w}
                  title={`${w}px`}
                  aria-label={`${w}px`}
                  onClick={() => { swatchAction.onPickBorderWidth?.(w); }}
                  className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors
                    ${active ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover hover:text-text-primary'}`}
                >
                  <span style={{ display: 'block', width: 16, borderTop: `${w}px solid currentColor` }} />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 border-t border-surface-border/60 pt-1.5">
            {BORDER_STYLE_OPTIONS.map((s) => {
              const active = (swatchAction.border?.style ?? 'solid') === s;
              return (
                <button
                  key={s}
                  title={swatchAction.borderStyleLabels?.[s] ?? s}
                  aria-label={swatchAction.borderStyleLabels?.[s] ?? s}
                  onClick={() => { swatchAction.onPickBorderStyle?.(s); }}
                  className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors
                    ${active ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover hover:text-text-primary'}`}
                >
                  <span style={{ display: 'block', width: 16, borderTop: `2px ${s} currentColor` }} />
                </button>
              );
            })}
            <button
              title="—"
              aria-label="clear border"
              onClick={() => { swatchAction.onClearBorder?.(); setOpenSwatch(null); }}
              className="flex items-center justify-center w-8 h-7 rounded-md text-text-muted hover:bg-surface-hover"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {swatchAction?.onPickFontFamily && (
        <div
          className="mt-1.5 flex flex-col gap-1.5 px-1.5 py-1.5 rounded-lg border border-surface-border
                     bg-surface-primary/97 shadow-xl backdrop-blur-sm text-text-secondary w-44"
        >
          <div className="flex flex-col gap-0.5">
            {(swatchAction.fontFamilies ?? []).map((f) => {
              const active = swatchAction.font?.family === f.value;
              return (
                <button
                  key={f.value}
                  title={f.label}
                  aria-label={f.label}
                  onClick={() => { swatchAction.onPickFontFamily?.(f.value); }}
                  style={{ fontFamily: f.value }}
                  className={`flex items-center px-2 h-7 rounded-md text-xs text-left transition-colors
                    ${active ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover hover:text-text-primary'}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 border-t border-surface-border/60 pt-1.5">
            {(swatchAction.fontSizes ?? [12, 14, 16, 18]).map((s) => {
              const active = swatchAction.font?.size === s;
              return (
                <button
                  key={s}
                  title={`${s}px`}
                  aria-label={`${s}px`}
                  onClick={() => { swatchAction.onPickFontSize?.(s); }}
                  className={`flex items-center justify-center flex-1 h-7 rounded-md text-xs transition-colors
                    ${active ? 'bg-surface-hover text-text-primary' : 'hover:bg-surface-hover hover:text-text-primary'}`}
                >
                  {s}
                </button>
              );
            })}
            <button
              title="—"
              aria-label="clear font"
              onClick={() => { swatchAction.onClearFont?.(); setOpenSwatch(null); }}
              className="flex items-center justify-center w-8 h-7 rounded-md text-text-muted hover:bg-surface-hover"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
