import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const PICKER_W = 224;

export interface PackageCandidate {
  viewNodeId: string;
  packageName: string;
  depth: number;
  distanceToBorder: number;
}

interface PackageDropPickerProps {
  candidates: PackageCandidate[];
  screenPos: { x: number; y: number };
  onSelect: (viewNodeId: string | null) => void;
  onCancel: () => void;
}

export default function PackageDropPicker({
  candidates,
  screenPos,
  onSelect,
  onCancel,
}: PackageDropPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onCancel]);

  const rowH = 36;
  const left = Math.min(screenPos.x, window.innerWidth - PICKER_W - 8);
  const top = Math.min(screenPos.y, window.innerHeight - (candidates.length + 2) * rowH - 16);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, width: PICKER_W, zIndex: 9999 }}
      className="bg-surface-primary border border-surface-border rounded-md shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col overflow-hidden"
    >
      <div className="px-3 py-1.5 text-text-secondary text-xs font-medium border-b border-surface-border">
        Nest in package
      </div>
      {candidates.map((c) => (
        <button
          key={c.viewNodeId}
          className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-2 border-transparent hover:border-uml-class-border transition-colors"
          onClick={() => onSelect(c.viewNodeId)}
        >
          <span className="opacity-50 text-xs select-none shrink-0">
            {'›'.repeat(c.depth + 1)}
          </span>
          <span className="truncate">{c.packageName}</span>
        </button>
      ))}
      <div className="border-t border-surface-border mt-1" />
      <button
        className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-2 border-transparent hover:border-uml-class-border transition-colors italic"
        onClick={() => onSelect(null)}
      >
        None (free-floating)
      </button>
    </div>,
    document.body,
  );
}
