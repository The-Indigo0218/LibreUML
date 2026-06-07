/**
 * NodeTypePickerMenu — node-type chooser for the Quick Linker.
 *
 * Shown when the user drags a connection out of a node and drops on empty canvas.
 * Lists the node types valid for the active diagram; choosing one creates that
 * node at the drop point already linked to the source. Closes on outside click
 * or Escape (cancel = no node created).
 *
 * Same overlay pattern as RelationPickerMenu: positioned in container px inside
 * CanvasOverlay, opts into pointer-events over the pass-through overlay.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { stereotype } from '../../features/diagram/types/diagram.types';

export interface NodeTypePickerMenuProps {
  x: number;
  y: number;
  types: stereotype[];
  onPick: (type: stereotype) => void;
  onClose: () => void;
}

export default function NodeTypePickerMenu({ x, y, types, onPick, onClose }: NodeTypePickerMenuProps) {
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
    // Defer so the same mouseup that opened the menu doesn't immediately close it.
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
      className="absolute z-40 pointer-events-auto min-w-[170px] py-1 rounded-lg border
                 border-surface-border bg-surface-primary/97 shadow-2xl backdrop-blur-sm
                 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, 8px)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {t('nodeTypePicker.title')}
      </div>
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onPick(type)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary
                     hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
        >
          {t(`nodeTypes.${type}`)}
        </button>
      ))}
    </div>
  );
}
