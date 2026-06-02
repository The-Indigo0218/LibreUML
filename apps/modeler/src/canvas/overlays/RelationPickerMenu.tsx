/**
 * RelationPickerMenu — quick chooser of valid relation types on connection drop (R2/R7).
 *
 * Shown when the user drags a connection onto a target for which the active
 * palette mode is not valid, but other relation types are. Lists only the valid
 * types (filtered upstream by connectionValidator) so the user picks one instead
 * of being rejected. Closes on outside click or Escape.
 *
 * Positioned in screen-space (container px) inside CanvasOverlay; opts into
 * pointer-events so it is clickable over the otherwise pass-through overlay.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { UmlRelationType } from '../../features/diagram/types/diagram.types';

export interface RelationPickerMenuProps {
  x: number;
  y: number;
  types: UmlRelationType[];
  onPick: (type: UmlRelationType) => void;
  onClose: () => void;
}

export default function RelationPickerMenu({ x, y, types, onPick, onClose }: RelationPickerMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Defer so the same mouseup/click that opened the menu doesn't close it.
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  if (types.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-40 pointer-events-auto min-w-[160px] py-1 rounded-lg border
                 border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, 8px)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {t('relationPicker.title')}
      </div>
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onPick(type)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary
                     hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
        >
          {t(`relationTypes.${type}`)}
        </button>
      ))}
    </div>
  );
}
