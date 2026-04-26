import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type GridType } from '../../store/settingsStore';

function DotsPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="currentColor">
      {([3, 11, 19] as number[]).flatMap((cx) =>
        ([3, 8, 13] as number[]).map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} opacity={0.75} />
        )),
      )}
    </svg>
  );
}

function LinesPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" stroke="currentColor" strokeWidth={0.9} fill="none" opacity={0.75}>
      <line x1={5}  y1={0} x2={5}  y2={16} />
      <line x1={11} y1={0} x2={11} y2={16} />
      <line x1={17} y1={0} x2={17} y2={16} />
      <line x1={0} y1={4}  x2={22} y2={4}  />
      <line x1={0} y1={9}  x2={22} y2={9}  />
      <line x1={0} y1={14} x2={22} y2={14} />
    </svg>
  );
}

function GridPreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" stroke="currentColor" fill="none">
      {/* minor lines */}
      <g opacity={0.3} strokeWidth={0.5}>
        {[4, 7, 15, 18].map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={16} />
        ))}
        {[4, 7, 12].map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={22} y2={y} />
        ))}
      </g>
      {/* major lines */}
      <g opacity={0.7} strokeWidth={1}>
        <line x1={11} y1={0} x2={11} y2={16} />
        <line x1={0}  y1={8} x2={22} y2={8}  />
      </g>
    </svg>
  );
}

function NonePreview() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
      <rect x={1} y={1} width={20} height={14} rx={2} stroke="currentColor" strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />
    </svg>
  );
}

type GridOption = { type: GridType; labelKey: string; Preview: () => React.ReactElement };

const GRID_OPTIONS: GridOption[] = [
  { type: 'dots',  labelKey: 'canvas.gridPicker.dots',  Preview: DotsPreview  },
  { type: 'lines', labelKey: 'canvas.gridPicker.lines', Preview: LinesPreview },
  { type: 'grid',  labelKey: 'canvas.gridPicker.solid', Preview: GridPreview  },
  { type: 'none',  labelKey: 'canvas.gridPicker.none',  Preview: NonePreview  },
];

export default function CanvasControlsWidget() {
  const { t } = useTranslation();
  const gridType    = useSettingsStore((s) => s.gridType);
  const setGridType = useSettingsStore((s) => s.setGridType);

  return (
    <div className="absolute bottom-4 right-4 pointer-events-auto select-none">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-xl p-1 flex gap-0.5">
        {GRID_OPTIONS.map(({ type, labelKey, Preview }) => {
          const active = gridType === type;
          const label  = t(labelKey);
          return (
            <button
              key={type}
              onClick={() => setGridType(type)}
              title={label}
              className={`
                flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-lg transition-all duration-150
                ${active
                  ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                  : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
                }
              `}
            >
              <Preview />
              <span className="text-[9px] leading-none font-medium tracking-wide uppercase">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
