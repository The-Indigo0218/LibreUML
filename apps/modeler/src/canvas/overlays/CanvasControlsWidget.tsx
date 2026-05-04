import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type GridType } from '../../store/settingsStore';
import { DotsPreview, LinesPreview, GridPreview, NonePreview } from '../../components/shared/GridTypePreviews';

type GridOption = { type: GridType; labelKey: string; Preview: () => React.ReactElement };

export const GRID_OPTIONS: GridOption[] = [
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
